# 02 · 架构模式

webos 内部反复出现的几个固定模式。**新代码遵循这些模式，不要自创新结构。**

---

## 1. Singleton（单例）

**用在哪**：所有 shell 全局服务（WindowManager / AppRegistry / AppLoader / AppMessageBus / ThemeRegistry / UserSession / SettingsPanel.instance / NotificationCenter.instance / GlobalSearch.instance）

**标准写法**：

```ts
export class WindowManager extends EventEmitter<WindowManagerEvents> {
  private static _instance: WindowManager | null = null

  static get instance(): WindowManager {
    if (!WindowManager._instance) WindowManager._instance = new WindowManager()
    return WindowManager._instance
  }

  // ... 实例字段和方法
}

// 调用
WindowManager.instance.register(win)
```

**为什么不是 ServiceContainer / DI**：webos 是单实例 SPA，DI 复杂度收益不明显。详见 [08-design-decisions.md](./08-design-decisions.md)。

**禁忌**：
- 不要在 singleton 里持有可变 DOM 引用而不清理（singleton 永远活着）
- 不要在 singleton 的 constructor 里 mount UI（lazy 等到需要时再 mount）

---

## 2. EventEmitter（类型安全事件）

**类**：`apps/webos-shell/src/util/EventEmitter.ts`

**用在哪**：所有 UIElement / 所有 singleton / 所有有"事件"概念的对象

**标准写法**：

```ts
// 1) 定义事件类型表
export interface MyComponentEvents {
  click: void
  change: { value: string }
  [key: string]: unknown   // 必须有，TypeScript 兼容性
}

// 2) 继承 EventEmitter<Events>
export class MyComponent extends EventEmitter<MyComponentEvents> {
  doSomething() {
    this.emit('change', { value: 'x' })
  }
}

// 3) 订阅返回 unsubscribe 函数
const off = comp.on('change', ({ value }) => console.log(value))
off()  // 反订阅
```

**off / once / removeAllListeners** 都已实现。emit 内部已对 handler 集合做 `[...set]` 浅拷贝，handler 内 off 不会影响当前 emit 遍历。

**禁忌**：
- 不要绕过 EventEmitter 自己写 `private listeners = []` 之类的
- iframe 内 SDK 用 `Webos.events.on` 订阅，**不要混用** `Webos.client.on`（后者是底层 RpcClient 的事件，不是业务事件）

---

## 3. UIElement 基类

**类**：`apps/webos-shell/src/core/UIElement.ts`

**用在哪**：所有有自己 DOM 的 UI 组件（Window / Desktop / IconItem / Taskbar 老的 / DockItem / TopLeftBar / TopRightBar / NotificationCenter / StartMenu / GlobalSearch / SettingsPanel / UserMenu）

**标准写法**：

```ts
export class MyWidget extends UIElement<MyWidgetEvents> {
  constructor(options: MyWidgetOptions) {
    super({ id: options.id })   // id 可省，自动生成 shortId
    this.options = options
  }

  protected render(): HTMLElement {     // 子类必实现：构造并返回根 DOM
    const el = createEl('div', { className: '...' })
    this.addDomListener(el, 'click', () => this.emit('click', undefined))
    return el
  }

  // 可选生命周期钩子
  protected onMount(): void { /* 挂到父节点之后 */ }
  protected onUnmount(): void { /* 从父节点摘下后 */ }
  protected onDestroy(): void { /* 销毁时 */ }

  // 用 addDomListener / addDisposer 注册的副作用，destroy 时自动清理
}
```

**生命周期**：

```
new MyWidget(opts)            // 创建，render 还没跑
  → mount(parent)              // 触发 render() + onMount() + 加入 DOM
  → unmount()                  // 从 DOM 摘下 + onUnmount()，内部状态保留
  → destroy()                  // 跑所有 disposers + 移除 DOM + onDestroy() + 清空 EventEmitter
                               // 之后 mount 会抛 error
```

**关键 API**：
- `el`：lazy getter，第一次访问触发 render()。访问时自动给 DOM 加 `data-webos-id` 属性
- `addDomListener(target, type, listener, opts?)`：注册 DOM 事件，destroy 时自动 removeEventListener
- `addDisposer(fn)`：注册任意清理函数（如 setInterval clear / unsubscribe），destroy 时自动调

**禁忌**：
- ❌ 自己 `el.addEventListener('click', ...)` 然后忘记 remove → 内存泄漏
- ❌ 在 render() 里 `setInterval` 不 addDisposer → singleton destroy 后 timer 还跑
- ❌ destroy 后还使用 `this.el` → throw error

---

## 4. RPC handler（postMessage 协议）

**类**：`apps/webos-shell/src/apps/AppMessageBus.ts`

iframe 应用通过 `Webos.xxx.method(args)` 发请求 → RpcClient postMessage 到父 window → AppMessageBus 路由到 handler。

**协议**（固定，不要改）：

```ts
// iframe → shell
{ type: 'webos.request', id, appId, module, method, args }

// shell → iframe
{ type: 'webos.response', id, ok, data?, error?: { code, message } }

// shell → iframe（主动推送事件）
{ type: 'webos.event', event, payload }
```

**注册新 handler**（在 `apps/builtinHandlers.ts`）：

```ts
bus.registerHandler('myModule', 'myMethod', async (req, source) => {
  const args = req.args as { foo: string }
  // source: AppWindow 实例；可拿 source.appId / source.sendMessage
  return { result: doSomething(args.foo) }
})
```

handler 抛错 → 自动包装为 RpcResponse `{ ok: false, error }`。如果想自定义 error code，throw 时挂上：

```ts
throw Object.assign(new Error('找不到资源'), { code: 'NOT_FOUND' })
```

**security**：handler 拿到的 `source.appId` 是 host 端注册时设置的（来自 manifest），不是 iframe 自报。AppMessageBus 已经把 `req.appId` 改成 trusted 值了。

**禁忌**：
- ❌ handler 里直接修改 `req.args` 然后传出去（外部可能再用）—— 用 `{ ...req.args }` 浅拷贝
- ❌ handler 返回 Promise 后忘了 await → response 里 data 是 undefined
- ❌ handler 里调 `setTimeout` 然后才 resolve → 默认 30s 超时；要算好

---

## 5. AppSource（应用清单数据源）

**类**：`apps/webos-shell/src/apps/AppSource.ts`

webos 不知道应用从哪来，使用方实现 `AppSource` 接口告诉它。已内置三种实现：

- `StaticAppSource(manifests[])` — 内存数组（demo / 内置应用用）
- `JsonAppSource(url)` — `fetch` 远端 JSON（生产推荐）
- `CompositeAppSource([sources])` — 多源合并

**接口**：

```ts
interface AppSource {
  list(): Promise<AppManifest[]>
  subscribe?(handler: (apps: AppManifest[]) => void): () => void  // 可选，热更新
}
```

注册到 `AppRegistry.instance.addSource(...)`，再 `await AppRegistry.instance.refresh()`。

**禁忌**：
- ❌ 在 manifest 里硬编码业务后端 URL（走 `entries[i].uri` / `JsonAppSource` URL）
- ❌ 写自定义 AppSource 时忘了 `validateManifest()` —— `AppRegistry` 内部不会再校验
- ❌ 顶层放 `entry` / `launchMode` / `defaultWindow` 等启动相关字段 —— 这些只能写在 `entries[i]` 里，校验会拒；详见 [docs/APP_MANIFEST_SPEC.md](../../docs/APP_MANIFEST_SPEC.md)

---

## 6. UserSession（跨应用共享会话）

**类**：`apps/webos-shell/src/user/UserSession.ts`

singleton，持有当前 user + token。**持久化底层走 `@webos/host-sdk` 的 session 模块** —— 与登录页 / RPC handler **共用同一个 localStorage key + 同一份 JSON 格式**。

**写**：

```ts
UserSession.instance.set({ user, token })   // 登录
UserSession.instance.setUser(user)           // 改 user 不动 token
UserSession.instance.setToken(token)         // 改 token 不动 user
UserSession.instance.clear()                 // 登出
```

**读**：

```ts
UserSession.instance.user             // UserInfo | null
UserSession.instance.token            // TokenInfo | null
UserSession.instance.accessToken      // string | null（便利 getter）
UserSession.instance.permissions      // string[]
UserSession.instance.isTokenExpired() // boolean
```

**订阅**：

```ts
UserSession.instance.on('change', ({ user, token }) => { ... })
```

**与 SDK / 登录页的关系**：

- iframe 应用调 `Webos.user.set()` → RPC → host handler 调 `UserSession.instance.set()`
- 同 origin 登录页调 `writeWebosSession({user, token})` → 直接写 LS（webos 启动时 UserSession 从 LS 恢复）
- shell 自己（如 UserMenu 退出登录）直接 `UserSession.instance.clear()`

**三条路径走同一份持久化底层**，详见 `packages/host-sdk/src/session.ts`。

---

## 7. AppLoader 启动应用（以 entry 为粒度）

**类**：`apps/webos-shell/src/apps/AppLoader.ts`

调用 `AppLoader.instance.launch(appId, { entryId, feature?, params?, forceNew? })`：

- `entryId` **必填**（每个应用可有多个 entry，必须显式选）
- 解析 manifest → 找到 `entries[i].id === entryId` 的 entry
- 处理 `feature` 参数（用 `resolveEntryUri(entry, feature.uri)` 拼接）
- `entry.launchMode === 'tab'` → `window.open(url, '_blank')` 直接返回 null
- 已运行 + 传 feature → 推送 `app.navigate` 事件，不开新窗口
- 单例（`entry.singleInstance` per-entry）→ 聚焦已有
- 普通 → 创建 AppWindow（带 `appId` + `entryId` 两个 dataset）→ 注册到 WindowManager / MessageBus / runningWindows / bootInfoMap

**复合 key**：`runningWindows` 用 `appId:entryId` 复合 key，每个 entry 独立追踪运行实例。
**查询 API**：
- `getRunning(appId, entryId)` — 某 entry 的所有运行窗口
- `getRunningByApp(appId)` — 某应用所有 entries 的所有窗口（跨 entry 广播用）
- `closeEntry(appId, entryId)` / `closeApp(appId)` / `isRunning(appId, entryId?)`

**禁忌**：
- ❌ 自己 `new AppWindow(...)` 然后 `WindowManager.instance.register()` —— 走 AppLoader.launch
- ❌ `launch(appId)` 不传 entryId —— 会编译报错（options 必填 entryId）
- ❌ 跨应用调用：`Webos.apps.open(appId, { entryId })` 是受控的；不要绕过它

---

## 8. ThemeRegistry / I18n

singleton，简单封装。变更走 emit 事件，订阅方刷新。

```ts
ThemeRegistry.instance.mode = 'dark'                  // setter 触发 emit
ThemeRegistry.instance.on('effectiveThemeChanged', ...)

i18n.locale = 'en'                                    // 同上
t('switchTheme')                                      // 取字典
```

i18n 字典在 `i18n/zh.ts` / `i18n/en.ts`。新字符串两边都要补，否则 fallback 到 key 字符串。

---

## 模式选择决策树

```
要新增一个 UI 组件？
  → 继承 UIElement<MyEvents>。用 addDomListener / addDisposer 注册副作用。

要新增一个全局服务？
  → singleton + extends EventEmitter<Events>。lazy mount。

要从 iframe 调 shell 能力？
  → 加 SDK 方法（packages/host-sdk/src/modules/）+ host handler（builtinHandlers.ts）。
    详见 05-extending-the-sdk.md

要让某个全局状态被多应用共享？
  → 模仿 UserSession：singleton + 持久化层放 host-sdk + 通过 broadcast 推 'changed' 事件。

要做"应用商店里多了一个新应用"？
  → 扩展 AppSource，不要硬编码到 main.ts
```

# @webos/host-sdk API 参考

webos 桌面壳 ↔ iframe 应用 之间的全部 RPC 能力。

> 包名：`@webos/host-sdk` · 版本：0.1.0 · License：MIT

---

## 目录

- [安装与引入](#安装与引入)
- [基础约定](#基础约定)
- [Webos.notify](#webosnotify)
- [Webos.dialog](#webosdialog)
- [Webos.window](#weboswindow)
- [Webos.contextMenu](#weboscontextmenu)
- [Webos.download / upload](#webosdownload--upload)
- [Webos.user](#webosuser)
- [Webos.requestPermission](#webosrequestpermission)
- [Webos.theme](#webostheme)
- [Webos.storage](#webosstorage)
- [Webos.apps](#webosapps) — 列出 / 打开其他应用
- [Webos.app](#webosapp) — 自身启动信息
- [Webos.contributes](#weboscontributes) — 扩展点
- [Webos.message](#webosmessage)
- [Webos.events](#webosevents)
- [Webos.system](#webossystem)
- [Webos.configure / Webos.client](#webosconfigure--webosclient)
- [错误码](#错误码)

---

## 安装与引入

### npm / pnpm（推荐）

```bash
pnpm add @webos/host-sdk
```

```js
import { Webos } from '@webos/host-sdk'
Webos.notify({ title: 'Hi' })
```

### CDN UMD（零构建）

```html
<script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
<script>
  window.Webos.notify({ title: 'Hi' });
</script>
```

UMD 包同时挂载到 `window.Webos` 和 AMD 的 `Webos`。

### 类型

```ts
import type { Webos, NotifyOptions, SystemInfo, User } from '@webos/host-sdk'
```

---

## 基础约定

- 所有方法返回 `Promise`，除少数即时 API（如 `download`、事件订阅返回的 unsubscribe）。
- 默认超时 30 秒，超时抛 `Error('RPC timeout')`。可以通过 [`Webos.configure`](#webosconfigure--webosclient) 改。
- 调用必须发生在 webos shell 启动的 iframe 内；否则父窗口不会响应，请求最终会超时。
- SDK 在加载时自动 `install()`，无需手动初始化。

---

## Webos.notify

桌面通知。

```ts
Webos.notify(options: NotifyOptions): Promise<void>

interface NotifyOptions {
  title: string
  message?: string
  level?: 'info' | 'success' | 'warning' | 'critical'  // 默认 info
  duration?: number  // 毫秒；0 表示常驻；默认 4500
}
```

```js
Webos.notify({ title: '保存成功', level: 'success' })
Webos.notify({ title: '严重告警', message: '...', level: 'critical', duration: 0 })
```

---

## Webos.dialog

模态对话框。所有方法都返回 `Promise`，对话框关闭后才 resolve。

### 简化签名（兼容老接口）

```ts
dialog.alert(message: string, title?: string): Promise<void>
dialog.confirm(message: string, title?: string): Promise<boolean>
dialog.prompt(message: string, defaultValue?: string, title?: string): Promise<string | null>
```

```js
const ok = await Webos.dialog.confirm('删除此文件？')
const name = await Webos.dialog.prompt('请输入名字：', 'World')
```

`prompt` 在用户点取消时返回 `null`。

### 选项形式

`alert` / `confirm` 支持完整 `AlertOptions`：

```ts
interface AlertOptions {
  title?: string
  message: string
  icon?: 'info' | 'warning' | 'danger' | 'success' | 'question' | string  // 任意 URL
  buttons?: DialogButton[]      // 自定义按钮（优先级最高）
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  danger?: boolean
  width?: number
  height?: number
}

interface DialogButton {
  label: string
  value?: unknown               // 点击该按钮时 resolve 的值
  type?: 'primary' | 'secondary' | 'danger'
  autoFocus?: boolean           // 按 Enter 触发
  cancel?: boolean              // 按 Esc / 点窗口 × 触发
  disabled?: boolean
}
```

**自定义按钮文案 + 危险样式**：

```ts
await Webos.dialog.confirm({
  title: '永久删除',
  message: '即将永久删除 12 个文件，不可撤销。',
  icon: 'warning',
  confirmText: '永久删除',
  cancelText: '保留',
  danger: true,
})
```

### dialog.show（完全自定义按钮）

```ts
dialog.show<T>(options: AlertOptions): Promise<T>
```

resolve 出被点按钮的 `value`：

```ts
const action = await Webos.dialog.show<'save' | 'discard' | 'cancel'>({
  title: '保存修改？',
  message: '当前文档有未保存的修改。',
  icon: 'question',
  buttons: [
    { label: '不保存', value: 'discard', type: 'danger' },
    { label: '取消', value: 'cancel', type: 'secondary', cancel: true },  // Esc
    { label: '保存', value: 'save', type: 'primary', autoFocus: true },   // Enter
  ],
})
if (action === 'save') save()
```

### dialog.promptEx（带校验的 prompt）

```ts
dialog.promptEx(options: PromptInputOptions): Promise<{ button?: unknown; value: string | null }>

interface PromptInputOptions {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  buttons?: DialogButton[]
  confirmText?: string
  cancelText?: string
  validate?: (value: string) => true | string   // 返回 true / 空串通过，否则显示错误
}
```

```ts
const r = await Webos.dialog.promptEx({
  message: '邮箱',
  defaultValue: 'me@example.com',
  validate: (v) => /^[^@]+@[^@]+$/.test(v) || '邮箱格式不正确',
})
// r = { button: '__confirm__', value: 'me@example.com' } | { value: null }
```

### V1.5 待实现（当前调用会抛 NOT_IMPLEMENTED）

```ts
dialog.openFile(options?: OpenFileOptions): Promise<File | File[] | null>
dialog.saveFile(options?: SaveFileOptions): Promise<string | null>
dialog.pickDirectory(): Promise<string | null>
dialog.progress(options): ProgressHandle
dialog.properties(options: PropertiesOptions): Promise<void>
dialog.pickColor(options?): Promise<string | null>
dialog.pickFont(options?): Promise<string | null>
dialog.showQR(options): Promise<void>
```

---

## Webos.window

控制**当前应用自己**的窗口（不是别人的）。

### 状态控制

```ts
window.minimize(): Promise<void>
window.maximize(): Promise<void>
window.restore(): Promise<void>
window.close(): Promise<void>
window.setTitle(title: string): Promise<void>
window.setBadge(n: number | null): Promise<void>     // V1.5
window.setBusy(busy: boolean): Promise<void>
window.fullscreen(): Promise<void>                    // V1.5
```

### 尺寸 / 位置

```ts
window.setSize(width: number, height: number): Promise<void>
window.setBounds(bounds: Partial<WindowBounds>): Promise<void>
window.getBounds(): Promise<WindowBounds>
window.center(): Promise<void>

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}
```

```js
// 改尺寸
await Webos.window.setSize(800, 600)

// 改任意一个轴（不传的字段保持不变）
await Webos.window.setBounds({ width: 1200 })
await Webos.window.setBounds({ x: 50, y: 50 })

// 自适应内容大小（拿当前 bounds 后再算）
const bounds = await Webos.window.getBounds()
const content = document.querySelector('main')
await Webos.window.setSize(bounds.width, content.scrollHeight + 80)

// 居中（在桌面可视区内，自动避开顶栏）
await Webos.window.center()
```

### 综合示例

```js
await Webos.window.setTitle(`未保存 - ${docName}`)
await Webos.window.setBusy(true)
try {
  await heavyWork()
} finally {
  await Webos.window.setBusy(false)
}
```

---

## Webos.contextMenu

弹出上下文菜单（坐标系相对页面，不是相对 iframe 内部）。

```ts
Webos.contextMenu(options: ContextMenuOptions): Promise<string | null>

interface ContextMenuItem {
  label?: string                       // 不传 + 不传 children 表示分隔线（也可写 '-'）
  icon?: string
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  actionId?: string                    // 用户点中后 resolve 出来的标识
  children?: ContextMenuItem[]
}

interface ContextMenuOptions {
  items: ContextMenuItem[]
  x: number
  y: number
}
```

```js
document.addEventListener('contextmenu', async (e) => {
  e.preventDefault()
  const action = await Webos.contextMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      { actionId: 'copy', label: '复制', shortcut: 'Ctrl+C' },
      { actionId: 'paste', label: '粘贴', shortcut: 'Ctrl+V' },
      { label: '-' },
      { actionId: 'delete', label: '删除', danger: true },
    ],
  })
  if (action === 'copy') doCopy()
})
```

---

## Webos.download / upload

### download

立即触发浏览器下载。**不返回 Promise**——同步触发。

```ts
Webos.download(options: DownloadOptions): void

interface DownloadOptions {
  url: string
  filename?: string
}
```

### upload（V1.5）

```ts
Webos.upload(options: UploadOptions): Promise<UploadResult>
```

---

## Webos.user

跨应用共享的当前用户会话。所有应用读到的都是 webos shell 端 `UserSession` singleton 的同一份数据 —— 在登录应用 / 集成方 setSession 之后，**任意应用立即都能拿到 user 和 token**。

### 类型

```ts
interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  permissions?: string[]
  // 业务方扩展字段任意（只要能 JSON 序列化）
  [key: string]: unknown
}

// OAuth / OIDC 标准字段
interface TokenInfo {
  accessToken: string         // 必填，调 API 时往 Authorization 头塞的就是它
  refreshToken?: string       // 用于换新 access token
  tokenType?: string          // 一般是 'Bearer'
  expiresAt?: number          // 过期时间（epoch ms）；不传表示不过期
  scope?: string              // 作用域
  idToken?: string            // OIDC id_token（含身份声明的 JWT）
  [key: string]: unknown      // 业务方扩展字段
}
```

### 读

```ts
user.current(): Promise<User | null>
user.permissions(): Promise<string[]>
user.token(): Promise<TokenInfo | null>          // 完整 token 对象
user.accessToken(): Promise<string | null>       // 便利：只取 accessToken 字段
user.isTokenExpired(): Promise<boolean>          // 便利：基于 expiresAt 判断是否过期
```

未登录 / 无 token → 都返回 `null` / 空数组。

调 API 时常见用法：

```ts
const accessToken = await Webos.user.accessToken()
const resp = await fetch('/api/x', {
  headers: { Authorization: `Bearer ${accessToken}` },
})
```

### 写

```ts
user.set(payload: { user: User; token?: TokenInfo | null }): Promise<void>
user.clear(): Promise<void>                              // 登出
user.setUser(user: User | null): Promise<void>           // 仅更新 user（资料 / 头像变化；token 保持）
user.setToken(token: TokenInfo | null): Promise<void>    // 仅刷新 token（user 保持）
```

**典型场景 —— 登录应用**：

```ts
// OAuth / SSO 回调
const oauth = await fetch('/api/sso/callback?code=...').then(r => r.json())
// oauth: { access_token, refresh_token, expires_in, token_type, scope, id_token }

await Webos.user.set({
  user: {
    id: '42', name: 'Alice', email: 'alice@x.com',
    permissions: ['read', 'write'],
  },
  token: {
    accessToken: oauth.access_token,
    refreshToken: oauth.refresh_token,
    tokenType: oauth.token_type,                       // 'Bearer'
    expiresAt: Date.now() + oauth.expires_in * 1000,   // expires_in 秒 → epoch ms
    scope: oauth.scope,
    idToken: oauth.id_token,
  },
})
// 之后 webos 内所有应用通过 Webos.user.current() / token() 立即能拿到
```

**refresh token 流程**：

```ts
const cur = await Webos.user.token()
if (cur && (await Webos.user.isTokenExpired())) {
  const r = await fetch('/api/sso/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: cur.refreshToken }),
  }).then(r => r.json())

  await Webos.user.setToken({
    ...cur,
    accessToken: r.access_token,
    expiresAt: Date.now() + r.expires_in * 1000,
    // refresh-token-rotation：刷新接口可能下发新的 refreshToken
    refreshToken: r.refresh_token ?? cur.refreshToken,
  })
}
```

**登出**：

```ts
await Webos.user.clear()
location.reload()  // 或 router.push('/login')
```

> **安全提示**：set / clear / setToken 没做权限校验，任何应用都能调。生产环境如需限制，使用方在 webos shell 端覆盖对应 handler，校验 `source.appId` 是否在白名单内。

### 订阅变化

```ts
user.on(event: 'change',
  handler: (payload: { user: User | null; token: TokenInfo | null }) => void
): () => void
```

```ts
const off = Webos.user.on('change', ({ user, token }) => {
  if (user === null) router.push('/login')
  else {
    store.setUser(user)
    apiClient.setBearerToken(token?.accessToken ?? null)
  }
})
// 卸载时
off()
```

事件触发条件：`set()` / `clear()` / `setToken()` 任一调用都会发。SDK 内部走 `Webos.events.on('user.changed')`，所以你也可以直接用 events.on 监听。

### 持久化

`UserSession` 默认把 user / token 写到 localStorage（key `webos:user.session`），刷新页面后自动恢复。Token 敏感场景下 webos shell 集成方可关掉持久化：

```ts
import { UserSession } from '@webos/shell'
UserSession.instance.setPersist(false)  // 不再落 localStorage
```

### 同 origin 登录页 / 单一真实来源

如果有一个**同 origin** 的独立登录页（`/login.html`，与 webos 主程序同协议 + 同域 + 同端口），它**无法走 postMessage RPC**（没有父窗口）。这种场景直接用 SDK 暴露的 session 纯函数写 localStorage，webos 启动时 `UserSession` 会从同一个 key 自动读出来：

```ts
import {
  writeWebosSession,    // 同时写 user + token
  writeWebosUser,       // 仅 user
  writeWebosToken,      // 仅 token
  readWebosSession,     // 读
  clearWebosSession,    // 清
  hasWebosSession,      // 是否已登录
} from '@webos/host-sdk'

// 登录页
const r = await fetch('/api/login', ...).then(r => r.json())
writeWebosSession({
  user: { id: r.id, name: r.name, ... },
  token: { accessToken: r.access_token, refreshToken: r.refresh_token,
           expiresAt: Date.now() + r.expires_in * 1000 },
})
location.href = '/'   // 跳到 webos
```

> **架构上**：`writeWebosSession` 等纯函数 = `Webos.user.set` 等 RPC 方法 = `UserSession.instance.set` shell 内部调用，**底层走的同一个 localStorage key + 同一份 JSON 格式**。所以登录页 / RPC / 主程序内部任意一处的写入，**其它两处都立即可见**（刷新页面后 UserSession 重新从 LS 读）。

---

## Webos.requestPermission

申请权限（V1：弹确认对话框由用户授权）。

```ts
Webos.requestPermission(options: { permissions: string[]; reason?: string }): Promise<boolean>
```

```js
const ok = await Webos.requestPermission({
  permissions: ['camera', 'mic'],
  reason: '会议室签到需要拍照',
})
if (!ok) return
```

---

## Webos.theme

```ts
theme.current(): Promise<'light' | 'dark'>
theme.set(name: 'light' | 'dark' | 'auto'): Promise<void>
theme.on(event: 'change', handler: (theme: 'light' | 'dark') => void): () => void
theme.getTokens(): Promise<Record<string, string>>     // 读 :root 的 --webos-* CSS 变量
```

```js
const off = Webos.theme.on('change', (t) => {
  document.body.dataset.theme = t
})
// 卸载时
off()
```

---

## Webos.storage

应用维度的 KV 存储（V1：底层用桌面壳侧的 localStorage，按 appId 隔离）。

```ts
storage.get<T>(key: string): Promise<T | null>
storage.set(key: string, value: unknown): Promise<void>
storage.remove(key: string): Promise<void>
storage.clear(): Promise<void>
```

值会被 JSON 序列化，最大不要超过 ~5MB。

---

## Webos.apps

```ts
apps.list(): Promise<AppMeta[]>
apps.listEntries(filter?: { showIn?: 'desktop' | 'start-menu' | 'app-store' }): Promise<EntryMeta[]>
apps.open(appId: string, options: OpenOptions): Promise<void>
apps.has(appId: string, entryId?: string): Promise<boolean>

interface AppMeta {
  appId: string
  name: string
  icon?: string
  version?: string
}

// 入口维度，含所属 app 的 appId / appName 扁平字段
interface EntryMeta {
  appId: string
  appName: string
  appIcon?: string
  id: string             // entry id
  name: string
  icon?: string
  uri: string
  description?: string
  launchMode?: 'window' | 'tab'
  showIn?: ('desktop' | 'start-menu' | 'app-store')[]
  order?: number
  category?: string
  tags?: string[]
}

interface OpenOptions {
  entryId: string                       // 必填：打开哪个 entry
  feature?: string                      // 该 entry 内的 feature.id
  params?: Record<string, unknown>      // 透传给应用，URL 查询串
}
```

`apps.open` 必须显式传 `entryId`。`apps.list` 按应用维度返回；要在桌面 / 菜单上按图标渲染时用 `apps.listEntries()`。

```js
// 检查应用 + 某个 entry
if (await Webos.apps.has('text-editor', 'main')) {
  await Webos.apps.open('text-editor', {
    entryId: 'main',
    params: { path: '/tmp/x.txt' },
  })
}

// 仅检查应用（不限 entry）
if (await Webos.apps.has('text-editor')) { ... }

// 直达深链
await Webos.apps.open('com.acme.crm', {
  entryId: 'main',
  feature: 'new-customer',
})
```

`params` 会通过 URL 查询串传给目标应用。

---

## Webos.app（应用自身）

应用查询**自身**启动信息（与 `Webos.apps.*` 区分：那个是查"所有应用"）。

```ts
app.bootInfo(): Promise<AppBootInfo>
app.onNavigate(handler: (payload: { feature?: string; uri?: string; params?: Record<string, unknown> }) => void): () => void

interface AppBootInfo {
  appId: string
  entryId: string                    // 当前是哪个 entry
  feature?: string                   // 启动时若指定了 feature，这里给出 id
  uri?: string                       // 实际加载的 URL（含 feature.uri / params）
  params?: Record<string, unknown>   // 启动时透传的 params
}
```

用途：应用启动后第一时间问"我是哪个 entry、是不是被某个 feature 唤起的、有没有外部 params"，做对应的初始路由。

```ts
import { Webos } from '@webos/host-sdk'

async function main() {
  const info = await Webos.app.bootInfo()
  console.log('我是', info.appId, '/', info.entryId)

  if (info.feature === 'reports') {
    router.push('/reports/sales')
  } else if (info.params?.docId) {
    router.push(`/docs/${info.params.docId}`)
  } else {
    router.push('/')
  }
}

// 已运行时被点搜索结果跳转：用 onNavigate 监听
Webos.app.onNavigate(({ feature, uri }) => {
  router.push(uri ?? '/')
})
```

---

## Webos.contributes

用于跨应用 UI 嵌入：宿主应用查询"哪些应用想嵌进我的某个 slot"。

```ts
contributes.list(filter: { host: string; slot?: string }): Promise<ContributedExtension[]>

interface ContributedExtension {
  appId: string                  // 提供方 appId（框架注入）
  appName: string
  entryId: string                // 提供方对应的 entry
  host: string                   // 与查询条件一致，原样带回
  slot: string
  uri?: string                   // 扩展点声明了 uri 才有：host 已解析的完整 URL
  label?: string                 // host UI 上显示的文字（业务字段，可选）
  icon?: string
  description?: string
  [key: string]: unknown         // 扩展点里的其余任意业务属性，原样带回
}
```

```ts
// 宿主应用：让用户在"设置 → 插件"页看到所有声明扩展我的应用
const exts = await Webos.contributes.list({
  host: 'example-extensible-host',
  slot: 'settings.tabs',
})
for (const ext of exts) {
  // 在 host 自己的 UI 里渲染 iframe(src=ext.uri)，或显示一个跳转按钮
}
```

**契约约定**：

- `host` / `slot` 是宿主和扩展之间的字符串协议（host 文档应公开自己支持哪些 slot）
- 提供方的 manifest 需要声明 `contributes.extensionPoints[*]`，详见 [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md) §4.3
- 扩展点除 `host` / `slot` / `entryId` 外可带任意业务属性（`label` / `icon` / 自定义字段），`list()` 原样带回；`uri` 给了才解析、不给则不带

---

## Webos.message

应用 ↔ 应用 单播消息。

```ts
message.send(targetAppId: string, message: unknown): Promise<void>
message.on(handler: (message: unknown, fromAppId: string) => void): () => void
```

```js
// 发送方
await Webos.message.send('chat', { type: 'mention', text: '@老王' })

// 接收方
const off = Webos.message.on((msg, from) => {
  console.log('from', from, msg)
})
```

---

## Webos.events

全局事件广播。**所有应用**都能收到。

```ts
events.emit(event: string, payload?: unknown): Promise<void>
events.on(event: string, handler: (payload: unknown) => void): () => void
```

```js
// 广播配置变更，让所有相关应用响应
await Webos.events.emit('config.changed', { key: 'locale', value: 'en' })

// 订阅
Webos.events.on('config.changed', (payload) => {
  if (payload.key === 'locale') location.reload()
})
```

webos 内部已经默认广播：

| 事件 | 时机 | payload |
|------|------|---------|
| `theme.changed` | 主题切换时 | `{ theme: 'light' \| 'dark' }` |
| `app.navigate` | 已运行的应用被全局搜索 / `apps.open({ entryId, feature })` 触发深链跳转；推荐用 `Webos.app.onNavigate()` 订阅 | `{ feature?: string; uri?: string; params?: Record<string, unknown> }` |

---

## Webos.system

```ts
system.info(): Promise<SystemInfo>
system.openSettings(panel?: string): Promise<void>     // V1.5
system.search(query: string): Promise<void>            // 打开全局搜索

interface SystemInfo {
  version: string
  platform: string
  locale: string
  theme: 'light' | 'dark'
  userAgent: string
}
```

---

## Webos.configure / Webos.client

调整默认 RpcClient。

```ts
Webos.configure(options: {
  target?: Window           // 默认 window.parent
  appId?: string            // 默认从 URL/document 推断
  timeout?: number          // 默认 30000
  debug?: boolean           // 控制台打印每个请求/响应
}): void

Webos.client: RpcClient    // 高级用法：直接调 client.call(module, method, args)
```

```js
Webos.configure({ timeout: 60000, debug: true })

// 调一个未被 SDK 包装的自定义模块
const r = await Webos.client.call('myModule', 'doSomething', { foo: 1 })
```

---

## 错误码

RPC 失败时 reject 出来的对象一般形如 `{ message, code? }`。常见 code：

| code | 含义 |
|------|------|
| `NOT_IMPLEMENTED` | 方法未实现（dialog.openFile 等 V1.5 项） |
| `INVALID_ARGS` | 参数不合法 |
| `PERMISSION_DENIED` | 权限被拒 |
| `TIMEOUT` | RPC 超时（超过 `timeout`） |
| `INTERNAL` | 桌面壳内部错误 |

```js
try {
  await Webos.dialog.openFile()
} catch (err) {
  if (err.code === 'NOT_IMPLEMENTED') {
    Webos.notify({ title: '功能即将上线', level: 'info' })
  } else {
    throw err
  }
}
```

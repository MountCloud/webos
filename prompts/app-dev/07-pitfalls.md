# 07 · 应用层踩坑

应用方接入 webos 时常见的"为啥 X 不工作"。

---

## 1. SDK 调用全部超时 / `RPC timeout`

**症状**：每个 `Webos.xxx.foo()` 30s 后 reject，message: `[webos] RPC timeout: xxx.foo`。

**可能原因**：

| 原因 | 排查 |
|------|------|
| 应用没在 webos shell 里跑（直接打开应用 URL） | `window.parent === window` 就是独立模式。检查 `window.parent !== window` |
| 应用对应的 entry 是 `launchMode: 'tab'` | tab 模式没父窗口，SDK 永远不通。把 `entries[i].launchMode` 改成 `'window'`（默认） |
| webos shell 端没注册对应 handler | 罕见 —— 只有调自定义 module 才会发生 |
| 父 window 还没初始化完 | 应用启动太快，webos shell 还没 install AppMessageBus。延后到 `window.addEventListener('load')` 之后再调 |

打开 `Webos.configure({ debug: true })` 看控制台 RPC 请求记录，没看到 `←` 响应就是父端没收到。

---

## 2. fetch 跨域

webos 没法替你解决跨域。**应用方自己**：
- 后端开 CORS（推荐）
- 应用部署在与后端同 origin 下
- 用代理（Vite dev 用 `server.proxy`）

---

## 3. cookie 不共享 / 鉴权失败

**症状**：iframe 里 `fetch('/api/x')` 返回 401，但浏览器主标签里同样请求 200。

**根因**：跨 origin iframe 默认**不发 cookie**。

**解决**：
- 用 `credentials: 'include'`（需要后端 CORS allow-credentials）
- 或者**别用 cookie**，用 webos 的 `Webos.user.token()` 拿 access token 自己塞 `Authorization: Bearer ...`（推荐）

---

## 4. Iframe 沙箱限制

webos 默认对 iframe 不加严格 sandbox。但如果集成方加了 `sandbox` 属性，应用某些能力可能失败：

| 失败的功能 | sandbox 缺的能力 |
|-----------|------------------|
| `window.open` | `allow-popups` |
| `<form>` 提交 | `allow-forms` |
| `localStorage` | `allow-same-origin` |
| 弹通知（notification API）| `allow-modals` |
| 剪贴板 / 全屏 | `allow-clipboard-*` / 集成方在 manifest 加 `allow` |

如果遇到 `Blocked by sandbox` 错误，让集成方调 webos shell 配置加上对应权限。

---

## 5. `Webos.window.setSize` 改不了大小

**可能原因**：

- manifest 里 `entries[i].defaultWindow.resizable: false` —— 应用被声明为不可缩放
- 设置的尺寸超过屏幕 —— webos shell 自动 clamp 到可见区
- 改之前先 `getBounds()` 看当前值，确认调用真的发生了

---

## 6. `Webos.user.current()` 返回 null（明明已登录）

**可能原因**：

- 登录页写的是**不同 origin** 的 LS（不是 webos shell 的 origin）→ webos 启动时读不到
- 登录页 / webos shell 不是真同 origin（`http://app.com` vs `https://app.com` / `app.com` vs `www.app.com` 都算不同）
- 登录页的 LS 写法不对（key 应该是 `'webos:user.session'`）。**必须用 `writeWebosSession()` 而不是自己拼**
- webos shell 集成方调了 `UserSession.instance.setPersist(false)` —— LS 不持久化，刷新就丢

---

## 7. token 一直显示已过期

```ts
await Webos.user.isTokenExpired()  // 永远 true
```

**根因**：`expiresAt` 没设置或者设错。

```ts
// ❌ expires_in 是相对秒数，不是绝对时间
expiresAt: r.expires_in

// ✅
expiresAt: Date.now() + r.expires_in * 1000
```

---

## 8. 主题切换后我的应用没跟着变

webos shell 切深浅模式 → broadcast `theme.changed` → 你需要**自己订阅**：

```ts
Webos.theme.on('change', (theme) => {
  document.documentElement.dataset.theme = theme
})
```

React + MUI 应用用 `<WebosThemeProvider>` 自动同步。

---

## 9. 全局搜索找不到我应用的子功能

**检查**：
- manifest 的 `entries[i].features` 字段下有这些 feature 吗？（features 归属于 entry，不在顶层）
- `keywords` 写了中英文搜索词吗？
- 应用 manifest 注册到 webos 了吗？（看 `Webos.apps.list()` 是否包含；或 `Webos.apps.listEntries()`）

详见 [03-manifest.md](./03-manifest.md)。

---

## 10. 已运行的应用被深链调起后没跳页

**症状**：用户在 webos 全局搜索点了我应用的 "新建客户" 子功能，应用已经开了，但停留在原页面。

**根因**：你没监听 `app.navigate` 事件。

```ts
// 推荐：用 Webos.app.onNavigate（事件 payload 同 events.on('app.navigate')）
Webos.app.onNavigate(({ feature, uri }) => {
  router.push(uri ?? '/')   // 自家路由
})
```

应用未运行时，URL 直接是 `entry.uri + feature.uri`，应用按 URL 启动正常路由。**已运行时不会重 load**，必须订阅事件。

---

## 11. `Webos.message.send` 静默失败

**根因**：目标应用没运行 / 没监听。

```ts
// 检查目标是否在跑
const running = await Webos.apps.list()
if (!running.find((a) => a.appId === 'mail')) {
  // 启动它再发？或换种方式？
}
```

---

## 12. dialog.show 自定义按钮 type 不显示样式

**根因**：`type` 字段拼错了。合法值只有 `'primary' | 'secondary' | 'danger'`。

```ts
// ❌
{ label: 'X', type: 'warning' }   // 不存在的 type，按 secondary 渲染

// ✅
{ label: 'X', type: 'danger' }    // 红色
```

---

## 13. 通知 toast 太多了把屏幕堆满

webos 同屏最多 5 条 toast，超出关掉最旧的。但**不要写循环 notify**：

```ts
// ❌
for (const e of errors) Webos.notify({ title: e })

// ✅
Webos.notify({ title: '错误', message: `共 ${errors.length} 个错误：\n${errors.join('\n')}`, level: 'critical' })
```

---

## 14. UMD 模式下 `Webos` undefined

UMD bundle 注入的是 `window.Webos`。检查：

```html
<script src=".../host-sdk.umd.js"></script>
<script>
  // ✅
  window.Webos.notify({ title: 'Hi' })

  // ❌ 在 module 类型 script 里
  // <script type="module"> 里 window.Webos 也能拿到，但建议直接 import
</script>
```

如果 UMD 加载失败，看 Network 面板请求是否 200。

---

## 15. dev server 起来了但 webos 里加载白屏

**根因**：

| | |
|--|--|
| iframe URL 不对 | manifest 的 `entries[i].uri` 指 `http://localhost:5503/`，但应用跑在 `5504` |
| 应用 dev server 设了 host 限制 | Vite 默认 `localhost`，集成方桌面壳访问可能要 `0.0.0.0` |
| 应用 dev server CORS 拒绝 iframe | 通常 dev server 没这限制，生产可能有 |
| X-Frame-Options: DENY | 服务端 header 拒绝 iframe 嵌入；改 `SAMEORIGIN` 或 `ALLOW-FROM webos-origin` |

---

## 16. PWA 应用接入 webos 的 service worker 冲突

webos shell 未来可能自带 sw。如果你的应用 register 了 sw 在自家 scope，**不冲突**（每个 origin 独立 sw）。

注意：**同 origin 多 SPA 共享 sw 时**别覆盖 webos shell 的（如果有的话）。建议自家 sw scope 限制：

```ts
navigator.serviceWorker.register('/sw.js', { scope: '/my-app/' })
```

---

## 17. 我想调一个 SDK 没暴露的桌面壳能力

SDK 覆盖了大部分桌面壳能力。如果发现缺了：

1. 提 issue
2. 或者用底层 `Webos.client.call('module', 'method', args)` —— 但需要 webos shell 端先实现 handler（你做不到，要让维护方加）
3. 走"自定义 RPC handler" —— 让集成方在 webos shell 启动时注册一个自家 handler：

```ts
// webos shell 集成方的代码
import { AppMessageBus } from '@webos/shell'

AppMessageBus.instance.registerHandler('myCompany', 'doSomething', async (req, source) => {
  if (source.appId !== 'my-trusted-app') throw new Error('Unauthorized')
  return await doInShell(req.args)
})
```

应用方调：

```ts
const r = await Webos.client.call('myCompany', 'doSomething', { foo: 1 })
```

---

## 18. iframe reload 后 SDK 之前的 pending 调用丢失

**正常**：iframe reload = SDK 重新 install = 之前的 RpcClient 实例销毁 = pending Promise 永远 pending。

应用方做法：reload 是用户主动的，没必要保留 pending 操作。如果要重要操作（如保存）跨刷新继续，**先存 LS 再 reload**。

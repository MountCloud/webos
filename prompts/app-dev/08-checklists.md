# 08 · 应用方 Checklist

应用方接入 webos / 上线前对照逐项验。

---

## ✅ 接入前 checklist（写代码前确认）

- [ ] 决定 `launchMode`：`window`（默认，要 SDK 能力）/ `tab`（大屏 / 第三方门户）
- [ ] 决定栈：React + MUI（生产推荐）/ Vue / Vanilla / jQuery
- [ ] 列出要用的 SDK 模块（notify / dialog / window / user / message / events / theme / storage / app）
- [ ] 列出 manifest 必填字段：`appId / name / icon / entry`
- [ ] 设计应用内 features 子功能（如果有）
- [ ] 确认是否同 origin 部署（影响登录页接入方式）

---

## 📝 接入完成 checklist（写完代码逐项验）

### SDK 接入

- [ ] `pnpm add @webos/host-sdk` 装好
- [ ] React + MUI 还装了 `@webos/mui-theme @mui/material @emotion/react @emotion/styled`
- [ ] 调一次 `Webos.notify({ title: 'Hello' })` 能弹通知
- [ ] 在 webos 里跑 vs 独立打开都能 boot（独立时 SDK 调用走 try/catch）

### Manifest

- [ ] `appId` 唯一（不冲突已有应用）+ 符合正则 `/^[a-zA-Z0-9_.-]+$/`
- [ ] `icon` 已上传 / 已嵌入 Data URI
- [ ] `entry` URL 可访问
- [ ] `defaultWindow` 大小合理（不超屏 / 不太小）
- [ ] `permissions` 列全实际用到的权限
- [ ] `showIn` 决定显示位置（desktop / start-menu）
- [ ] `singleInstance` 适合的应用打开（如关于页 / 设置页）

### 用户身份

- [ ] 启动时 `Webos.user.current()` 检查登录态
- [ ] 未登录跳 `/login.html`
- [ ] API 请求带 `Webos.user.accessToken()`
- [ ] 401 时尝试 refresh token
- [ ] 监听 `Webos.user.on('change', ...)` 处理被登出

### 子功能（如果有 features）

- [ ] manifest 里 `features` 字段写完整（id / name / uri / keywords）
- [ ] 应用启动时 `Webos.app.bootInfo()` 拿首次进入的 feature
- [ ] 监听 `Webos.events.on('app.navigate', ...)` 处理已运行时深链

### 主题同步

- [ ] React + MUI：套 `<WebosThemeProvider>`
- [ ] 其他栈：订阅 `Webos.theme.on('change')` 自己改 CSS

### 错误处理

- [ ] 全局 `error` / `unhandledrejection` 走 `Webos.notify` 兜底
- [ ] API 失败有用户可见的反馈
- [ ] 长任务带 `Webos.window.setBusy(true/false)`

### React 必检

- [ ] 所有 `Webos.xxx.on(...)` 在 `useEffect` 里 + `return off`
- [ ] 异步初始化 effect 用 `cancelled` flag 防 stale state
- [ ] SDK 调用包成 React Query / SWR（推荐）

---

## 🧪 测试 checklist

- [ ] 在 webos 里启动应用 → 桌面图标 / 开始菜单 / 全局搜索三个入口都能找到
- [ ] 双击图标打开 → 看到应用内容
- [ ] 拖窗口、缩放窗口、最大化、最小化、关闭都正常
- [ ] dock 上点应用图标 → 切换 / 最小化 / 关闭都对
- [ ] 切换 webos 主题（右上角 ⚙）→ 应用跟着变深 / 浅
- [ ] Cmd+K 搜索应用名能找到 → 启动
- [ ] Cmd+K 搜索 features 名能找到 → 跳到对应页面
- [ ] 应用弹的通知 / 对话框观感跟桌面一致
- [ ] 退出登录（右上角 👤）→ 应用收到 `user.changed (null)` → 跳登录页

---

## 🚀 上线前 checklist

- [ ] 关掉 `Webos.configure({ debug: true })` 调试日志
- [ ] 应用 build 是生产模式（无 source map / 已压缩 / tree-shaken）
- [ ] CDN 资源稳定（icon / 图片 / 字体）
- [ ] manifest 在生产环境的 `JsonAppSource` URL 已发布
- [ ] webos shell 能拉到 manifest（看 Network）
- [ ] HTTPS / 同 origin 部署（如果走登录页共享 LS）
- [ ] CORS 配好（fetch API 要从 iframe 里调通）
- [ ] **不要**在 manifest 把 dev URL（localhost:5xxx）发到生产
- [ ] 错误监控接入（Sentry / 自家系统）

---

## 📦 manifest 提供方式

让 webos 集成方拿到你的 manifest 三种方式：

### A. 内嵌发给集成方

写好 `manifest.json`，发给集成方，他们手动加到 webos shell 的代码里：

```ts
import myAppManifest from './apps/com.acme.crm/manifest.json'
AppRegistry.instance.addSource(new StaticAppSource([myAppManifest]))
```

适合：少量应用 / 内部团队

### B. JSON URL（推荐）

你部署 `https://crm.acme.com/manifest.json`，集成方加一条：

```ts
AppRegistry.instance.addSource(new JsonAppSource('https://crm.acme.com/manifest.json'))
```

适合：你想自己控制 manifest 更新，不需要集成方改 webos 代码

### C. 应用商店聚合 API

你的后端给 `/api/apps?user_id=xxx` 返回 `[manifest1, manifest2]`，按用户权限过滤。

适合：SaaS 多应用场景，需要按用户动态过滤

---

## 🎯 性能优化 checklist

- [ ] 应用首屏 LCP < 2.5s（Lighthouse）
- [ ] manifest icon 用 SVG / WebP，不超 50KB
- [ ] iframe 内不调 SDK 风暴（不要循环里 await）
- [ ] 跨应用消息不传大 blob（用 URL）
- [ ] 长列表用虚拟滚动（react-window / vue-virtual-scroller）
- [ ] 路由懒加载（react.lazy / vue defineAsyncComponent）

---

## 🔒 安全 checklist

- [ ] **不**把 access token 写进 LS / sessionStorage 自管 —— 用 `Webos.user.token()` 共享
- [ ] **不**信任 `Webos.message.on` 收到的消息 —— type guard
- [ ] **不**把敏感数据放在 iframe 间共享的 LS（`Webos.storage` 已按 appId 隔离，但仍是 LS）
- [ ] CSP（Content-Security-Policy）配置允许 iframe 加载 SDK CDN（如果用 UMD）
- [ ] HTTPS only（避免 token 在网络上明文）

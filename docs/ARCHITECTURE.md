# webos 架构总览

> **作者**：MountCloud `<mountcloud@outlook.com>`
> **状态**：已实现 —— 顶栏胶囊 + 顶部居中 dock + 全屏 launcher + 子功能搜索 + launchMode tab + manifest entries 多入口 + contributes 扩展点

---

## 一、整体架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                  浏览器（webos-shell SPA）                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  入口（main.ts）                            │  │
│  │  - i18n 初始化 + 主题应用                                    │  │
│  │  - AppMessageBus.install() + registerBuiltinHandlers       │  │
│  │  - 创建 Desktop / Taskbar                                  │  │
│  │  - 注册内置应用到 AppRegistry                                │  │
│  │  - 启动 NotificationCenter / GlobalSearch                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            Shell（外壳层）                                   │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────┐ ┌───────────────┐       │  │
│  │  │ Desktop │ │ Taskbar  │ │Start │ │NotificationCtr│       │  │
│  │  │ + Icons │ │          │ │Menu  │ │               │       │  │
│  │  └─────────┘ └──────────┘ └──────┘ └───────────────┘       │  │
│  │  ┌──────────────┐                                          │  │
│  │  │ GlobalSearch │  Cmd/Ctrl + K                            │  │
│  │  └──────────────┘                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            Core（内核层）                                   │  │
│  │                                                            │  │
│  │  Window 子系统                                              │  │
│  │  ┌──────────────┐ ┌────────┐ ┌───────────┐                │  │
│  │  │WindowManager │ │ Window │ │ AppWindow │                │  │
│  │  │  (singleton) │ │        │ │ (iframe)  │                │  │
│  │  └──────────────┘ └────────┘ └───────────┘                │  │
│  │       └─→ interact.js（拖拽 / 调整大小）                    │  │
│  │                                                            │  │
│  │  Dialog 子系统                                              │  │
│  │  ┌─────┐┌──────┐┌────────┐┌──────────┐┌──────┐            │  │
│  │  │alert││prompt││confirm ││Notification││Menu │            │  │
│  │  └─────┘└──────┘└────────┘└──────────┘└──────┘            │  │
│  │                                                            │  │
│  │  Apps 子系统                                                │  │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────┐│  │
│  │  │AppRegistry │ │ AppLoader  │ │AppMessageBus │ │AppSource││  │
│  │  │            │ │  (iframe)  │ │  (RPC bus)   │ │ 多实现 ││  │
│  │  └────────────┘ └────────────┘ └──────────────┘ └────────┘│  │
│  │                                                            │  │
│  │  UIElement (基类) - 生命周期 + 事件                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │      theme / i18n / util / helpers / 第三方                 │  │
│  │  ThemeRegistry · I18n · EventEmitter · interact.js ...    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ iframe (postMessage RPC)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  应用 iframe（任何 web 应用）                       │
│                                                                  │
│  应用代码（任何栈：Vanilla / Vue / React / jQuery / WASM）         │
│           ↓                                                      │
│  @webos/host-sdk（postMessage 包装）                              │
│           ↕                                                      │
│  通信协议（webos.request / webos.response / webos.event）         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、模块分层

### Layer 0：基础工具

- `util/EventEmitter.ts` —— 类型安全的事件发射器，所有 UI 类继承
- `helpers/` —— DOM 操作、touch position、download 触发
- `i18n/` —— zh / en，自动检测 `navigator.language`

### Layer 1：UI 基础设施（无业务）

- `core/UIElement.ts` —— UI 基类（mount / unmount / destroy + addDisposer / addDomListener）
- `core/dialog/` —— alert / confirm / prompt / contextMenu / notify

### Layer 2：窗口 + 桌面 + Dock

- `core/window/`
  - `Window` —— 浮动窗口（拖拽 / 4 边 + 4 角缩放 / 最大化 / 最小化 / 关闭 / setSize / setBounds / center）
  - `AppWindow` —— iframe 容器，加载 `entry.uri`（每个窗口绑定 `appId` + `entryId` 两个 dataset）
  - `WindowManager`（singleton）—— z-index 栈式重排、active 焦点
- `core/desktop/` —— 桌面背景 + 图标网格（左侧竖排，可调大小）+ 右键菜单
- `core/dock/` —— 顶部居中浮动 dock（一窗一项，空时整体隐藏）

### Layer 3：应用容器

- `apps/AppManifest.ts` —— manifest 校验（`entries[]` 多入口结构 + `contributes` 扩展点）
- `apps/AppRegistry.ts`（singleton）—— 注册中心，聚合多个 AppSource
- `apps/AppSource.ts` —— Static / Json / Composite 三种实现
- `apps/AppLoader.ts`（singleton）—— iframe 启动 + 跟踪（按 `appId:entryId` 复合 key 维护实例）+ bootInfo + tab 模式分支 + feature 路径拼接 + 已运行时推送 `app.navigate`
- `apps/AppMessageBus.ts`（singleton）—— postMessage RPC 路由 + 来源 appId 反查（防伪造）
- `apps/builtinHandlers.ts` —— 内置 14 模块 handler 注册

### Layer 4：Shell（外壳）

- `shell/TopLeftBar` —— 左上角胶囊：显示桌面 + 主菜单
- `shell/TopRightBar` —— 右上角胶囊：消息 / 用户 / 设置 / 搜索
- `shell/StartMenu` —— 全屏 launcher（Ubuntu / Synology DSM 风格）
- `shell/NotificationCenter` —— 通知中心 + 顶栏徽章
- `shell/GlobalSearch` —— Cmd+K，三段分组（应用 / 子功能 / 命令）
- `shell/SettingsPanel` —— 主题 / 桌面图标大小 / 语言
- `shell/UserMenu` —— 用户下拉，实时跟随 UserSession.change 事件刷新；点登出直接调 UserSession.clear

### Layer 5：主题 / i18n / 用户会话

- `theme/ThemeRegistry`（singleton）—— light / dark / auto + 注册自定义主题
- `i18n/I18n` —— 简单的字典 + locale 切换
- `user/UserSession`（singleton）—— 跨应用共享的当前用户 + token 状态；持久化底层走 `@webos/host-sdk` 暴露的 `writeWebosSession` 等纯函数，**同 origin 登录页 / RPC 处理器 / shell 内部调用** 走的是同一个 localStorage key + 同一份 JSON 格式

### Layer 6：入口

- `main.ts` —— bootstrap 流程

---

## 三、SDK 包

```
packages/host-sdk/
├── src/
│   ├── core/RpcClient.ts         # postMessage 客户端
│   ├── modules/                  # 14 个模块（notify / dialog / window / user / ...）
│   ├── session.ts                # ★ 同 origin 登录页 + shell UserSession 的共用底层（纯函数）
│   ├── core/types.ts             # 共用类型（User / TokenInfo / ...）
│   └── index.ts
├── rollup.config.js              # ESM + CJS + UMD + .d.ts
└── dist/
    ├── host-sdk.esm.js
    ├── host-sdk.cjs.js
    ├── host-sdk.umd.js
    └── host-sdk.d.ts
```

> **注意**：`apps/webos-shell` 把 `@webos/host-sdk` 作为 workspace 依赖，**用于复用 session 模块**（`writeWebosSession` / `writeWebosUser` / `writeWebosToken` / `readWebosSession` 等）。这样登录页 / shell 内部 / RPC 处理器三条路径走的都是同一个 localStorage key + 同一份 JSON 格式，**不会出现"shell 写的格式登录页读不出来"这种麻烦**。

```
packages/mui-theme/
├── src/
│   ├── theme.ts                  # createWebosTheme(options) → MUI Theme
│   ├── useWebosTheme.ts          # React hook，自动同步主题
│   ├── WebosThemeProvider.tsx    # 一行接入
│   └── tokens.ts                 # 与 webos-shell 同源的颜色 / 间距 token
└── dist/                         # ESM + CJS + .d.ts（peer: react / @mui/material / @webos/host-sdk）
```

---

## 四、关键设计决策

### 1. 单例 vs ServiceContainer

Phase 1 设想用 ServiceContainer + DI。**实际实现选择 singleton**——因为：

- webos 是单实例 SPA，DI 容器带来的复杂度收益不明显
- TS 强类型 + 静态 import 已经足够清晰
- `WindowManager.instance` 这种写法读起来比 `container.get(WindowManagerToken)` 自然得多

未来如果要支持"一个页面多个 webos 实例"才考虑加容器。

### 2. iframe 应用完全隔离

应用通过 iframe 加载 + postMessage 通信，带来：

- 应用栈完全自由（从 jQuery 到 WASM 都行）
- 应用崩溃不影响桌面壳
- 沙箱属性（`sandbox` 默认开启）天然限权
- **代价**：跨域 cookie / DOM 共享不可用，需通过 SDK 中转

### 3. AppSource 抽象

桌面壳不关心应用列表从哪来：

- `StaticAppSource(manifests[])` —— 内置 / 调试用
- `JsonAppSource(url)` —— 从后端拉
- `CompositeAppSource([...sources])` —— 多源聚合

后端可以根据用户权限返回不同列表，零代码改动支持企业 SaaS。

### 4. 主题 = CSS 变量

切换主题 = 改 `<html data-theme>`，浏览器自动重绘。零运行时开销，自定义主题门槛低（写一组 `--webos-*` 变量即可）。

详见 [THEME_DEVELOPER_GUIDE.md](./THEME_DEVELOPER_GUIDE.md)。

### 5. UIElement 基类 + 自动清理

```ts
class MyWidget extends UIElement {
  protected render() { ... }
  // addDomListener / addDisposer 在 destroy() 时自动反注册
}
```

避免内存泄漏的核心机制。所有 UI 类必须继承 UIElement，禁止自己 `addEventListener` 不带反注册。

---

## 五、模块体量

| 部位 | 文件数 | 行数（含注释） |
|------|--------|----------------|
| `core/window/` | 6 | ~1,200 |
| `core/desktop/` | 4 | ~700 |
| `core/taskbar/` | 3 | ~400 |
| `core/dialog/` | 5 | ~900 |
| `core/UIElement.ts` | 1 | ~140 |
| `apps/` | 7 | ~900 |
| `shell/` | 4 | ~700 |
| `theme/` | 2 | ~140 |
| `i18n/` | 2 | ~120 |
| `util/` + `helpers/` | 6 | ~250 |
| `styles/` | 6 SCSS | ~1,200 |
| `main.ts` | 1 | ~530 |
| **合计 webos-shell** | **~47** | **~7,200** |
| **packages/host-sdk** | ~17 | ~600 |

构建产物：

- webos-shell：163 KB JS / 21 KB CSS（gzip 后 51 KB / 5 KB）
- host-sdk ESM：15 KB
- host-sdk UMD：18 KB

---

## 六、消息协议

### 请求（应用 → 桌面壳）

```json
{
  "type": "webos.request",
  "id": "req-42",
  "module": "dialog",
  "method": "confirm",
  "args": { "message": "确定？", "title": "提示" },
  "appId": "my-app"
}
```

### 响应（桌面壳 → 应用）

```json
{
  "type": "webos.response",
  "id": "req-42",
  "ok": true,
  "data": true
}
```

失败时：

```json
{
  "type": "webos.response",
  "id": "req-42",
  "ok": false,
  "error": { "message": "...", "code": "PERMISSION_DENIED" }
}
```

### 事件（桌面壳 → 应用，主动推送）

```json
{
  "type": "webos.event",
  "event": "theme.changed",
  "payload": { "theme": "dark" }
}
```

完整模块清单见 [HOST_SDK_API.md](./HOST_SDK_API.md)。

---

## 七、数据流示例

### 应用调用 `Webos.dialog.confirm()`

```
应用 iframe                        桌面壳 main 窗口
   │                                    │
   │  Webos.dialog.confirm('删除?')     │
   │  ↓                                  │
   │  RpcClient.call('dialog','confirm',{message:'删除?'})
   │  ↓                                  │
   │  parent.postMessage({               │
   │    type:'webos.request',            │
   │    id:'r1', module:'dialog',        │
   │    method:'confirm',args:{...},     │
   │    appId:'my-app'                   │
   │  })                                 │
   │  ─────────────────────────────────→│
   │                                     │  AppMessageBus 收到
   │                                     │  路由到 dialog.confirm handler
   │                                     │  ↓
   │                                     │  调用 dialog.confirm()
   │                                     │  ↓ (用户点确定)
   │                                     │  ↓
   │  ←─────────────────────────────────  iframe.contentWindow.postMessage({
   │                                     │    type:'webos.response',
   │                                     │    id:'r1', ok:true, data:true
   │                                     │  })
   │  RpcClient 收到响应                  │
   │  ↓ resolve(true)                    │
   │  Promise<boolean> = true            │
```

---

## 八、与 Puter 的差异

| 维度 | Puter | webos |
|------|-------|-------|
| 语言 | JS（jQuery 全家桶） | TypeScript 5 严格模式 |
| 入口 | `initgui.js`（1932 行）| `main.ts`（~530 行）|
| UI 基类 | jQuery 插件 + AdvancedBase | TS class + EventEmitter + UIElement |
| 拖拽 / 缩放 | jQuery UI | interact.js |
| 模块组织 | 一目录平铺 49 文件 | 按职责分子目录 |
| 全局状态 | `window.xxx` 散落 | 类封装 + singleton |
| 单文件最大 | UIWindow 4406 行 | < 600 行 |
| 总代码量 | ~30,000 行 | ~7,800 行（含 SDK）|
| 业务功能 | 文件系统 / 桌面壁纸 / 用户体系 | 纯桌面壳 + SDK，业务上交 |

webos 是 Puter 的"内核抽离 + 现代化重写"，**不绑定任何业务**。

---

## 九、相关文档

- [HOST_SDK_API.md](./HOST_SDK_API.md) —— SDK 完整 API
- [APP_DEVELOPER_GUIDE.md](./APP_DEVELOPER_GUIDE.md) —— 应用开发者指南
- [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md) —— manifest 规范
- [THEME_DEVELOPER_GUIDE.md](./THEME_DEVELOPER_GUIDE.md) —— 主题开发指南
- [LEARNING_NOTES.md](./LEARNING_NOTES.md) —— Puter 阅读笔记
- [DESIGN.md](./DESIGN.md) —— 模块详细设计
- [TECH_STACK.md](./TECH_STACK.md) —— 技术栈选型

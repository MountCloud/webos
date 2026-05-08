# Puter 学习笔记

> 本文档记录从 Puter（`E:/project/html/puter/`）学习到的架构、设计、思路。
> webos 的实现"参考但不复制"这些发现。
>
> **作者**：MountCloud `<mountcloud@outlook.com>`

---

## Architecture（整体架构）

### 1. Puter 顶层目录

```
puter/
├── src/
│   ├── backend/         Node.js 后端服务（webos 不需要）
│   ├── gui/             ★ 前端桌面（webos 学习重点）
│   │   ├── package.json
│   │   ├── webpack.config.cjs
│   │   ├── build.js
│   │   ├── dev-server.js
│   │   └── src/
│   │       ├── index.js          入口（window.gui 函数定义）
│   │       ├── init_sync.js      同步初始化（global、use/def 注册表）
│   │       ├── init_async.js     异步初始化（resolve init_promise）
│   │       ├── initgui.js        ★ GUI 启动主流程（1932 行）
│   │       ├── globals.js        全局变量
│   │       ├── definitions.js    Service 基类、常量
│   │       ├── keyboard.js       键盘快捷键（908 行）
│   │       ├── IPC.js            iframe 应用通信（1974 行）
│   │       ├── UI/               ★ 所有 UI 组件
│   │       ├── services/         ★ 服务层（11 个）
│   │       ├── helpers/          通用工具函数
│   │       ├── util/             基类、Promise 工具
│   │       ├── lib/              第三方库（jquery 等）
│   │       ├── css/              样式
│   │       ├── i18n/             国际化
│   │       ├── icons/ images/    资源
│   │       └── extensions/       扩展机制
│   ├── puter-js/        Puter 自家 SDK（webos 不需要）
│   ├── dev-center/      Puter 应用商店（webos 不需要）
│   └── ……
```

### 2. UI/ 目录全景（49 个文件）

```
src/gui/src/UI/
├── ── 核心基础设施 ──
├── UIElement.js              基类（152 行）
├── UIWindow.js               ★ 窗口管理核心（4406 行）
├── UIComponentWindow.js      应用窗口容器（47 行）
├── UIDesktop.js              ★ 桌面外壳（2631 行）
├── UIItem.js                 通用图标项（1998 行）
├── UITaskbar.js              任务栏（763 行）
├── UITaskbarItem.js          任务栏项（527 行）
├── UIContextMenu.js          右键菜单（850 行）
├── UINotification.js         通知（168 行）
├── UIPopover.js              弹层（134 行）
├── UIAlert.js                Alert/Confirm（172 行）
├── UIPrompt.js               输入对话框（131 行）
├── PuterDialog.js            通用对话框框架
│
├── ── 通用对话框（webos 也需要）──
├── UIWindowProgress.js       进度窗口
├── UIWindowTaskManager.js    任务管理器
├── UIWindowItemProperties.js 属性窗口
├── UIWindowColorPicker.js + UIColorPickerWidget.js
├── UIWindowFontPicker.js
├── UIWindowDesktopBGSettings.js
├── UIWindowThemeDialog.js
├── UIWindowSearch.js
├── UIWindowSystemInfo.js
├── UIWindowFeedback.js
├── UIWindowRequestPermission.js
├── UIWindowQR.js + UIQRCode.js
│
├── ── Puter 业务专属（webos 全部不要）──
├── UIWindowLogin.js / UIWindowSignup.js
├── UIWindowSaveAccount.js / UIWindowEmailConfirmationRequired.js
├── UIWindowChangePassword.js / UIWindowChangeUsername.js
├── UIWindowNewPassword.js / UIWindowRecoverPassword.js
├── UIWindow2FASetup.js / UIWindowCopyToken.js
├── UIWindowManageSessions.js / UIWindowSessionList.js
├── UIWindowAuthMe.js / UIWindowMyWebsites.js
├── UIWindowPublishWebsite.js / UIWindowPublishWorker.js
├── UIWindowShare.js / UIWindowWelcome.js
├── UIWindowLoginInProgress.js
│
├── ── 子文件夹 ──
├── Components/               UI 小组件（Button/Flexer/StepView 等通用）
├── Dashboard/                Puter 业务（webos 不需要）
└── Settings/                 设置面板（部分通用）
```

### 3. Services 层架构

Puter 用了一个轻量"服务注册表 + 事件总线"模式：

```
globalThis.services = {
  get: (name) => services_m_[name],        // 取服务实例
  emit: (id, args) => { /* 广播事件 */ }    // 广播给所有服务
}

services 列表（11 个内置）:
- IPCService           应用 iframe 通信
- ExecService          应用启动
- DebugService         调试
- BroadcastService     跨 tab 广播
- ThemeService         主题切换
- ProcessService       进程管理（应用生命周期）
- LocaleService        国际化
- SettingsService      设置持久化
- AntiCSRFService      CSRF 防护
- LaunchOnInitService  初始化时自动启动应用
- ExportRegistrantService 暴露给应用的 API
```

**学习到的设计**：
- 服务用 `__on_<event>` 方法接收事件
- `globalThis.def(...)` 注册类、`globalThis.use(...)` 取类（用于服务脚本场景）
- 服务有 `_construct()` / `_init()` 生命周期
- 基类是 `AdvancedBase`（util/AdvancedBase.js），支持 trait 系统

**webos 的简化设计**：
- 同样需要服务模式（窗口管理 / 主题 / IPC / 设置 等）
- 可以用 TypeScript class + constructor injection，更简洁
- 不需要 trait 系统（用 mixin 或组合替代）

### 4. 启动流程（Bootstrap）

```
1. <script> 加载 dist/bundle.js
2. window.gui(options) 被调用
3. → init_sync.js 同步初始化（注册表、global）
4. → init_async.js 异步等待
5. → initgui.js 主流程：
     a. launch_services()           注册并初始化 11 个服务
     b. 用户认证检查（is_auth）       webos 不需要
     c. UIDesktop()                  渲染桌面
     d. 处理 URL 参数 / 自动启动应用
     e. 如果未登录 → UIWindowLogin   webos 不需要
6. 用户操作 → 走 UIWindow / UIDesktop / UITaskbar
```

**webos 启动简化**：
- 跳过用户认证（认证由使用方自己集成）
- 直接：load → init services → render desktop → 等待用户操作
- 服务列表精简：去掉 AntiCSRF / Account 相关，保留 IPC / Theme / Settings / Process / Locale

### 5. 关键发现

#### 5.1 jQuery 与 jQuery UI 是核心依赖
- UIWindow 大量用 `$.draggable()` / `$.resizable()` / `$.sortable()`
- UIDesktop 用 `$.dragster()` 做拖放
- 所有 DOM 操作都是 jQuery

**webos 的选择**：
- TypeScript + 现代 DOM API（不用 jQuery）
- 拖拽用 **interact.js**（比 jQuery UI 现代且功能强）
- 框选用 **viselect**（webos 自己也可以学这个用法）

#### 5.2 Window 用全局 z-index 管理多窗口
```javascript
window.last_window_zindex++;
window.window_stack.push(win_id);
```

**webos 设计**：用 `WindowManager` 类封装，不用全局变量。

#### 5.3 应用 = iframe + IPC
- 应用就是一个 URL，加载到 iframe
- iframe 与桌面通过 `postMessage` 通信
- 协议封装在 `IPC.js`（1974 行）

**webos 设计**：完全继承这个思路，但 IPC 协议自己重设计（更现代、有 TypeScript 类型）。

#### 5.4 用户系统、文件系统贯穿全代码
- `window.user` / `window.home_path` / `window.socket` 散落各处
- 这部分 webos 全部不要

**webos 设计**：完全无用户系统、无文件系统的概念。应用要用，自己接。

#### 5.5 国际化用 `i18n('key')` 函数
- 全局函数 `i18n('window_click_to_go_back')`
- 所有 UI 文案都过这个函数

**webos 设计**：保留这个简洁的设计，但实现成 `t('key')`（更短）+ TypeScript 类型保证 key 存在。

#### 5.6 主题切换通过 CSS 变量
- `theme.css` 24 行就是一堆 CSS 变量
- 切换主题就是改 CSS 变量

**webos 设计**：完全继承，主题包就是一组 CSS 变量。

### 6. 整体架构图（webos 设计参考）

```
┌────────────────────────────────────────────────────────┐
│            Browser (webos-shell SPA)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  入口 main.ts                                      │  │
│  │    ↓                                              │  │
│  │  ServiceContainer (服务注册表)                     │  │
│  │  ├─ ThemeService                                  │  │
│  │  ├─ SettingsService                               │  │
│  │  ├─ ProcessService（应用生命周期）                  │  │
│  │  ├─ IPCService（iframe 通信）                       │  │
│  │  ├─ LocaleService（i18n）                           │  │
│  │  ├─ AppRegistry（应用清单源）                        │  │
│  │  └─ NotificationService                            │  │
│  │    ↓                                              │  │
│  │  Desktop (桌面)                                    │  │
│  │  ├─ DesktopBg                                     │  │
│  │  ├─ IconGrid                                      │  │
│  │  ├─ TopBar                                        │  │
│  │  ├─ Taskbar                                       │  │
│  │  ├─ NotificationCenter                            │  │
│  │  └─ WindowManager → 多个 Window 实例                │  │
│  │       └─ AppWindow (含 iframe)                     │  │
│  │             ↕ postMessage                          │  │
│  │           应用 iframe                              │  │
│  │             ↑ @webos/host-sdk                       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 7. webos 与 Puter 架构差异总结

| 维度 | Puter | **webos** |
|---|---|---|
| 语言 | JavaScript | TypeScript |
| DOM | jQuery | 现代 DOM API |
| 拖拽 | jQuery UI | interact.js |
| 服务注册 | globalThis.services + use/def | singleton + 静态 import |
| 全局状态 | window.xxx 散落 | 模块化 + 类封装 |
| 模块系统 | webpack | Vite + ESM |
| 用户系统 | 内置（Puter 用户）| 不内置（应用方自定）|
| 文件系统 | 内置（Puter 文件）| 不内置 |
| 应用注册 | Puter App Store | AppSource 接口（多源可插拔）|
| 通信协议 | 自定义 IPC（1974 行 JS）| 重设计：TypeScript + Promise + Type-safe RPC |
| 协议 | AGPL-3.0 | MIT |

---

## Phase 5 终稿：实操之后的复盘

> 这一节是 Phase 1 读完 Puter 之后做出预设、Phase 2-4 真正动手实现完成，再回头看的复盘。
> 写下来给后人（也给未来的自己）参考。

### 哪些预设被验证成立

1. **iframe + postMessage 是对的**。隔离性、宿主无关、跨栈兼容三个目标一并满足，桌面壳完全不需要知道应用用了什么框架。

2. **TypeScript + 现代 DOM API 比 jQuery 快很多**。Puter 用 jQuery 是历史包袱，从零写没必要保留。`querySelector` / `addEventListener` / class 继承 + 泛型 EventEmitter 完全够用，并且代码量降了 60%（同等功能从 ~30k 行降到 ~7.8k 行）。

3. **interact.js 替代 jQuery UI**。drag / resize / snap 都被一个库优雅覆盖，零负担。

4. **AppSource 抽象**。把"应用列表从哪来"做成接口的决定让 webos 在企业 / SaaS / 离线场景下都可用，不绑定单一商店。

5. **CSS 变量驱动主题**。零运行时开销 + 用户可写自定义主题，方案非常轻量。

### 哪些预设被推翻或调整

1. **ServiceContainer + DI 没必要**。Phase 1 设计文档里画了 ServiceContainer，写的时候发现 webos 是单实例 SPA，singleton + 静态 import 已经足够清晰。`WindowManager.instance` 比 `container.get(WindowManagerToken)` 读起来自然。Puter 的 `use/def` 注册表有意义是因为它要支持运行时动态扩展；webos 没有这个需求。

2. **TopBar 砍了**。Phase 1 设计稿里有顶栏，实现时发现"任务栏 + 桌面右键 + 开始菜单"已经覆盖所有入口，再加顶栏只是装饰。砍掉之后桌面更干净。

3. **不做"严格 clean room 重写"**。最初想画一条严格的禁线"不读任何 Puter 源码"，后来发现这条线既没必要也不可执行——开源代码的"思路"和"代码"本来就是两回事。**实际做法**：通读 Puter 找架构启发，写代码时不复制片段、用 TS + 不同库重新表达，最终成品 MIT 授权。代码量、语言、依赖、命名都不一样，是 substantial transformation 而不是衍生作品。

4. **dialog 的高级形态延后**。Phase 1 设计稿列了 14 种对话框（openFile / saveFile / pickColor / pickFont / showQR / progress / properties / pickDirectory）。**目前只实现 alert / confirm / prompt 三种**，其余声明为 `NOT_IMPLEMENTED`，留到后续再做。理由：业务调用方暂时用不到，过早实现是负债。

5. **"内置很多业务"路径放弃**。Puter 内置文件系统、用户系统、应用商店——这是 Puter 自家产品定位决定的。webos 是平台，三件套全部上交给使用方：用户系统通过覆盖 `user.current` handler；文件系统由具体应用自己实现；应用注册通过 `AppSource` 由使用方决定。

### 没料到的难点

1. **`AppMessageBus` 的 `handlers` 字段名冲突**。继承 EventEmitter 后 `private handlers` 撞了父类的 `handlers`，TS 报错。改名 `rpcHandlers` 解决——小心 OOP 字段名冲突。

2. **UMD 包的 default 导出**。Rollup 默认会把 `Webos as default` 包成 `{ default: Webos }`，`window.Webos` 直接拿到的是包装对象。footer 里加一句 `if (Webos && Webos.default) window.Webos = Webos.default` 解决。

3. **iframe 的 `appId` 推断**。RpcClient 需要知道自己属于哪个 appId（用于 storage 隔离等）。最初想从 URL 查询串读，后来加了一个 `apps.self` handler：iframe 在调用时不传 appId，桌面壳根据 source window 反查 AppLoader 已注册的 iframe 列表来判定。

4. **CSS 变量的命名冲突**。最早用 `--bg` `--fg`，后来发现和宿主页面 / 业务应用 CSS 串了。统一加前缀 `--webos-*` 解决。

5. **interact.js 的事件流**。drag 中如果窗口本身被 `position: absolute` 也用 transform，会导致双重位移。改用 `transform: translate3d` 单独走 + `setOrigin` 校准搞定。

### 工作量数字

| 阶段 | 内容 | 时长（折算）|
|------|------|------------|
| Phase 1 | 读 Puter + 设计文档 | ~3 天 |
| Phase 2 | TS 项目骨架 + 工具层 | ~1 天 |
| Phase 3 | core/ + shell/（窗口 / 桌面 / 任务栏 / 对话框 / 应用容器）| ~5 天 |
| Phase 4 | host-sdk 包 + Rollup 打包 | ~2 天 |
| Phase 5 | 5 个示例 + 6 份文档 | ~1.5 天 |
| **合计** | webos v0.1 | **~12.5 工作日** |

Phase 1 设想里写的"~30 工作日完成 1.0"还是稍微乐观了——v0.1 已经达到"可用桌面壳 + 可发布 SDK"，但 V1.0 要补完 dialog 高级形态、KV storage 真实落地、应用商店 UI、PWA 离线安装等等。预计还要 ~10-15 工作日。

### 给后人的几条经验

- **先读完整再动手**。Phase 1 花 3 天通读 Puter 看似奢侈，但避免了实现到一半才发现"这思路其实 Puter 已经踩过坑了"。
- **设计稿是地图不是合同**。ServiceContainer / TopBar 这些都在设计稿里写得详细，实际不需要就大胆砍掉。
- **用类型代替注释**。TS 接口比一行 docstring 信息密度高得多。
- **每完成一个 Phase 就跑一次 build**。Phase 3 末尾跑 `pnpm build` 发现 8 处 TS strict 报错，比写完 Phase 4 再回头改省事得多。
- **示例和文档是平台的脸面**。SDK 写完再不写示例 / 文档，使用方根本进不来。Phase 5 不能省。

---

> **下一步**：T1.2 学习 UIWindow.js + 设计 webos Window 模块。

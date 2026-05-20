# webos 模块设计文档

> 本文档基于 Puter 学习成果（见 `LEARNING_NOTES.md`），输出 webos 各模块的自主设计。
>
> **作者**：MountCloud `<mountcloud@outlook.com>`

---

## Window（窗口模块）

### 1. Puter UIWindow.js 学到了什么

#### 1.1 关键设计点
- **单一函数 4406 行**：所有窗口创建逻辑在 `UIWindow(options)` 一个函数内（不优雅）
- **HTML 字符串拼接**：用 `let h = ''; h += '...'` 拼出整个窗口 DOM
- **大量 options 参数**：80+ 配置项混在一个对象里
- **jQuery 全局插件**：`$.fn.focusWindow / close / showWindow / hideWindow` 散落
- **全局状态污染**：`window.last_window_zindex` / `window.window_stack` / `window.window_counter` 等

#### 1.2 优秀的设计思想（值得继承）
- **Snap 机制**：拖到屏幕边缘自动分屏（贴左半 / 右半 / 四角 / 全屏）
- **窗口栈（Window Stack）**：维护打开顺序，关一个聚焦上一个
- **z-index 自增管理**：聚焦时自增到栈顶
- **busy 遮罩**：窗口可设忙碌状态（disable mask）
- **stay_on_top**：始终置顶模式
- **dominant 模式**：模态对话框居中靠上
- **panel 模式**：右侧面板（任务栏/通知中心用）
- **iframe 应用窗口**：`window-app-iframe`，可以加载远程 URL
- **父子窗口**：子窗口可以禁用父窗口（对话框模式）
- **single_instance**：同一应用只允许一个窗口
- **窗口动画**：最小化时飞向任务栏对应位置

#### 1.3 必须改进的（webos 不要的设计）
- 4406 行单函数 → 拆分多个类
- HTML 字符串 → DOM API + Template
- 全局变量污染 → WindowManager 类
- jQuery 插件扩展 → 类方法
- 文件浏览器/对话框混在 UIWindow 内 → 拆开

### 2. webos Window 模块设计

#### 2.1 模块组成

```
core/window/
├── Window.ts              单个窗口类
├── WindowManager.ts       窗口管理器（栈、z-index、聚焦）
├── WindowControls.ts      标题栏控件（最小化/最大化/关闭按钮）
├── WindowSnap.ts          贴边分屏逻辑
├── WindowDrag.ts          拖拽实现（基于 interact.js）
├── WindowResize.ts        缩放实现
├── AppWindow.ts           应用窗口（带 iframe）
├── FileDialog.ts          文件对话框（open/save/picker）
├── types.ts               TypeScript 类型
└── index.ts               导出
```

#### 2.2 核心 API 设计

```typescript
import { WindowManager, Window } from '@webos/core/window'

// 创建窗口（最简）
const win = WindowManager.create({
  title: '我的应用',
  width: 800,
  height: 600,
  body: '<div>内容</div>',  // HTMLElement | string | (container) => void
})

// 创建应用窗口（iframe）
const appWin = WindowManager.createApp({
  title: '防勒索',
  appId: 'anti-ransomware',
  url: 'https://app.example.com',
  width: 1000,
  height: 700,
})

// 操作
win.maximize()
win.minimize()
win.restore()
win.focus()
win.close()
win.setTitle('新标题')
win.setBadge(5)
win.setBusy(true)

// 事件
win.on('close', () => {})
win.on('focus', () => {})
win.on('resize', (size) => {})

// 类型
interface WindowOptions {
  title?: string
  icon?: string
  width?: number | string         // 数字=px，字符串可"50%"
  height?: number | string
  x?: number                       // 不传=居中偏移
  y?: number
  resizable?: boolean              // 默认 true
  draggable?: boolean              // 默认 true
  minimizable?: boolean            // 默认 true
  maximizable?: boolean            // 默认 true
  closable?: boolean               // 默认 true
  modal?: boolean                  // 模态（禁用父窗口）
  parent?: Window                  // 父窗口
  alwaysOnTop?: boolean
  showInTaskbar?: boolean          // 默认 true
  body?: HTMLElement | string | ((container: HTMLElement) => void)
  className?: string               // 自定义 CSS class
  data?: Record<string, unknown>   // 用户自定义数据
  onClose?: () => boolean | Promise<boolean>  // 返回 false 阻止关闭
}
```

#### 2.3 Window 类设计

```typescript
/**
 * 浮动窗口
 * 单个窗口实例，由 WindowManager 创建和管理
 *
 */
export class Window extends EventEmitter<WindowEvents> {
  readonly id: string
  readonly el: HTMLElement
  readonly head: HTMLElement
  readonly body: HTMLElement
  
  private _state: 'normal' | 'maximized' | 'minimized' | 'closed' = 'normal'
  private _zIndex = 0
  private _options: Required<WindowOptions>

  constructor(options: WindowOptions) { /* ... */ }

  // 状态查询
  get state() { return this._state }
  get isClosed() { return this._state === 'closed' }
  get bounds() { /* { x, y, width, height } */ }

  // 操作
  maximize(): void
  minimize(): void
  restore(): void
  focus(): void
  close(): Promise<boolean>
  setTitle(title: string): void
  setIcon(icon: string): void
  setBadge(n: number | null): void
  setBusy(busy: boolean): void
  setBounds(b: { x?: number; y?: number; width?: number; height?: number }): void
  
  // 内容操作
  setBody(content: HTMLElement | string): void
}

interface WindowEvents {
  open: void
  focus: void
  blur: void
  close: void                    // 已关闭
  beforeClose: { cancel: () => void }
  resize: { width: number; height: number }
  move: { x: number; y: number }
  maximize: void
  restore: void
  minimize: void
  stateChange: { from: WindowState; to: WindowState }
}
```

#### 2.4 WindowManager 设计

```typescript
/**
 * 窗口管理器
 * 维护窗口栈、z-index、聚焦逻辑
 */
export class WindowManager extends EventEmitter<WindowManagerEvents> {
  private windows = new Map<string, Window>()
  private stack: string[] = []          // 按打开顺序，末尾是最新聚焦
  private nextZIndex = 100
  
  // 配置
  static readonly Z_INDEX_BASE = 100
  static readonly Z_INDEX_TOP = 99999999    // alwaysOnTop 用

  // 创建
  create(options: WindowOptions): Window
  createApp(options: AppWindowOptions): AppWindow
  
  // 查询
  get(id: string): Window | undefined
  getAll(): Window[]
  getActive(): Window | undefined
  findByApp(appId: string): Window[]
  
  // 操作
  focus(win: Window): void
  closeAll(): Promise<void>
  
  // 内部
  private _onWindowClose(win: Window): void
  private _allocateZIndex(): number
}

interface WindowManagerEvents {
  windowOpen: Window
  windowClose: Window
  windowFocus: Window
  activeChange: Window | undefined
}
```

#### 2.5 关键算法：贴边分屏（Snap）

```
拖动窗口时检测光标位置，落入特定区域显示半透明预览：

屏幕区域划分（屏幕宽 W、高 H）：
┌─────┬─────────────┬─────┐
│ NW  │      N      │ NE  │
│ 5%  │             │ 5%  │
├─────┼─────────────┼─────┤
│     │             │     │
│ W   │   center    │  E  │
│     │             │     │
├─────┼─────────────┼─────┤
│ SW  │      S      │ SE  │
└─────┴─────────────┴─────┘

落区行为：
- W → 占左半屏（width=W/2, height=H）
- E → 占右半屏
- N → 最大化
- NW/NE/SW/SE → 占四分之一屏

实现：
- 拖动时实时计算光标 zone
- zone 变化时延迟 600ms 显示预览（避免误触）
- 释放时根据当前 zone 应用尺寸
```

#### 2.6 关键算法：z-index 与窗口栈

```
状态：
- stack: ["win1", "win2", "win3"]   末尾为活动窗口
- zIndices: { win1: 100, win2: 101, win3: 102 }

聚焦 win1：
1. 从 stack 移除 win1 → ["win2", "win3"]
2. push win1 → ["win2", "win3", "win1"]
3. allocate new zIndex → 103
4. win1.zIndex = 103
5. emit 'activeChange' → win1
6. 通知 iframe 内应用 'focus'（postMessage）
7. 其他窗口的 iframe 设 pointer-events: none

alwaysOnTop 窗口：
- z-index 永远在 99999999+，不参与栈
```

#### 2.7 关键算法：模态窗口（父子关系）

```
打开模态对话框（child window with modal=true, parent=parentWin）：
1. 创建 child window
2. 在 parent.body 上覆盖一个 disable-mask（半透明遮罩，pointer-events: all）
3. parent 标记为 disabled，所有点击被遮罩拦截
4. child 关闭时：
   - 移除 parent 的 disable-mask
   - parent 重新可交互
   - focus 回 parent
```

#### 2.8 与 iframe 应用的协作

```typescript
// AppWindow 创建一个含 iframe 的窗口
class AppWindow extends Window {
  readonly iframe: HTMLIFrameElement
  readonly appId: string
  readonly appUrl: string
  
  constructor(options: AppWindowOptions) {
    super({ ...options, body: createIframe(options.url) })
    this.iframe = this.body.querySelector('iframe')!
  }
  
  // 通过 postMessage 与 iframe 通信
  sendMessage(message: any): void {
    this.iframe.contentWindow?.postMessage(message, '*')
  }
  
  // 关闭前询问 iframe 内应用
  async close(): Promise<boolean> {
    const canClose = await this._askIframe('beforeClose')
    if (!canClose) return false
    return super.close()
  }
}
```

#### 2.9 拖拽与缩放（基于 interact.js）

```typescript
// WindowDrag.ts
export function attachDrag(win: Window) {
  interact(win.head).draggable({
    listeners: {
      start: () => {
        win.el.classList.add('webos-window--dragging')
        win.focus()
      },
      move: (event) => {
        const x = (parseFloat(win.el.dataset.x ?? '0') || 0) + event.dx
        const y = (parseFloat(win.el.dataset.y ?? '0') || 0) + event.dy
        win.el.style.transform = `translate(${x}px, ${y}px)`
        win.el.dataset.x = String(x)
        win.el.dataset.y = String(y)
        WindowSnap.detect(event.client.x, event.client.y)
      },
      end: () => {
        win.el.classList.remove('webos-window--dragging')
        WindowSnap.applyIfNeeded(win)
      }
    }
  })
}
```

### 3. 行数预估

| 文件 | 估算行数 |
|---|---|
| Window.ts | ~400 |
| WindowManager.ts | ~250 |
| WindowControls.ts | ~150 |
| WindowSnap.ts | ~250 |
| WindowDrag.ts | ~150 |
| WindowResize.ts | ~150 |
| AppWindow.ts | ~200 |
| FileDialog.ts | ~600（含 open/save/picker 三种）|
| types.ts | ~150 |
| index.ts | ~30 |
| **合计** | **~2,330** |

约 Puter UIWindow.js 4406 行的 53%，但**职责清晰、类型安全、易测试**。

### 4. 与 Puter 的关键差异

| 维度 | Puter | webos |
|---|---|---|
| 单文件大小 | 4406 行（一个函数） | 拆 10 个文件，每个 < 400 行 |
| 语言 | JS + jQuery | TypeScript + interact.js |
| HTML 生成 | 字符串拼接 | `document.createElement` |
| 状态 | 全局变量散落 | `WindowManager` 单例封装 |
| 事件 | jQuery on('click') | 类方法 + EventEmitter |
| 类型 | 无 | 完整 TypeScript |
| 文件对话框 | 内嵌在 UIWindow | 独立 `FileDialog.ts` |
| 文件浏览器 | 内嵌（侧边栏 / 导航栏） | **完全删除**（应用自己实现）|

---

---

## Desktop（桌面模块）

### 1. Puter UIDesktop.js 学到了什么

#### 1.1 关键功能（2631 行内）
- **初始化**：创建 `.desktop` 元素、计算尺寸（excluding taskbar / toolbar）
- **背景管理**：通过 `set_desktop_background()` 设置壁纸 URL/CSS
- **图标网格**：列出 `~/Desktop` 文件夹内容（Puter 是文件型）
- **拖放上传**：`dragster.js` 支持把外部文件拖到桌面
- **右键菜单**：新建文件夹 / 粘贴 / 刷新 / 排序 / 上传 / 桌面设置 / 主题
- **顶栏（toolbar）**：Logo + 搜索 + 用户菜单 + 全屏 + GitHub + 时钟
- **BroadcastChannel**：多 tab 同步状态（`puter-desktop-channel`）
- **Socket.io 监听**：实时同步文件变更（webos 不需要）
- **Context 菜单触发** `taphold` 移动端长按支持

#### 1.2 优秀设计（继承）
- **多 tab 同步**：BroadcastChannel 跨 tab 状态同步（值得保留）
- **响应式高度**：`100vh - taskbar - toolbar` 计算可用区域
- **触屏支持**：桌面操作支持 `taphold`（移动端长按）
- **图标排序**：name / modified / type / size，asc / desc
- **图标位置持久化**：用户拖动后位置记录，刷新恢复

#### 1.3 必须改造（webos 不要的）
- 文件系统逻辑（`puter.fs.list()` / `~/Desktop` 等）
- Camera/Recorder 自动授权
- Socket.io 实时同步
- "保存账户" / "Welcome" 等 Puter 业务弹窗
- 右键菜单中的"新建文件" / "粘贴" / "上传"等文件操作

### 2. webos Desktop 模块设计

#### 2.1 模块组成

```
core/desktop/
├── Desktop.ts             桌面主类
├── DesktopBg.ts           背景管理（壁纸切换）
├── IconGrid.ts            图标网格（应用图标）
├── IconItem.ts            单个图标项
├── DesktopContextMenu.ts  桌面右键菜单
├── BroadcastSync.ts       多 tab 同步
├── types.ts
└── index.ts
```

shell/ 层（自研外壳）调用 core/desktop/：

```
shell/
├── DesktopShell.ts        启动桌面 + 初始化所有子组件
├── TopBar.ts              顶部导航栏
├── StartMenu.ts           开始菜单
├── NotificationCenter.ts  通知中心
├── GlobalSearch.ts        Cmd+K 搜索
└── AppLauncher.ts         应用启动器
```

#### 2.2 核心 API

```typescript
import { Desktop } from '@webos/core/desktop'

const desktop = new Desktop({
  container: document.getElementById('desktop')!,
  appRegistry,                    // 从 AppSource 拉应用列表
  taskbarPosition: 'bottom',
  background: { type: 'image', url: '/wallpapers/default.jpg' },
})

await desktop.init()

// 操作
desktop.setBackground({ type: 'color', value: '#1e3a5f' })
desktop.refresh()
desktop.addIcon(app)
desktop.removeIcon(appId)

// 事件
desktop.on('iconClick', (app) => launchApp(app))
desktop.on('iconDblClick', (app) => launchApp(app))
desktop.on('contextMenu', (e, target) => { /* 自定义菜单 */ })
```

#### 2.3 桌面图标（应用，非文件）

```typescript
interface AppIcon {
  appId: string
  name: string
  iconUrl: string
  position?: { x: number; y: number }   // 可选，否则自动排
}

// IconGrid 负责自动布局 + 拖动持久化
class IconGrid {
  layout(icons: AppIcon[]): void
  setPosition(appId: string, pos: { x: number; y: number }): void
  resetLayout(): void
}
```

**与 Puter 差异**：
- Puter：图标 = 文件系统 entry
- webos：图标 = 已注册应用（来自 AppRegistry）

#### 2.4 多 tab 同步（保留）

```typescript
class BroadcastSync {
  private channel = new BroadcastChannel('webos-desktop')
  
  broadcast(event: string, data: any): void {
    this.channel.postMessage({ event, data })
  }
  
  on(event: string, handler: (data: any) => void): void { /* ... */ }
}

// 用途：tab1 装了新应用 → broadcast → tab2 桌面图标即时刷新
```

#### 2.5 行数预估

| 文件 | 行数 |
|---|---|
| Desktop.ts | ~250 |
| DesktopBg.ts | ~150 |
| IconGrid.ts | ~200 |
| IconItem.ts | ~150 |
| DesktopContextMenu.ts | ~200 |
| BroadcastSync.ts | ~80 |
| **合计** | **~1,030** |

约 Puter UIDesktop.js 2631 行的 39%（删了大量文件系统业务）。

---

## Taskbar（任务栏模块）

### 1. Puter 学到的

- **三种位置**：bottom / left / right（移动端默认 bottom）
- **开始菜单**（popover）：最近应用 + 推荐 + 搜索
- **拖拽固定**：用户可把开始菜单里的应用拖到任务栏置顶
- **多窗口指示器**：同应用多窗口时显示活跃指示
- **响应式调整**：桌面变小时自动缩放任务栏图标

### 2. webos 设计

```
core/taskbar/
├── Taskbar.ts            任务栏主类
├── TaskbarItem.ts        单个任务栏项
├── TaskbarItemMenu.ts    右键菜单（关闭 / 取消固定 / 全部关闭）
└── index.ts

API:
const taskbar = new Taskbar({
  position: 'bottom',          // bottom | left | right
  pinnedApps: ['settings'],
})

taskbar.addItem(window)        // window 打开时
taskbar.removeItem(window)     // window 关闭时
taskbar.setBadge(appId, n)
taskbar.pin(appId)
taskbar.unpin(appId)
```

行数预估：Taskbar.ts ~250 + TaskbarItem.ts ~180 + TaskbarItemMenu.ts ~80 = **~510 行**（Puter 763 + 527 = 1290 的 40%）。

---

## Dialog（对话框系统）

### 1. Puter 学到的（14 种对话框）

每个对话框基于 UIWindow，不同的是 body 内容。共性：
- 居中显示（`dominant: true`）
- 通常 `modal: true`（禁用父窗口）
- 通常 `show_in_taskbar: false`
- Promise-based API（弹出 → await → 拿结果）

### 2. webos 设计

```
core/dialog/
├── Dialog.ts              通用对话框基类（继承 Window）
├── Alert.ts               alert / confirm
├── Prompt.ts              prompt
├── ProgressDialog.ts      进度
├── PropertiesDialog.ts    属性 key-value 显示
├── ColorPicker.ts         颜色选择
├── FontPicker.ts          字体选择
├── QRDialog.ts            QR 码
├── ContextMenu.ts         右键菜单（不是窗口，是 popover）
├── Popover.ts             弹层基类
├── Notification.ts        通知（不是窗口，是浮层）
├── DesktopBgSettings.ts   桌面背景设置
├── ThemeDialog.ts         主题切换
├── SystemInfo.ts          系统信息
├── Feedback.ts            反馈
├── RequestPermission.ts   权限申请
├── TaskManager.ts         任务管理器
└── index.ts

API（Promise-based）：
const ok = await Dialog.confirm('确定删除？')
const text = await Dialog.prompt('请输入名称', 'default')
const file = await Dialog.openFile({ accept: ['.json'] })
const color = await Dialog.pickColor({ default: '#2c5282' })

const handle = Dialog.progress({ title: '上传中', max: 100 })
handle.update(50)
handle.close()
```

行数预估：~1500 行（14 个文件平均 ~100 行）。

---

## IconItem（通用图标项）

### 1. Puter UIItem.js 学到的

1998 行内包含：
- 文件 / 文件夹 / 应用 三种 item 渲染
- 选中 / 多选 / 框选
- 拖拽到其他容器
- 双击打开 / 单击选中
- 右键菜单
- 重命名（inline edit）
- 缩略图加载

### 2. webos 设计（去文件系统）

```
core/desktop/IconItem.ts        ~400 行（保留通用图标 / 拖拽 / 选中 / 右键）

interface IconItemOptions {
  id: string
  name: string
  icon: string                // URL / svg / 字符
  type?: 'app' | 'shortcut'   // webos 不要 'file' / 'folder'
  position?: { x: number; y: number }
  draggable?: boolean
  selectable?: boolean
  contextMenu?: ContextMenuItem[]
  onClick?: () => void
  onDblClick?: () => void
}
```

---

## Theme（视觉规范 + 设计 Token）

### 1. Puter 学到的

- 主题就是一组 CSS 变量
- `theme.css` 24 行定义全部
- 切换主题 = 替换 CSS 变量
- 通过 `ThemeService` 管理

### 2. webos 设计 Token

```css
/* core.css 默认主题 token（亮色） */
:root {
  /* 颜色 */
  --webos-color-primary: #2c5282;
  --webos-color-bg-base: #f5f7fa;
  --webos-color-bg-window: #ffffff;
  --webos-color-bg-glass: rgba(255, 255, 255, 0.85);
  --webos-color-text: #1a202c;
  --webos-color-text-muted: #718096;
  --webos-color-border: rgba(0, 0, 0, 0.08);
  --webos-color-shadow: rgba(0, 0, 0, 0.12);
  --webos-color-danger: #c53030;
  --webos-color-warning: #d97706;
  --webos-color-success: #2f855a;
  --webos-color-info: #3182ce;
  
  /* 字体 */
  --webos-font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --webos-font-size-base: 14px;
  --webos-font-size-sm: 12px;
  --webos-font-size-lg: 16px;
  
  /* 间距 */
  --webos-spacing-xs: 4px;
  --webos-spacing-sm: 8px;
  --webos-spacing-md: 16px;
  --webos-spacing-lg: 24px;
  --webos-spacing-xl: 32px;
  
  /* 圆角 */
  --webos-radius-sm: 4px;
  --webos-radius-md: 8px;
  --webos-radius-lg: 12px;
  
  /* 玻璃质感 */
  --webos-blur: 12px;
  --webos-shadow-window: 0 10px 40px rgba(0,0,0,0.15);
  --webos-shadow-popover: 0 4px 16px rgba(0,0,0,0.12);
  
  /* 动效 */
  --webos-transition-fast: 150ms ease;
  --webos-transition-normal: 250ms ease;
  --webos-transition-slow: 400ms ease;
  
  /* 桌面 */
  --webos-desktop-bg: url('/wallpapers/default.jpg') center/cover;
  
  /* 任务栏 */
  --webos-taskbar-height: 48px;
  --webos-taskbar-bg: var(--webos-color-bg-glass);
  
  /* 顶栏 */
  --webos-topbar-height: 36px;
  --webos-topbar-bg: var(--webos-color-bg-glass);
  
  /* 窗口 */
  --webos-window-radius: var(--webos-radius-lg);
  --webos-window-shadow: var(--webos-shadow-window);
  --webos-window-head-height: 36px;
}

/* 暗色主题 */
[data-webos-theme="dark"] {
  --webos-color-bg-base: #1a202c;
  --webos-color-bg-window: #2d3748;
  --webos-color-bg-glass: rgba(45, 55, 72, 0.85);
  --webos-color-text: #f7fafc;
  --webos-color-text-muted: #a0aec0;
  --webos-color-border: rgba(255, 255, 255, 0.1);
  --webos-color-shadow: rgba(0, 0, 0, 0.4);
}
```

### 3. webos 主题包机制

```typescript
// 主题包就是一个 npm 包，导出 CSS
@webos/theme-default       默认（上面这套）
@webos/theme-dsm           DSM 风（深蓝企业）
@webos/theme-mac           macOS 风
@webos/theme-win           Windows 风

// 切换
import '@webos/theme-default/dist/theme.css'
ThemeService.setMode('dark')   // 'light' | 'dark' | 'auto'
```

---

## Utilities（工具集）

### 1. Puter helpers/util 决策

| 文件 | webos 决策 |
|---|---|
| `AdvancedBase.js`（util） | webos 不需要——TS class 已够用 |
| `TeePromise.js`（util） | webos **自实现**（TS，~30 行） |
| `Component.js`（util） | webos 不需要——直接用 TS class |
| `download.js`（helpers） | webos **自实现**（创建 a 标签触发下载） |
| `update_mouse_position.js` | webos **自实现** |
| `globToRegExp.js` | webos **用第三方库** `picomatch` |
| `html-entities.js`（lib） | webos **用第三方库** `he` |
| `isMobile.min.js`（lib） | webos **用第三方库** `mobile-detect` |
| `timeago.min.js`（lib） | webos **用第三方库** `dayjs/relativeTime` |

### 2. 第三方库选型

| 用途 | 库 | License |
|---|---|---|
| 拖拽缩放 | interact.js | MIT |
| HTML 转义 | he | BSD-2 |
| 移动端检测 | mobile-detect | MIT |
| 时间格式化 | dayjs | MIT |
| 路径处理 | path-browserify | MIT |
| 颜色选择 | @simonwep/pickr | MIT |
| QR 生成 | qrcode | MIT |

---

## 模块依赖图

```
                    Desktop (主桌面)
                        │
        ┌───────────────┼─────────────────┐
        ↓               ↓                 ↓
    DesktopBg      IconGrid          DesktopContextMenu
                        │
                        ↓
                    IconItem ←─── ContextMenu (dialog)
                        │
                        │ click
                        ↓
                  AppRegistry
                        │
                        ↓
                  WindowManager
                  ┌─────┴─────┐
                  ↓           ↓
                Window     AppWindow
                  │
                  ├─ WindowControls
                  ├─ WindowDrag (interact.js)
                  ├─ WindowResize (interact.js)
                  └─ WindowSnap

Taskbar ←──── WindowManager (subscribe)

ServiceContainer 提供：
  ThemeService → CSS 变量切换
  SettingsService → localStorage 持久化
  LocaleService → i18n
  IPCService → iframe 应用通信
  AppRegistry → 应用清单源
  NotificationService → 桌面通知
```

---

> **设计文档完成范围**：Window / Desktop / Taskbar / Dialog / IconItem / Theme / Utilities
> **下一步**：T1.8 决策技术栈、T1.9 决策模块划分


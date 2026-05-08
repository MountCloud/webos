# 04 · 扩展 webos shell

给 webos shell 加新功能（顶栏按钮、对话框、面板、桌面元素、新的 RPC 能力）的标准动作。

---

## 决策树：你要加的属于哪一层？

```
要加的功能...
├── 是窗口 / 桌面级别的 UI（如新对话框、新面板）
│   → core/ 下的子目录或 shell/ 下新建组件类
│
├── 是 iframe 应用能调的能力（如读时间 / 打开打印对话框）
│   → 走 SDK 扩展流程（看 05-extending-the-sdk.md）
│   → shell 这边补 host handler，SDK 那边补方法
│
├── 是给整个 shell 用的新单例服务（如 NotificationService）
│   → 跟 UserSession / ThemeRegistry 同模式：singleton extends EventEmitter
│
├── 是新的桌面装饰物（如壁纸切换、屏保）
│   → core/desktop/ 下加；可能要加 ThemeRegistry 类似的 BgRegistry singleton
│
└── 是给应用方的 manifest 字段
    → apps/AppManifest.ts 加字段；validateManifest 加校验；docs/APP_MANIFEST_SPEC.md 加说明
```

---

## 加一个新对话框（如 dialog.openFile）

1. **新建文件** `apps/webos-shell/src/core/dialog/OpenFile.ts`：
   ```ts
   import { WindowManager } from '../window'
   import { createEl } from '../../helpers/dom'

   export interface OpenFileOptions { accept?: string[]; multiple?: boolean }

   export function openFile(options: OpenFileOptions = {}): Promise<File | File[] | null> {
     return new Promise((resolve) => {
       const root = createEl('div', { className: 'webos-dialog' })
       // ... 构建 DOM ...
       const win = WindowManager.instance.create({
         title: '打开文件', width: 500, height: 400,
         resizable: false, modal: true, showInTaskbar: false,
         className: 'webos-openfile', body: root,
         onClose: () => { if (!resolved) resolve(null); return true },
       })
     })
   }
   ```

2. **导出** `apps/webos-shell/src/core/dialog/index.ts`：
   ```ts
   export { openFile, type OpenFileOptions } from './OpenFile'
   ```

3. **如果应用方要能调**：在 `apps/builtinHandlers.ts` 注册 handler：
   ```ts
   bus.registerHandler('dialog', 'openFile', async (req) => {
     const args = req.args as OpenFileOptions
     return await openFile(args)   // File 序列化是问题，详见 08 踩坑
   })
   ```

   并在 `packages/host-sdk/src/modules/dialog.ts` 加 SDK 方法（已有 placeholder）。

4. **样式**：`apps/webos-shell/src/styles/dialog.scss` 已经有 `.webos-dialog-content / footer / message-wrap` 等通用样式，复用即可，不用新建文件。

---

## 给顶栏右侧加一个按钮（如音量 🔊）

`apps/webos-shell/src/shell/TopRightBar.ts` 里有个 `BTNS` 数组，按现有结构加：

```ts
const BTNS: BtnSpec[] = [
  // ... 已有 4 个（notify / user / settings / search）
  {
    className: 'webos-top-right-volume',
    title: '音量',
    svg: `<svg ...>...</svg>`,
    evt: 'volumeClick',     // 加到 TopRightBarEvents 里
  },
]

export interface TopRightBarEvents {
  notificationClick: { x: number; y: number }
  userClick: { x: number; y: number }
  settingsClick: { x: number; y: number }
  searchClick: void
  volumeClick: { x: number; y: number }   // ← 新增
  [key: string]: unknown
}
```

`main.ts` 里接线：

```ts
topRight.on('volumeClick', (anchor) => volumePanel.toggle({ x: anchor.x, y: anchor.y }))
```

**注意**：顶栏宽度有限（~160px 容纳 4 个按钮），加按钮要么挤一挤要么改 `dock.scss` 的 `max-width: calc(100vw - 320px)` 给左右胶囊留更多空间。

---

## 加一个下拉面板（如 VolumePanel）

模仿 `apps/webos-shell/src/shell/SettingsPanel.ts`：

```ts
export class VolumePanel extends UIElement {
  private static _instance: VolumePanel | null = null
  static get instance(): VolumePanel { ... }   // singleton

  private _isOpen = false
  private _removeTimer: ReturnType<typeof setTimeout> | null = null

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-volume-panel' })
    // ... slider / mute toggle / device list ...
    return el
  }

  open(anchor: { x: number; y: number }): void {
    if (this._isOpen) return
    this._isOpen = true
    if (this._removeTimer) { clearTimeout(this._removeTimer); this._removeTimer = null }
    document.body.appendChild(this.el)
    requestAnimationFrame(() => {
      // 定位 + 加 --shown class
    })
    setTimeout(() => {
      document.addEventListener('mousedown', this._onOutsideClick, true)
      document.addEventListener('keydown', this._onKeyDown, true)
    }, 0)
  }

  close(): void {
    if (!this._isOpen) return
    this._isOpen = false
    document.removeEventListener('mousedown', this._onOutsideClick, true)
    document.removeEventListener('keydown', this._onKeyDown, true)
    this.el.classList.remove('webos-volume-panel--shown')
    if (this._removeTimer) clearTimeout(this._removeTimer)
    this._removeTimer = setTimeout(() => {
      this._removeTimer = null
      if (!this._isOpen) removeEl(this.el)
    }, 150)
  }

  toggle(anchor: { x: number; y: number }): void {
    if (this._isOpen) this.close()
    else this.open(anchor)
  }

  private _onOutsideClick = (e: MouseEvent): void => {
    if (!this._isOpen) return
    if (!this.el.contains(e.target as Node)) this.close()
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }
}
```

**关键点**：
- `_removeTimer` 防"close 动画期间又 open 被反向干掉"的赛跑（08 踩坑文件 #B2-B4 详述）
- `_onOutsideClick` 用 capture 阶段（`true`）+ `contains` 检查
- mousedown / keydown 监听用 `setTimeout(..., 0)` 延后注册，避免触发 open 的事件本身又触发 close

---

## 加一个新单例服务（如 NotificationService）

模仿 `apps/webos-shell/src/user/UserSession.ts`：

```ts
export class XxxService extends EventEmitter<XxxServiceEvents> {
  private static _instance: XxxService | null = null
  static get instance(): XxxService { ... }

  private _state: ... = ...

  constructor() {
    super()
    // 启动时从持久化恢复
    const saved = persist.getJSON('xxx.state', defaultValue)
    this._state = saved
  }

  setStateXxx(...) { ... ; this._save(); this.emit('change', ...) }

  private _save() { persist.setJSON('xxx.state', this._state) }
}
```

**要不要给应用方暴露**？两种选择：

- **私有**：只 shell 内部用 → 直接用 `XxxService.instance.foo()`
- **共享**：要让应用方也能读 / 写 → 走 SDK 流程（看 05），加 `Webos.xxx.*` 方法 + handler

如果共享数据涉及持久化（如用户 / 主题 / 设置），把**纯函数持久化层放到 `packages/host-sdk/src/session.ts` 类似的位置**，让登录页 / shell / RPC handler 共用。详见 UserSession 的实现。

---

## 修改 main.ts

`main.ts` 是 bootstrap 总装。新组件的接线一律在这里做，不要在组件内部硬编码"我要 mount 在哪 / 接哪个事件"。

```ts
async function bootstrap(): Promise<void> {
  // ... 已有初始化 ...

  const myWidget = new MyWidget()
  myWidget.mount(root)
  myWidget.on('event', (payload) => doSomething(payload))
}
```

---

## SCSS 加新文件

1. 新建 `apps/webos-shell/src/styles/my-widget.scss`
2. 在 `apps/webos-shell/src/styles/index.scss` 里 `@use 'my-widget';`
3. 用现有 token（`var(--webos-color-...)` / `var(--webos-spacing-...)`），不要新建颜色

---

## 不要做的事

- ❌ 在 shell 里引入 React / Vue / Lit 等框架（shell 是地基，永远轻）
- ❌ 给 shell 加自家业务（如"内置 CRM 应用"）—— 业务都是 iframe 应用，不进 shell
- ❌ 把 SDK 的代码复制到 shell 里（用 workspace 依赖共用）
- ❌ 改 RPC 协议（`webos.request / response / event` 三种 type 是稳定接口）
- ❌ 在 shell 里读 iframe 内的 DOM（跨 origin 拿不到，同 origin 也别这么干 —— 走 RPC）

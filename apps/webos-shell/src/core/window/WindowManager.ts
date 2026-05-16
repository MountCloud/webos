/**
 * 窗口管理器
 * 维护所有窗口实例、窗口栈、z-index 分配
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../../util'
import { Window } from './Window'
import { WindowDrag } from './WindowDrag'
import { WindowResize } from './WindowResize'
import type { WindowOptions } from './types'

const Z_INDEX_BASE = 100
const Z_INDEX_TOP = 99_000_000

export interface WindowManagerEvents {
  windowOpen: Window
  windowClose: Window
  windowFocus: Window
  activeChange: Window | null
  [key: string]: unknown
}

export class WindowManager extends EventEmitter<WindowManagerEvents> {
  private static _instance: WindowManager | null = null

  static get instance(): WindowManager {
    if (!WindowManager._instance) WindowManager._instance = new WindowManager()
    return WindowManager._instance
  }

  private windows = new Map<string, Window>()
  private stack: string[] = []
  private _container: HTMLElement | null = null

  // global 模态栈 + 全屏遮罩（多个 global modal 时栈 push/pop）
  private _globalModalStack: string[] = []
  private _globalMask: HTMLElement | null = null

  // 桌面容器（窗口挂载到这里）
  setContainer(container: HTMLElement): void {
    this._container = container
  }

  get container(): HTMLElement {
    return this._container ?? document.body
  }

  create(options: WindowOptions = {}): Window {
    const win = new Window(options)
    this.register(win)
    return win
  }

  // 注册一个已创建的 Window / AppWindow 实例（接管其生命周期）
  register<T extends Window>(win: T): T {
    this._register(win)
    if (!win.el.parentElement) {
      win.mount(this.container)
    }
    this._attachInteractions(win)
    this._reflowZIndex()
    this.focus(win)
    this.emit('windowOpen', win)
    return win
  }

  private _register(win: Window): void {
    this.windows.set(win.id, win)
    this.stack.push(win.id)

    win.on('close', () => {
      this._unregister(win)
    })

    win.on('focus', () => {
      this.focus(win)
    })
  }

  private _unregister(win: Window): void {
    this.windows.delete(win.id)
    this.stack = this.stack.filter((id) => id !== win.id)
    this.emit('windowClose', win)

    // 自动聚焦栈顶
    const top = this._topVisibleWindow()
    if (top) {
      this.focus(top)
    } else {
      this.emit('activeChange', null)
    }
  }

  private _attachInteractions(win: Window): void {
    if (win.options.draggable) {
      const drag = new WindowDrag(win)
      drag.attach()
      win.on('close', () => drag.detach())
    }
    if (win.options.resizable) {
      const resize = new WindowResize(win)
      resize.attach()
      win.on('close', () => resize.detach())
    }

    // 点击窗口任意位置自动聚焦
    win.el.addEventListener('mousedown', () => this.focus(win), true)
  }

  // 按 stack 顺序给所有窗口重排 z-index，避免计数器无限增长把窗口顶到任务栏上面
  private _reflowZIndex(): void {
    let normal = Z_INDEX_BASE
    let topmost = Z_INDEX_TOP
    for (const id of this.stack) {
      const w = this.windows.get(id)
      if (!w) continue
      if (w.options.alwaysOnTop) {
        w.zIndex = topmost++
      } else {
        w.zIndex = normal++
      }
    }
  }

  private _topVisibleWindow(): Window | null {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const w = this.windows.get(this.stack[i]!)
      if (w && w.state !== 'minimized' && w.state !== 'closed') {
        return w
      }
    }
    return null
  }

  // ===== 公共查询 / 操作 API =====

  get(id: string): Window | undefined {
    return this.windows.get(id)
  }

  getAll(): Window[] {
    return Array.from(this.windows.values())
  }

  getActive(): Window | null {
    return this._topVisibleWindow()
  }

  focus(win: Window): void {
    if (!this.windows.has(win.id)) return
    // 移动到栈顶
    this.stack = this.stack.filter((id) => id !== win.id)
    this.stack.push(win.id)
    // 视觉聚焦
    for (const w of this.windows.values()) {
      w.el.classList.toggle('webos-window--active', w === win)
    }
    this._reflowZIndex()
    if (win.state === 'minimized') {
      win.show()
    }
    this.emit('windowFocus', win)
    this.emit('activeChange', win)
  }

  async closeAll(): Promise<void> {
    for (const w of [...this.windows.values()]) {
      await w.close()
    }
  }

  // ============================================================
  // 模态控制（被 DialogWindow 在 open / close 时调）
  // ============================================================

  /**
   * 进入 'parent' 模态：让指定父窗口不可点击。
   * 用引用计数支持嵌套（dialog A 弹 dialog B 弹 dialog C，都 modal=parent 时 A 一直被锁）。
   */
  enterParentModal(parent: Window): void {
    parent.setDisabled('modal', true)
  }

  exitParentModal(parent: Window): void {
    parent.setDisabled('modal', false)
  }

  /**
   * 进入 'global' 模态：除 modal window 自己外整个桌面不可点。
   * 多个 global modal 时按栈管理，最后一个出栈才落 mask。
   */
  enterGlobalModal(modalWin: Window): void {
    this._globalModalStack.push(modalWin.id)
    this._ensureGlobalMask()
    if (this._globalMask) {
      // mask 的 z-index 紧贴在 modal 窗口下方
      this._globalMask.style.display = 'block'
      this._globalMask.style.zIndex = String((modalWin.zIndex || 0) - 1)
    }
  }

  exitGlobalModal(modalWin: Window): void {
    this._globalModalStack = this._globalModalStack.filter((id) => id !== modalWin.id)
    if (this._globalModalStack.length === 0) {
      if (this._globalMask) this._globalMask.style.display = 'none'
    } else {
      // 还有别的 global modal 在，把 mask 紧贴到剩下的栈顶下方
      const topId = this._globalModalStack[this._globalModalStack.length - 1]!
      const top = this.windows.get(topId)
      if (top && this._globalMask) {
        this._globalMask.style.zIndex = String((top.zIndex || 0) - 1)
      }
    }
  }

  private _ensureGlobalMask(): void {
    if (this._globalMask) return
    const mask = document.createElement('div')
    mask.className = 'webos-global-modal-mask'
    mask.style.cssText =
      'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.32); display: none;'
    // 拦截所有指针事件
    mask.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    mask.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    document.body.appendChild(mask)
    this._globalMask = mask
  }
}

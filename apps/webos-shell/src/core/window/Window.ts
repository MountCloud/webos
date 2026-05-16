/**
 * 浮动窗口
 * webos 桌面平台的核心 UI 容器，承载应用内容
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../UIElement'
import { createEl, htmlEncode, setStyle } from '../../helpers/dom'
import type {
  WindowBounds,
  WindowEvents,
  WindowHandle,
  WindowOptions,
  WindowState,
} from './types'

const DEFAULT_WIDTH = 680
const DEFAULT_HEIGHT = 380
const DEFAULT_MIN_WIDTH = 240
const DEFAULT_MIN_HEIGHT = 180
const HEAD_HEIGHT = 36

// 标题栏控制按钮图标（Windows 11 风格，currentColor 自动跟主题）
// 使用 12x12 viewBox + stroke-width 1，crispEdges 关掉抗锯齿避免发糊
const SVG_ATTR =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"'
const ICON_MINIMIZE = `<svg ${SVG_ATTR}><path d="M2 6h8" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/></svg>`
const ICON_MAXIMIZE = `<svg ${SVG_ATTR}><rect x="2.5" y="2.5" width="7" height="7" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>`
const ICON_RESTORE = `<svg ${SVG_ATTR}><path d="M4 4V2.5h5.5V8H8" stroke="currentColor" stroke-width="1" fill="none" stroke-linejoin="round"/><rect x="2.5" y="4" width="6" height="5.5" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>`
const ICON_CLOSE = `<svg ${SVG_ATTR}><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/></svg>`

export class Window extends UIElement<WindowEvents> implements WindowHandle {
  readonly options: Required<
    Pick<
      WindowOptions,
      | 'resizable'
      | 'draggable'
      | 'minimizable'
      | 'maximizable'
      | 'closable'
      | 'modal'
      | 'alwaysOnTop'
      | 'showInTaskbar'
      | 'center'
      | 'minWidth'
      | 'minHeight'
    >
  > &
    WindowOptions

  private _state: WindowState = 'normal'
  private _zIndex = 0
  private _restoreBounds: WindowBounds | null = null

  // DOM 引用
  private _head: HTMLElement | null = null
  private _body: HTMLElement | null = null
  private _disableMask: HTMLElement | null = null
  private _titleEl: HTMLElement | null = null
  private _iconEl: HTMLImageElement | null = null

  constructor(options: WindowOptions = {}) {
    super()
    this.options = {
      title: options.title ?? 'Untitled',
      icon: options.icon,
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      x: options.x,
      y: options.y,
      minWidth: options.minWidth ?? DEFAULT_MIN_WIDTH,
      minHeight: options.minHeight ?? DEFAULT_MIN_HEIGHT,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      resizable: options.resizable ?? true,
      draggable: options.draggable ?? true,
      minimizable: options.minimizable ?? true,
      maximizable: options.maximizable ?? true,
      closable: options.closable ?? true,
      modal: options.modal ?? false,
      parent: options.parent,
      alwaysOnTop: options.alwaysOnTop ?? false,
      showInTaskbar: options.showInTaskbar ?? true,
      center: options.center ?? false,
      body: options.body,
      className: options.className,
      data: options.data,
      onClose: options.onClose,
    } as Required<typeof this.options> & WindowOptions
  }

  get state(): WindowState {
    return this._state
  }

  set state(s: WindowState) {
    const from = this._state
    if (from === s) return
    this._state = s
    this.el.dataset.state = s
    this.emit('stateChange', { from, to: s })
  }

  get zIndex(): number {
    return this._zIndex
  }

  set zIndex(z: number) {
    this._zIndex = z
    if (this._el) this._el.style.zIndex = String(z)
  }

  get bounds(): WindowBounds {
    if (!this._el) return { x: 0, y: 0, width: 0, height: 0 }
    return {
      x: this._el.offsetLeft,
      y: this._el.offsetTop,
      width: this._el.offsetWidth,
      height: this._el.offsetHeight,
    }
  }

  get head(): HTMLElement {
    void this.el
    return this._head!
  }

  get body(): HTMLElement {
    void this.el
    return this._body!
  }

  protected render(): HTMLElement {
    const el = createEl('div', {
      className: ['webos-window', this.options.className].filter(Boolean).join(' '),
      attrs: { tabindex: '-1' },
      dataset: { state: this._state },
    })

    // 计算尺寸
    const w = typeof this.options.width === 'number' ? `${this.options.width}px` : this.options.width!
    const h = typeof this.options.height === 'number' ? `${this.options.height}px` : this.options.height!
    setStyle(el, { width: w, height: h, position: 'fixed' })

    // 计算初始位置（居中）
    const winW = window.innerWidth
    const winH = window.innerHeight
    const widthPx = typeof this.options.width === 'number' ? this.options.width : DEFAULT_WIDTH
    const heightPx = typeof this.options.height === 'number' ? this.options.height : DEFAULT_HEIGHT
    const left = this.options.x ?? Math.max(0, (winW - widthPx) / 2)
    const top = this.options.y ?? Math.max(0, (winH - heightPx) / 3)
    setStyle(el, { left: `${left}px`, top: `${top}px` })

    // 标题栏
    this._head = this._buildHead()
    el.appendChild(this._head)

    // 内容区
    this._body = createEl('div', { className: 'webos-window-body' })
    el.appendChild(this._body)

    // 禁用遮罩（busy / modal 用）
    this._disableMask = createEl('div', {
      className: 'webos-window-disable-mask',
      style: { display: 'none' },
    })
    el.appendChild(this._disableMask)

    // 应用 body 内容
    this._applyBody()

    // 缩放手柄：4 边 + 4 角共 8 个透明 div，盖在 iframe 上面（z-index 高于 iframe）
    // 这样跨 origin iframe 也能从边缘触发 resize —— 否则 iframe 会把鼠标事件全吞
    if (this.options.resizable) {
      const dirs = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'] as const
      for (const dir of dirs) {
        el.appendChild(
          createEl('div', {
            className: `webos-window-resize-handle webos-window-resize-handle--${dir}`,
          }),
        )
      }
    }

    return el
  }

  private _buildHead(): HTMLElement {
    const head = createEl('div', { className: 'webos-window-head' })

    // 拖动区（含图标 + 标题）
    const draggable = createEl('div', { className: 'webos-window-head-draggable' })

    if (this.options.icon) {
      this._iconEl = createEl('img', {
        className: 'webos-window-head-icon',
        attrs: { src: this.options.icon, alt: '', draggable: 'false' },
      })
      draggable.appendChild(this._iconEl)
    }

    this._titleEl = createEl('span', {
      className: 'webos-window-head-title',
      text: this.options.title ?? '',
    })
    draggable.appendChild(this._titleEl)
    head.appendChild(draggable)

    // 控制按钮（最小化 / 最大化 / 关闭）
    const controls = createEl('div', { className: 'webos-window-head-controls' })

    if (this.options.minimizable) {
      const btn = createEl('button', {
        className: 'webos-window-action-btn webos-window-action-btn--minimize',
        attrs: { type: 'button', 'aria-label': '最小化', title: '最小化' },
      })
      btn.innerHTML = ICON_MINIMIZE
      this.addDomListener(btn, 'click', (e) => {
        e.stopPropagation()
        this.minimize()
      })
      controls.appendChild(btn)
    }

    if (this.options.maximizable) {
      const btn = createEl('button', {
        className: 'webos-window-action-btn webos-window-action-btn--maximize',
        attrs: { type: 'button', 'aria-label': '最大化', title: '最大化' },
      })
      btn.innerHTML = ICON_MAXIMIZE
      const updateIcon = (): void => {
        if (this._state === 'maximized') {
          btn.innerHTML = ICON_RESTORE
          btn.setAttribute('aria-label', '还原')
          btn.setAttribute('title', '还原')
        } else {
          btn.innerHTML = ICON_MAXIMIZE
          btn.setAttribute('aria-label', '最大化')
          btn.setAttribute('title', '最大化')
        }
      }
      this.on('stateChange', updateIcon)
      this.addDomListener(btn, 'click', (e) => {
        e.stopPropagation()
        if (this._state === 'maximized') this.restore()
        else this.maximize()
      })
      controls.appendChild(btn)
    }

    if (this.options.closable) {
      const btn = createEl('button', {
        className: 'webos-window-action-btn webos-window-action-btn--close',
        attrs: { type: 'button', 'aria-label': '关闭', title: '关闭' },
      })
      btn.innerHTML = ICON_CLOSE
      this.addDomListener(btn, 'click', (e) => {
        e.stopPropagation()
        void this.close()
      })
      controls.appendChild(btn)
    }

    head.appendChild(controls)

    // 双击标题栏切换最大化
    if (this.options.maximizable) {
      this.addDomListener(draggable, 'dblclick', () => {
        if (this._state === 'maximized') this.restore()
        else this.maximize()
      })
    }

    return head
  }

  private _applyBody(): void {
    if (!this._body) return
    const b = this.options.body
    if (!b) return
    if (typeof b === 'string') {
      this._body.innerHTML = b
    } else if (typeof b === 'function') {
      b(this._body)
    } else {
      this._body.appendChild(b)
    }
  }

  // ===== 操作 API =====

  setTitle(title: string): void {
    this.options.title = title
    if (this._titleEl) {
      this._titleEl.textContent = title
      this._titleEl.title = title
    }
    this.emit('titleChange', title)
  }

  setIcon(icon: string): void {
    this.options.icon = icon
    if (!this._iconEl) {
      this._iconEl = createEl('img', {
        className: 'webos-window-head-icon',
        attrs: { src: icon, alt: '', draggable: 'false' },
      })
      this._head?.querySelector('.webos-window-head-draggable')?.prepend(this._iconEl)
    } else {
      this._iconEl.src = icon
    }
    this.emit('iconChange', icon)
  }

  setBounds(b: Partial<WindowBounds>): void {
    if (!this._el) return
    if (b.x !== undefined) this._el.style.left = `${b.x}px`
    if (b.y !== undefined) this._el.style.top = `${b.y}px`
    if (b.width !== undefined) this._el.style.width = `${b.width}px`
    if (b.height !== undefined) this._el.style.height = `${b.height}px`
    if (b.width !== undefined || b.height !== undefined) {
      this.emit('resize', { width: this._el.offsetWidth, height: this._el.offsetHeight })
    }
    if (b.x !== undefined || b.y !== undefined) {
      this.emit('move', { x: this._el.offsetLeft, y: this._el.offsetTop })
    }
  }

  setSize(width: number, height: number): void {
    this.setBounds({ width, height })
  }

  center(): void {
    if (!this._el) return
    const w = this._el.offsetWidth
    const h = this._el.offsetHeight
    const topReserve =
      (parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--webos-top-bar-height'),
        10,
      ) || 40) +
      (parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--webos-top-bar-margin'),
        10,
      ) || 12) *
        2
    const usableH = window.innerHeight - topReserve - 16
    this._el.style.left = `${Math.max(0, (window.innerWidth - w) / 2)}px`
    this._el.style.top = `${Math.max(topReserve, (usableH - h) / 2 + topReserve)}px`
  }

  setBusy(busy: boolean): void {
    this._setDisabledReason('busy', busy)
  }

  /**
   * 模态阻塞：被打开的 modal=parent 类型 dialog 调，让父窗口不可点。
   * 多个 modal 嵌套时按引用计数累加；setDisabled('modal', false) 减一，归零时才真正落下 mask。
   */
  setDisabled(reason: 'modal' | 'busy', on: boolean): void {
    this._setDisabledReason(reason, on)
  }

  private _disableReasons = new Set<string>()
  private _modalRefCount = 0
  private _setDisabledReason(reason: 'modal' | 'busy', on: boolean): void {
    if (reason === 'modal') {
      this._modalRefCount += on ? 1 : -1
      if (this._modalRefCount < 0) this._modalRefCount = 0
      if (this._modalRefCount > 0) this._disableReasons.add('modal')
      else this._disableReasons.delete('modal')
    } else {
      if (on) this._disableReasons.add(reason)
      else this._disableReasons.delete(reason)
    }
    const disabled = this._disableReasons.size > 0
    if (this._disableMask) {
      this._disableMask.style.display = disabled ? 'block' : 'none'
    }
    this.el.classList.toggle('webos-window--busy', this._disableReasons.has('busy'))
    this.el.classList.toggle('webos-window--modal-blocked', this._disableReasons.has('modal'))
  }

  setBody(content: HTMLElement | string): void {
    if (!this._body) return
    this._body.innerHTML = ''
    if (typeof content === 'string') {
      this._body.innerHTML = content
    } else {
      this._body.appendChild(content)
    }
  }

  // ===== 状态切换 =====

  focus(): void {
    if (this._destroyed) return
    this.emit('focus', undefined)
    // WindowManager 会监听 focus 事件做 z-index 调整
  }

  maximize(): void {
    if (this._state === 'maximized' || !this._el) return
    this._restoreBounds = this.bounds
    // 用 top/left/right/bottom 完全约束让浏览器自行计算尺寸，
    // 避免 calc(100vh - calc(...)) 嵌套在某些场景下产生 1-2px 渲染误差导致底部空白
    const topReserve = 'calc(var(--webos-top-bar-height, 40px) + var(--webos-top-bar-margin, 12px) * 2)'
    setStyle(this._el, {
      left: '0',
      top: topReserve,
      right: '0',
      bottom: '0',
      width: 'auto',
      height: 'auto',
    })
    this.state = 'maximized'
    this.emit('maximize', undefined)
  }

  restore(): void {
    if (this._state !== 'maximized' || !this._el) return
    // 先清掉 maximize 写入的 right/bottom；否则 setBounds 设 width/height 后
    // 会被遗留的 right:0/bottom:0 强行拉伸到铺满
    setStyle(this._el, { right: '', bottom: '' })
    if (this._restoreBounds) {
      this.setBounds(this._restoreBounds)
    }
    this.state = 'normal'
    this.emit('restore', undefined)
  }

  minimize(): void {
    if (this._state === 'minimized' || !this._el) return
    this.el.style.display = 'none'
    this.state = 'minimized'
    this.emit('minimize', undefined)
  }

  show(): void {
    if (this._state !== 'minimized' || !this._el) return
    this.el.style.display = ''
    this.state = 'normal'
  }

  async close(): Promise<boolean> {
    if (this._destroyed || this._state === 'closed') return true

    // 触发 beforeClose，外部可取消
    let cancelled = false
    const payload = {
      cancel: () => {
        cancelled = true
      },
      cancelled: false,
    }
    this.emit('beforeClose', payload)
    if (cancelled) return false

    // 用户回调
    if (this.options.onClose) {
      const ok = await this.options.onClose()
      if (ok === false) return false
    }

    this.state = 'closed'
    this.emit('close', undefined)
    this.destroy()
    return true
  }
}

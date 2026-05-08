/**
 * UI 组件基类
 * 所有桌面、窗口、对话框等 UI 组件继承此类
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter, type EventMap } from '../util'
import { shortId } from '../util'
import { removeEl } from '../helpers/dom'

export interface UIElementOptions {
  id?: string
  className?: string
  parent?: HTMLElement
}

export abstract class UIElement<Events extends EventMap = EventMap> extends EventEmitter<Events> {
  readonly id: string
  protected _el: HTMLElement | null = null
  protected _destroyed = false
  private _disposers: Array<() => void> = []

  constructor(options: UIElementOptions = {}) {
    super()
    this.id = options.id ?? shortId(this.constructor.name.toLowerCase())
  }

  // 子类实现：构建并返回根 DOM 节点
  protected abstract render(): HTMLElement

  get el(): HTMLElement {
    if (!this._el) {
      this._el = this.render()
      this._el.dataset.webosId = this.id
    }
    return this._el
  }

  get destroyed(): boolean {
    return this._destroyed
  }

  // 挂载到父节点
  mount(parent: HTMLElement): this {
    if (this._destroyed) {
      throw new Error(`[UIElement] cannot mount destroyed element: ${this.id}`)
    }
    parent.appendChild(this.el)
    this.onMount()
    return this
  }

  // 从父节点卸下（不销毁）
  unmount(): this {
    removeEl(this._el)
    this.onUnmount()
    return this
  }

  // 销毁（释放资源、移除 DOM）
  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    for (const fn of this._disposers) {
      try {
        fn()
      } catch (e) {
        console.error('[UIElement] disposer error:', e)
      }
    }
    this._disposers = []
    removeEl(this._el)
    this._el = null
    this.removeAllListeners()
    this.onDestroy()
  }

  // 注册一个清理函数，destroy 时自动调用
  protected addDisposer(fn: () => void): void {
    this._disposers.push(fn)
  }

  // 注册 DOM 事件，destroy 时自动解绑
  protected addDomListener<K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K,
    listener: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener as EventListener, options)
    this.addDisposer(() => target.removeEventListener(type, listener as EventListener, options))
  }

  // 生命周期钩子（子类可覆写）
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onDestroy(): void {}
}

/**
 * Dock 项 —— 一个运行中的窗口
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../UIElement'
import { createEl } from '../../helpers/dom'
import { showContextMenu } from '../dialog/ContextMenu'
import type { ContextMenuItem } from '../../helpers/contextMenu'

export interface DockItemOptions {
  appId: string
  windowId: string
  name: string
  icon: string
}

export interface DockItemEvents {
  click: void
  contextMenu: { x: number; y: number }
  closeRequested: void
  closeAppRequested: void
  [key: string]: unknown
}

export class DockItem extends UIElement<DockItemEvents> {
  readonly options: DockItemOptions
  private _active = false
  private _badge: number | null = null
  private _badgeEl: HTMLElement | null = null
  private _imgEl: HTMLImageElement | null = null

  constructor(options: DockItemOptions) {
    super({ id: `dock-item-${options.windowId}` })
    this.options = options
  }

  protected render(): HTMLElement {
    const el = createEl('div', {
      className: 'webos-dock-item',
      attrs: {
        title: this.options.name,
        'data-app-id': this.options.appId,
        'data-window-id': this.options.windowId,
      },
    })

    this._imgEl = createEl('img', {
      className: 'webos-dock-item-icon',
      attrs: { src: this.options.icon, alt: this.options.name, draggable: 'false' },
    })
    el.appendChild(this._imgEl)

    this._badgeEl = createEl('span', {
      className: 'webos-dock-item-badge',
      style: { display: 'none' },
    })
    el.appendChild(this._badgeEl)

    // 活动指示器（小圆点）
    const indicator = createEl('span', { className: 'webos-dock-item-indicator' })
    el.appendChild(indicator)

    this.addDomListener(el, 'click', () => this.emit('click', undefined))
    this.addDomListener(el, 'contextmenu', (e) => {
      e.preventDefault()
      this.emit('contextMenu', { x: e.clientX, y: e.clientY })
      this._showDefaultMenu(e.clientX, e.clientY)
    })

    return el
  }

  setActive(active: boolean): void {
    this._active = active
    this.el.classList.toggle('webos-dock-item--active', active)
  }

  get active(): boolean {
    return this._active
  }

  setBadge(n: number | null): void {
    this._badge = n
    if (!this._badgeEl) return
    if (n === null || n <= 0) {
      this._badgeEl.style.display = 'none'
    } else {
      this._badgeEl.textContent = n > 99 ? '99+' : String(n)
      this._badgeEl.style.display = ''
    }
  }

  get badge(): number | null {
    return this._badge
  }

  setIcon(icon: string): void {
    if (this._imgEl) this._imgEl.src = icon
  }

  setName(name: string): void {
    this.options.name = name
    this.el.title = name
  }

  private _showDefaultMenu(x: number, y: number): void {
    const items: ContextMenuItem[] = [
      {
        label: '关闭窗口',
        onClick: () => this.emit('closeRequested', undefined),
      },
      {
        label: '关闭该应用全部窗口',
        onClick: () => this.emit('closeAppRequested', undefined),
      },
    ]
    showContextMenu({ items, x, y })
  }
}

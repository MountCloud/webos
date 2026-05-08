/**
 * 桌面壳
 * 提供桌面背景、图标网格、右键菜单
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../UIElement'
import { createEl } from '../../helpers/dom'
import { showContextMenu } from '../dialog/ContextMenu'
import { IconItem, type IconItemOptions } from './IconItem'
import type { ContextMenuItem } from '../../helpers/contextMenu'

export interface DesktopOptions {
  background?: string // CSS 值（图片 URL / 颜色 / 渐变）
  contextMenu?: () => ContextMenuItem[]
}

export interface DesktopEvents {
  iconClick: IconItem
  iconDblClick: IconItem
  [key: string]: unknown
}

export class Desktop extends UIElement<DesktopEvents> {
  private _bgEl: HTMLElement | null = null
  private _iconLayer: HTMLElement | null = null
  private _windowLayer: HTMLElement | null = null
  private _icons = new Map<string, IconItem>()

  constructor(private readonly opts: DesktopOptions = {}) {
    super({ id: 'desktop' })
  }

  protected render(): HTMLElement {
    const root = createEl('div', { className: 'webos-desktop' })

    this._bgEl = createEl('div', { className: 'webos-desktop-bg' })
    if (this.opts.background) {
      this._bgEl.style.background = this.opts.background
    }
    root.appendChild(this._bgEl)

    this._iconLayer = createEl('div', { className: 'webos-desktop-icons' })
    root.appendChild(this._iconLayer)

    this._windowLayer = createEl('div', { className: 'webos-desktop-windows' })
    root.appendChild(this._windowLayer)

    // 桌面右键菜单
    this.addDomListener(root, 'contextmenu', (e) => {
      // 仅当点击在桌面背景或图标层（非窗口区）时触发
      const target = e.target as HTMLElement
      if (target.closest('.webos-window')) return
      e.preventDefault()
      const items = this.opts.contextMenu?.() ?? this._defaultContextMenu()
      if (items.length > 0) {
        showContextMenu({ items, x: e.clientX, y: e.clientY })
      }
    })

    return root
  }

  // 给 WindowManager 提供窗口挂载点
  get windowLayer(): HTMLElement {
    void this.el
    return this._windowLayer!
  }

  setBackground(bg: string): void {
    if (this._bgEl) this._bgEl.style.background = bg
  }

  addIcon(options: IconItemOptions): IconItem {
    if (this._icons.has(options.id)) {
      return this._icons.get(options.id)!
    }
    const icon = new IconItem(options)
    this._icons.set(options.id, icon)
    icon.mount(this._iconLayer!)
    icon.on('click', () => this.emit('iconClick', icon))
    icon.on('dblClick', () => this.emit('iconDblClick', icon))
    return icon
  }

  removeIcon(id: string): void {
    const icon = this._icons.get(id)
    if (icon) {
      icon.destroy()
      this._icons.delete(id)
    }
  }

  getIcon(id: string): IconItem | undefined {
    return this._icons.get(id)
  }

  getAllIcons(): IconItem[] {
    return [...this._icons.values()]
  }

  private _defaultContextMenu(): ContextMenuItem[] {
    return [
      { label: '刷新', onClick: () => location.reload() },
      { label: '-' },
      {
        label: '关于 webos',
        onClick: () => {
          import('../dialog/Alert').then(({ alert }) => {
            void alert('webos v1.0.0\n\n通用 Web 桌面平台\n\n作者：MountCloud', '关于')
          })
        },
      },
    ]
  }
}

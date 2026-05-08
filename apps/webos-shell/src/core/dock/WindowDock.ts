/**
 * 底部居中悬浮 Dock
 * 一窗一项；空时整体隐藏
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../UIElement'
import { createEl } from '../../helpers/dom'
import { DockItem, type DockItemOptions } from './DockItem'

export interface WindowDockEvents {
  itemClick: { item: DockItem }
  itemCloseRequested: { item: DockItem }
  itemCloseAppRequested: { item: DockItem }
  [key: string]: unknown
}

export class WindowDock extends UIElement<WindowDockEvents> {
  private _items = new Map<string, DockItem>()
  private _itemsContainer: HTMLElement | null = null

  constructor() {
    super({ id: 'dock' })
  }

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-dock webos-dock--empty' })
    this._itemsContainer = createEl('div', { className: 'webos-dock-items' })
    el.appendChild(this._itemsContainer)
    return el
  }

  // 一窗一项；windowId 是 Window.id（DOM 唯一）
  addItem(options: DockItemOptions): DockItem {
    const existing = this._items.get(options.windowId)
    if (existing) return existing

    const item = new DockItem(options)
    this._items.set(options.windowId, item)
    item.mount(this._itemsContainer!)

    item.on('click', () => this.emit('itemClick', { item }))
    item.on('closeRequested', () => this.emit('itemCloseRequested', { item }))
    item.on('closeAppRequested', () => this.emit('itemCloseAppRequested', { item }))

    this._refreshEmpty()
    return item
  }

  removeItem(windowId: string): void {
    const item = this._items.get(windowId)
    if (!item) return
    item.destroy()
    this._items.delete(windowId)
    this._refreshEmpty()
  }

  getItem(windowId: string): DockItem | undefined {
    return this._items.get(windowId)
  }

  // 把指定窗口设为活动态，其他全部置非活动
  setActive(windowId: string | null): void {
    for (const [id, item] of this._items) {
      item.setActive(id === windowId)
    }
  }

  // 同应用的所有项里找出 windowId
  findByApp(appId: string): DockItem[] {
    return [...this._items.values()].filter((it) => it.options.appId === appId)
  }

  private _refreshEmpty(): void {
    this.el.classList.toggle('webos-dock--empty', this._items.size === 0)
  }
}

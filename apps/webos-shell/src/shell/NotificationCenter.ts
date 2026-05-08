/**
 * 通知中心
 * 聚合所有桌面通知，提供历史查看 + 一键清空
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl, removeEl } from '../helpers/dom'
import { t } from '../i18n'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)

export interface NotificationRecord {
  id: string
  title: string
  message?: string
  level: 'info' | 'success' | 'warning' | 'critical'
  timestamp: number
}

const MAX_HISTORY = 50

export class NotificationCenter extends UIElement {
  private static _instance: NotificationCenter | null = null

  static get instance(): NotificationCenter {
    if (!NotificationCenter._instance) {
      NotificationCenter._instance = new NotificationCenter()
    }
    return NotificationCenter._instance
  }

  private history: NotificationRecord[] = []
  private _isOpen = false
  private _listEl: HTMLElement | null = null
  private _badgeCallback: ((count: number) => void) | null = null
  private _unreadCount = 0
  // close 动画延迟移除节点的 timer；open 时清掉防止反向干掉新打开
  private _removeTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super({ id: 'notification-center' })
  }

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-notification-center' })

    const header = createEl('div', { className: 'webos-notification-center-header' })
    header.appendChild(createEl('span', { text: t('notifications') }))
    const clearBtn = createEl('button', {
      className: 'webos-btn webos-btn--text',
      attrs: { type: 'button' },
      text: '清空',
    })
    clearBtn.addEventListener('click', () => this.clear())
    header.appendChild(clearBtn)
    el.appendChild(header)

    this._listEl = createEl('div', { className: 'webos-notification-center-list' })
    el.appendChild(this._listEl)

    // 注：之前这里 stopPropagation 是冗余防御 —— _onOutsideClick 已经检查
    // contains，不需要拦截。继续拦会让用户在通知中心里没法选词。
    return el
  }

  // 记录一条通知
  record(record: Omit<NotificationRecord, 'id' | 'timestamp'>): void {
    const item: NotificationRecord = {
      ...record,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }
    this.history.unshift(item)
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY)
    }
    if (!this._isOpen) {
      this._unreadCount++
      this._badgeCallback?.(this._unreadCount)
    }
    this._renderList()
  }

  setBadgeCallback(cb: (count: number) => void): void {
    this._badgeCallback = cb
  }

  open(anchor: { x: number; y: number }): void {
    if (this._isOpen) return
    this._isOpen = true
    this._unreadCount = 0
    this._badgeCallback?.(0)
    if (this._removeTimer) {
      clearTimeout(this._removeTimer)
      this._removeTimer = null
    }
    document.body.appendChild(this.el)
    this._renderList()
    requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect()
      let left = anchor.x - rect.width
      let top = anchor.y + 12
      if (left < 8) left = 8
      if (top + rect.height > window.innerHeight - 8) {
        top = anchor.y - rect.height - 8
      }
      this.el.style.left = `${left}px`
      this.el.style.top = `${Math.max(8, top)}px`
      this.el.classList.add('webos-notification-center--shown')
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
    this.el.classList.remove('webos-notification-center--shown')
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

  clear(): void {
    this.history = []
    this._unreadCount = 0
    this._badgeCallback?.(0)
    this._renderList()
  }

  private _renderList(): void {
    if (!this._listEl) return
    this._listEl.innerHTML = ''
    if (this.history.length === 0) {
      this._listEl.appendChild(
        createEl('div', { className: 'webos-notification-center-empty', text: t('notifications_empty') }),
      )
      return
    }
    for (const item of this.history) {
      const itemEl = createEl('div', {
        className: `webos-notification-center-item webos-notification-center-item--${item.level}`,
      })
      itemEl.appendChild(createEl('div', { className: 'webos-notification-center-item-title', text: item.title }))
      if (item.message) {
        itemEl.appendChild(
          createEl('div', { className: 'webos-notification-center-item-message', text: item.message }),
        )
      }
      itemEl.appendChild(
        createEl('div', {
          className: 'webos-notification-center-item-time',
          text: dayjs(item.timestamp).fromNow(),
        }),
      )
      this._listEl.appendChild(itemEl)
    }
  }

  private _onOutsideClick = (e: MouseEvent): void => {
    if (!this._isOpen) return
    if (!this.el.contains(e.target as Node)) {
      this.close()
    }
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }
}

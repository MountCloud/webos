/**
 * 右上角胶囊：消息 / 用户 / 设置 / 搜索
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl } from '../helpers/dom'

export interface TopRightBarEvents {
  notificationClick: { x: number; y: number }
  userClick: { x: number; y: number }
  settingsClick: { x: number; y: number }
  searchClick: void
  /** 开发期"测试程序"按钮点击；仅在 main.ts 调用 enableTestAppButton() 后触发 */
  plusClick: void
  [key: string]: unknown
}

interface BtnSpec {
  className: string
  title: string
  svg: string
  evt: keyof TopRightBarEvents
}

const BTNS: BtnSpec[] = [
  {
    className: 'webos-top-right-notify',
    title: '消息',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.5L4 15h16l-2-2.5V9a6 6 0 0 0-6-6zM10 18a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    evt: 'notificationClick',
  },
  {
    className: 'webos-top-right-user',
    title: '个人',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
    evt: 'userClick',
  },
  {
    className: 'webos-top-right-settings',
    title: '设置',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.4.6 1 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>`,
    evt: 'settingsClick',
  },
  {
    className: 'webos-top-right-search',
    title: '搜索（Cmd/Ctrl + K）',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    evt: 'searchClick',
  },
]

export class TopRightBar extends UIElement<TopRightBarEvents> {
  private _notifyBadgeEl: HTMLElement | null = null

  constructor() {
    super({ id: 'top-right-bar' })
  }

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-top-right' })

    for (const spec of BTNS) {
      const btn = createEl('button', {
        className: `webos-top-right-btn ${spec.className}`,
        attrs: { type: 'button', title: spec.title, 'aria-label': spec.title },
      })
      btn.innerHTML = spec.svg

      // 通知按钮挂徽章节点（外部 setNotificationBadge 用）
      if (spec.evt === 'notificationClick') {
        const badge = createEl('span', {
          className: 'webos-top-right-badge',
          style: { display: 'none' },
        })
        btn.appendChild(badge)
        this._notifyBadgeEl = badge
      }

      this.addDomListener(btn, 'click', () => {
        if (spec.evt === 'searchClick') {
          this.emit('searchClick', undefined)
          return
        }
        // 所有下拉面板用同一个锚点：胶囊整体的右下角
        // 这样无论点哪个按钮，弹出位置都贴着胶囊右边对齐，视觉一致
        const clusterRect = this.el.getBoundingClientRect()
        this.emit(spec.evt, { x: clusterRect.right, y: clusterRect.bottom + 4 })
      })

      el.appendChild(btn)
    }

    return el
  }

  setNotificationBadge(count: number): void {
    if (!this._notifyBadgeEl) return
    if (count <= 0) {
      this._notifyBadgeEl.style.display = 'none'
    } else {
      this._notifyBadgeEl.textContent = count > 99 ? '99+' : String(count)
      this._notifyBadgeEl.style.display = ''
    }
  }

  /**
   * 启用右侧 "+" 按钮（仅开发期）。
   * 默认不渲染——main.ts 用 import.meta.env.DEV 守门后调用一次即可。
   * 重复调用安全（只挂一次）。
   */
  enableTestAppButton(title = '添加测试程序（仅开发期）'): void {
    if (this._plusBtnEl) return
    const btn = createEl('button', {
      className: 'webos-top-right-btn webos-top-right-add',
      attrs: { type: 'button', title, 'aria-label': title },
    })
    // SVG 风格跟其他按钮对齐：24×24 viewBox、stroke="currentColor" 1.6、linecap round
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      '</svg>'
    this.addDomListener(btn, 'click', () => this.emit('plusClick', undefined))
    this.el.appendChild(btn)
    this._plusBtnEl = btn
  }

  private _plusBtnEl: HTMLElement | null = null
}

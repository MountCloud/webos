/**
 * 左上角胶囊：显示桌面 + 主菜单
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl } from '../helpers/dom'

export interface TopLeftBarEvents {
  showDesktopClick: void
  menuClick: { x: number; y: number }
  [key: string]: unknown
}

export class TopLeftBar extends UIElement<TopLeftBarEvents> {
  constructor() {
    super({ id: 'top-left-bar' })
  }

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-top-left' })

    // 显示桌面：细长条
    const showDesktop = createEl('button', {
      className: 'webos-top-left-show-desktop',
      attrs: { type: 'button', title: '显示桌面', 'aria-label': '显示桌面' },
    })
    // 一根竖线
    showDesktop.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 24" width="8" height="24" aria-hidden="true"><path d="M3 4v16M8 4v16M13 4v16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.85"/></svg>`
    this.addDomListener(showDesktop, 'click', () => this.emit('showDesktopClick', undefined))
    el.appendChild(showDesktop)

    // 主菜单：4 圆点矩阵（比"田"字现代）
    const menuBtn = createEl('button', {
      className: 'webos-top-left-menu',
      attrs: { type: 'button', title: '主菜单', 'aria-label': '主菜单' },
    })
    menuBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="6" cy="6" r="2.4" fill="currentColor"/><circle cx="18" cy="6" r="2.4" fill="currentColor"/><circle cx="6" cy="18" r="2.4" fill="currentColor"/><circle cx="18" cy="18" r="2.4" fill="currentColor"/></svg>`
    this.addDomListener(menuBtn, 'click', () => {
      const rect = menuBtn.getBoundingClientRect()
      this.emit('menuClick', { x: rect.left, y: rect.bottom + 4 })
    })
    el.appendChild(menuBtn)

    return el
  }
}

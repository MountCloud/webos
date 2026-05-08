/**
 * 桌面图标项
 * 通用图标，承载应用、快捷方式等
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../UIElement'
import { createEl } from '../../helpers/dom'
import type { ContextMenuItem } from '../../helpers/contextMenu'
import { showContextMenu } from '../dialog/ContextMenu'

export interface IconItemOptions {
  id: string
  name: string
  icon: string
  // 角标：右上角小标识。用于标示"会新开浏览器标签"等
  externalBadge?: boolean
  contextMenu?: ContextMenuItem[]
  onClick?: () => void
  onDblClick?: () => void
}

export interface IconItemEvents {
  click: void
  dblClick: void
  [key: string]: unknown
}

export class IconItem extends UIElement<IconItemEvents> {
  readonly options: IconItemOptions

  constructor(options: IconItemOptions) {
    super({ id: options.id })
    this.options = options
  }

  protected render(): HTMLElement {
    const el = createEl('div', {
      className: 'webos-icon-item',
      attrs: { 'data-id': this.options.id, tabindex: '0' },
    })

    const imgWrap = createEl('div', {
      className: 'webos-icon-item-image',
      children: [
        createEl('img', {
          attrs: { src: this.options.icon, alt: this.options.name, draggable: 'false' },
        }),
      ],
    })
    if (this.options.externalBadge) {
      const badge = createEl('span', { className: 'webos-icon-item-external-badge' })
      badge.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4 8l4-4M5 4h3v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
      imgWrap.appendChild(badge)
    }
    el.appendChild(imgWrap)
    el.appendChild(
      createEl('div', { className: 'webos-icon-item-label', text: this.options.name }),
    )

    let clickTimer: ReturnType<typeof setTimeout> | null = null

    this.addDomListener(el, 'click', () => {
      if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
        this.emit('dblClick', undefined)
        this.options.onDblClick?.()
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null
          this.emit('click', undefined)
          this.options.onClick?.()
        }, 220)
      }
    })

    if (this.options.contextMenu && this.options.contextMenu.length > 0) {
      this.addDomListener(el, 'contextmenu', (e) => {
        e.preventDefault()
        showContextMenu({
          items: this.options.contextMenu!,
          x: e.clientX,
          y: e.clientY,
        })
      })
    }

    return el
  }
}

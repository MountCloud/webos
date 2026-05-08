/**
 * 上下文菜单（右键菜单）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { createEl, removeEl } from '../../helpers/dom'
import type { ContextMenuItem } from '../../helpers/contextMenu'
import { isDivider } from '../../helpers/contextMenu'

export interface ContextMenuOptions {
  items: ContextMenuItem[]
  x: number
  y: number
}

let activeMenu: HTMLElement | null = null
let listenersInstalled = false

export function showContextMenu(options: ContextMenuOptions): void {
  // 关掉旧菜单（可能本次调用就是"切换菜单"场景）
  closeActive()

  const menu = buildMenu(options.items)
  document.body.appendChild(menu)

  // 定位（避免溢出屏幕）
  const rect = menu.getBoundingClientRect()
  let left = options.x
  let top = options.y
  if (left + rect.width > window.innerWidth) {
    left = window.innerWidth - rect.width - 4
  }
  if (top + rect.height > window.innerHeight) {
    top = window.innerHeight - rect.height - 4
  }
  menu.style.left = `${Math.max(0, left)}px`
  menu.style.top = `${Math.max(0, top)}px`

  activeMenu = menu
  installListeners()
}

export function closeActive(): void {
  if (activeMenu) {
    removeEl(activeMenu)
    activeMenu = null
  }
  uninstallListeners()
}

// ===== 监听器管理 =====
// 用 capture 阶段保证菜单关闭逻辑跑在 desktop / taskbar 等上层 contextmenu
// 监听之前 —— 否则同一次右键事件会被旧监听把刚弹的新菜单又关掉。

function installListeners(): void {
  if (listenersInstalled) return
  listenersInstalled = true
  document.addEventListener('mousedown', onPointerDown, true)
  document.addEventListener('contextmenu', onContextMenu, true)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('blur', closeActive)
  window.addEventListener('resize', closeActive)
  // 滚动时也关，但只关一次（避免菜单内部 overflow 滚动也关掉）
  document.addEventListener('scroll', onScroll, true)
}

function uninstallListeners(): void {
  if (!listenersInstalled) return
  listenersInstalled = false
  document.removeEventListener('mousedown', onPointerDown, true)
  document.removeEventListener('contextmenu', onContextMenu, true)
  document.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('blur', closeActive)
  window.removeEventListener('resize', closeActive)
  document.removeEventListener('scroll', onScroll, true)
}

function onPointerDown(e: Event): void {
  if (!activeMenu) return
  if (!activeMenu.contains(e.target as Node)) {
    closeActive()
  }
}

function onContextMenu(e: Event): void {
  // 注意：不要 stopPropagation —— 让上层（Desktop / Taskbar）继续接到事件
  // 重新弹一个新菜单。这里只负责把当前菜单关掉。
  if (!activeMenu) return
  if (!activeMenu.contains(e.target as Node)) {
    closeActive()
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeActive()
  }
}

function onScroll(e: Event): void {
  if (!activeMenu) return
  // 菜单内部滚动不关
  if (activeMenu.contains(e.target as Node)) return
  closeActive()
}

// ===== 渲染 =====

function buildMenu(items: ContextMenuItem[]): HTMLElement {
  const menu = createEl('div', { className: 'webos-context-menu' })

  for (const item of items) {
    if (isDivider(item)) {
      menu.appendChild(createEl('div', { className: 'webos-context-menu-divider' }))
      continue
    }

    const itemEl = createEl('div', {
      className: [
        'webos-context-menu-item',
        item.disabled ? 'webos-context-menu-item--disabled' : '',
        item.danger ? 'webos-context-menu-item--danger' : '',
      ]
        .filter(Boolean)
        .join(' '),
    })

    if (item.icon) {
      itemEl.appendChild(
        createEl('span', { className: 'webos-context-menu-item-icon', html: item.icon }),
      )
    }
    itemEl.appendChild(
      createEl('span', { className: 'webos-context-menu-item-label', text: item.label ?? '' }),
    )
    if (item.shortcut) {
      itemEl.appendChild(
        createEl('span', { className: 'webos-context-menu-item-shortcut', text: item.shortcut }),
      )
    }

    if (item.children && item.children.length > 0) {
      itemEl.classList.add('webos-context-menu-item--has-children')
      const sub = buildMenu(item.children)
      sub.classList.add('webos-context-menu--submenu')
      itemEl.appendChild(sub)
    }

    if (!item.disabled && item.onClick) {
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation()
        try {
          void item.onClick!()
        } finally {
          closeActive()
        }
      })
    }

    menu.appendChild(itemEl)
  }

  return menu
}

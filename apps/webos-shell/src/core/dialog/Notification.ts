/**
 * 桌面通知（右上角气泡）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { createEl, removeEl } from '../../helpers/dom'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'critical'

export interface NotificationOptions {
  title: string
  message?: string
  level?: NotificationLevel
  duration?: number // 毫秒，0 表示不自动关闭
  actions?: Array<{ label: string; onClick: () => void }>
  onClick?: () => void
}

let containerEl: HTMLElement | null = null

// 同屏最多堆叠的 toast 数量；超出则把最早一条提前关掉
const MAX_TOASTS = 5
const activeToasts: Array<{ root: HTMLElement; close: () => void }> = []

function getContainer(): HTMLElement {
  if (!containerEl) {
    containerEl = createEl('div', { className: 'webos-notification-container' })
    document.body.appendChild(containerEl)
  }
  return containerEl
}

export function notify(options: NotificationOptions): { close: () => void } {
  const level = options.level ?? 'info'
  const duration = options.duration ?? (level === 'critical' ? 0 : 4000)

  const root = createEl('div', {
    className: `webos-notification webos-notification--${level}`,
  })

  if (options.title) {
    root.appendChild(createEl('div', { className: 'webos-notification-title', text: options.title }))
  }
  if (options.message) {
    root.appendChild(createEl('div', { className: 'webos-notification-message', text: options.message }))
  }

  if (options.actions && options.actions.length > 0) {
    const actionBar = createEl('div', { className: 'webos-notification-actions' })
    for (const a of options.actions) {
      const btn = createEl('button', {
        className: 'webos-btn webos-btn--text',
        attrs: { type: 'button' },
        text: a.label,
      })
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        a.onClick()
        close()
      })
      actionBar.appendChild(btn)
    }
    root.appendChild(actionBar)
  }

  // 关闭按钮（与窗口标题栏 × 同款 SVG）
  const closeBtn = createEl('button', {
    className: 'webos-notification-close',
    attrs: { type: 'button', 'aria-label': '关闭' },
  })
  closeBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/></svg>'
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
  })
  root.appendChild(closeBtn)

  if (options.onClick) {
    root.style.cursor = 'pointer'
    root.addEventListener('click', (e) => {
      // 关闭按钮 / action 按钮自身已 stopPropagation，这里只处理 toast 主体点击
      const target = e.target as HTMLElement
      if (target.closest('.webos-notification-close, .webos-notification-actions')) return
      options.onClick!()
      close()
    })
  }

  getContainer().appendChild(root)

  // 进入动画
  requestAnimationFrame(() => {
    root.classList.add('webos-notification--shown')
  })

  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    if (timer) clearTimeout(timer)
    root.classList.remove('webos-notification--shown')
    setTimeout(() => removeEl(root), 250)
    const idx = activeToasts.findIndex((t) => t.root === root)
    if (idx >= 0) activeToasts.splice(idx, 1)
  }

  // 超出上限：把最早还活着的一条立刻关掉，保持画面干净
  while (activeToasts.length >= MAX_TOASTS) {
    activeToasts[0]!.close()
  }
  activeToasts.push({ root, close })

  if (duration > 0) {
    timer = setTimeout(close, duration)
  }

  return { close }
}

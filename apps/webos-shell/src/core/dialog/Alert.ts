/**
 * Alert / Confirm / 自定义按钮对话框
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { WindowManager } from '../window'
import { createEl } from '../../helpers/dom'

export type DialogButtonType = 'primary' | 'secondary' | 'danger'

export interface DialogButton {
  label: string
  // 点击该按钮时 resolve 出来的值；不传则用 label
  value?: unknown
  // 视觉风格
  type?: DialogButtonType
  // 是否自动聚焦 + 按 Enter 时触发
  autoFocus?: boolean
  // 按 Esc 或点窗口右上 × 时触发该按钮
  cancel?: boolean
  // 禁用
  disabled?: boolean
}

export type DialogIcon = 'info' | 'warning' | 'danger' | 'success' | 'question' | string

export interface AlertOptions {
  title?: string
  message: string
  // 图标：内置关键字（info / warning / danger / success / question）或任意 URL / data-uri
  icon?: DialogIcon
  // 自定义按钮（优先级最高）
  buttons?: DialogButton[]
  // 简化字段（不传 buttons 时生效）
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  danger?: boolean
  width?: number
  height?: number
}

const ICON_PRESETS: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  danger: '⛔',
  success: '✅',
  question: '❓',
}

// alert(message, title?) | alert(options)
export function alert(message: string, title?: string): Promise<void>
export function alert(options: AlertOptions): Promise<void>
export function alert(arg1: string | AlertOptions, arg2?: string): Promise<void> {
  const options: AlertOptions =
    typeof arg1 === 'string' ? { message: arg1, title: arg2 } : arg1
  return openAlert(options) as Promise<void>
}

// confirm(message, title?) | confirm(options)
export function confirm(message: string, title?: string): Promise<boolean>
export function confirm(options: AlertOptions): Promise<boolean>
export function confirm(arg1: string | AlertOptions, arg2?: string): Promise<boolean> {
  const options: AlertOptions =
    typeof arg1 === 'string'
      ? { message: arg1, title: arg2, showCancel: true }
      : { ...arg1, showCancel: true }
  return openAlert(options) as Promise<boolean>
}

// 自定义按钮版：resolve 出被点按钮的 value
export function showDialog<T = unknown>(options: AlertOptions): Promise<T> {
  return openAlert(options) as Promise<T>
}

function deriveDefaultButtons(options: AlertOptions): DialogButton[] {
  const list: DialogButton[] = []
  if (options.showCancel) {
    list.push({
      label: options.cancelText ?? '取消',
      value: false,
      type: 'secondary',
      cancel: true,
    })
  }
  list.push({
    label: options.confirmText ?? '确定',
    value: options.showCancel ? true : undefined,
    type: options.danger ? 'danger' : 'primary',
    autoFocus: true,
  })
  return list
}

function openAlert(options: AlertOptions): Promise<unknown> {
  return new Promise((resolve) => {
    const buttons =
      options.buttons && options.buttons.length > 0
        ? options.buttons
        : deriveDefaultButtons(options)

    const root = createEl('div', { className: 'webos-dialog' })

    // ===== 内容区 =====
    const content = createEl('div', { className: 'webos-dialog-content' })

    // 图标
    if (options.icon) {
      const iconEl = createEl('div', { className: 'webos-dialog-icon' })
      const preset = ICON_PRESETS[options.icon]
      if (preset) {
        iconEl.textContent = preset
      } else {
        const img = createEl('img', { attrs: { src: options.icon, alt: '', draggable: 'false' } })
        iconEl.appendChild(img)
      }
      content.appendChild(iconEl)
    }

    const messageWrap = createEl('div', { className: 'webos-dialog-message-wrap' })
    messageWrap.appendChild(
      createEl('div', { className: 'webos-dialog-message', text: options.message }),
    )
    content.appendChild(messageWrap)
    root.appendChild(content)

    // ===== 底栏（按钮）=====
    const footer = createEl('div', { className: 'webos-dialog-footer' })
    let resolved = false
    const finalize = (value: unknown): void => {
      if (resolved) return
      resolved = true
      win.close()
      resolve(value)
    }

    let autoFocusBtn: HTMLButtonElement | null = null
    let cancelValue: unknown = undefined
    let hasCancel = false

    for (const def of buttons) {
      const btn = createEl('button', {
        className: `webos-btn webos-btn--${def.type ?? 'secondary'}`,
        attrs: { type: 'button' },
        text: def.label,
      })
      if (def.disabled) btn.disabled = true
      btn.addEventListener('click', () => {
        finalize(def.value !== undefined ? def.value : def.label)
      })
      if (def.autoFocus && !autoFocusBtn) autoFocusBtn = btn as HTMLButtonElement
      if (def.cancel) {
        hasCancel = true
        cancelValue = def.value !== undefined ? def.value : def.label
      }
      footer.appendChild(btn)
    }
    root.appendChild(footer)

    // ===== 键盘交互 =====
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && hasCancel) {
        e.preventDefault()
        finalize(cancelValue)
      } else if (e.key === 'Enter' && autoFocusBtn) {
        e.preventDefault()
        autoFocusBtn.click()
      }
    }
    root.addEventListener('keydown', onKeydown)

    // ===== 创建窗口 =====
    const win = WindowManager.instance.create({
      title: options.title ?? '提示',
      width: options.width ?? 420,
      height: options.height ?? 200,
      resizable: false,
      maximizable: false,
      minimizable: false,
      modal: true,
      showInTaskbar: false,
      className: 'webos-alert',
      body: root,
      onClose: () => {
        if (!resolved) {
          // 用户按 × 关：等价于点 cancel 按钮（如果有），否则 resolve undefined / false
          if (hasCancel) {
            resolved = true
            resolve(cancelValue)
          } else {
            resolved = true
            resolve(options.showCancel ? false : undefined)
          }
        }
        return true
      },
    })

    // 自动聚焦
    setTimeout(() => {
      if (autoFocusBtn) autoFocusBtn.focus()
      else (root.querySelector('button') as HTMLButtonElement | null)?.focus()
    }, 50)
  })
}

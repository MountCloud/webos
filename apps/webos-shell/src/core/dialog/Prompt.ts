/**
 * Prompt 输入对话框（支持自定义按钮）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { WindowManager } from '../window'
import { createEl } from '../../helpers/dom'
import type { DialogButton } from './Alert'

export interface PromptOptions {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  // 自定义按钮（点击对应按钮时把当前输入值作为 value 透传）
  buttons?: DialogButton[]
  confirmText?: string
  cancelText?: string
  // 输入校验：返回 true / 空串通过；返回字符串显示错误
  validate?: (value: string) => true | string
  width?: number
  height?: number
}

export interface PromptResult {
  // 用户在 Prompt 中确认时取消按钮的 value（按钮自定义场景下区分点了哪个）
  button?: unknown
  // 输入的内容；用户取消则为 null
  value: string | null
}

// prompt(message, defaultValue?, title?) | prompt(options) - 返回字符串或 null
export function prompt(
  message: string,
  defaultValue?: string,
  title?: string,
): Promise<string | null>
export function prompt(options: PromptOptions): Promise<string | null>
export function prompt(
  arg1: string | PromptOptions,
  arg2?: string,
  arg3?: string,
): Promise<string | null> {
  const opts: PromptOptions =
    typeof arg1 === 'string'
      ? { title: arg3 ?? '请输入', message: arg1, defaultValue: arg2 ?? '' }
      : arg1
  return openPrompt(opts).then((r) => r.value)
}

// 完整版：返回 { button, value }
export function openPrompt(options: PromptOptions): Promise<PromptResult> {
  return new Promise((resolve) => {
    const root = createEl('div', { className: 'webos-dialog' })

    // ===== 内容区（消息 + 输入框 + 错误提示）=====
    const content = createEl('div', { className: 'webos-dialog-content' })
    const messageWrap = createEl('div', { className: 'webos-dialog-message-wrap' })

    if (options.message) {
      messageWrap.appendChild(
        createEl('div', { className: 'webos-dialog-message', text: options.message }),
      )
    }

    const input = createEl('input', {
      className: 'webos-input',
      attrs: { type: 'text', placeholder: options.placeholder ?? '' },
    })
    input.value = options.defaultValue ?? ''
    messageWrap.appendChild(input)

    const errorEl = createEl('div', {
      className: 'webos-dialog-error',
      style: { display: 'none' },
    })
    messageWrap.appendChild(errorEl)

    content.appendChild(messageWrap)
    root.appendChild(content)

    // ===== 按钮 =====
    const buttons: DialogButton[] =
      options.buttons && options.buttons.length > 0
        ? options.buttons
        : [
            {
              label: options.cancelText ?? '取消',
              value: '__cancel__',
              type: 'secondary',
              cancel: true,
            },
            {
              label: options.confirmText ?? '确定',
              value: '__confirm__',
              type: 'primary',
              autoFocus: true,
            },
          ]

    const footer = createEl('div', { className: 'webos-dialog-footer' })
    let resolved = false
    let cancelDef: DialogButton | null = null
    let confirmDef: DialogButton | null = null

    const finalize = (def: DialogButton, isCancel: boolean): void => {
      if (resolved) return
      // 非 cancel 才校验
      if (!isCancel && options.validate) {
        const v = options.validate(input.value)
        if (v !== true) {
          errorEl.textContent = typeof v === 'string' ? v : '输入不合法'
          errorEl.style.display = ''
          input.focus()
          return
        }
      }
      resolved = true
      win.close()
      resolve({
        button: def.value !== undefined ? def.value : def.label,
        value: isCancel ? null : input.value,
      })
    }

    for (const def of buttons) {
      const btn = createEl('button', {
        className: `webos-btn webos-btn--${def.type ?? 'secondary'}`,
        attrs: { type: 'button' },
        text: def.label,
      })
      if (def.disabled) btn.disabled = true
      btn.addEventListener('click', () => finalize(def, def.cancel === true))
      if (def.cancel && !cancelDef) cancelDef = def
      if (def.autoFocus && !confirmDef) confirmDef = def
      footer.appendChild(btn)
    }
    root.appendChild(footer)

    // ===== 键盘交互 =====
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && confirmDef) {
        e.preventDefault()
        finalize(confirmDef, false)
      } else if (e.key === 'Escape' && cancelDef) {
        e.preventDefault()
        finalize(cancelDef, true)
      }
    })

    input.addEventListener('input', () => {
      if (errorEl.style.display !== 'none') {
        errorEl.style.display = 'none'
      }
    })

    // ===== 创建窗口 =====
    const win = WindowManager.instance.create({
      title: options.title ?? '请输入',
      width: options.width ?? 440,
      height: options.height ?? 240,
      resizable: false,
      maximizable: false,
      minimizable: false,
      modal: true,
      showInTaskbar: false,
      className: 'webos-prompt',
      body: root,
      onClose: () => {
        if (!resolved) {
          resolved = true
          resolve({
            button: cancelDef?.value ?? null,
            value: null,
          })
        }
        return true
      },
    })

    setTimeout(() => input.focus(), 50)
  })
}

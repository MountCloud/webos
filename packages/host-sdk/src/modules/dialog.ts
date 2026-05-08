/**
 * Webos.dialog.*
 * 对话框系列 API
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export type DialogButtonType = 'primary' | 'secondary' | 'danger'

export interface DialogButton {
  label: string
  value?: unknown
  type?: DialogButtonType
  autoFocus?: boolean
  cancel?: boolean
  disabled?: boolean
}

export type DialogIcon = 'info' | 'warning' | 'danger' | 'success' | 'question' | string

export interface AlertOptions {
  title?: string
  message: string
  icon?: DialogIcon
  buttons?: DialogButton[]
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  danger?: boolean
  width?: number
  height?: number
}

export interface PromptInputOptions {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  buttons?: DialogButton[]
  confirmText?: string
  cancelText?: string
  width?: number
  height?: number
}

export interface PromptResult {
  button?: unknown
  value: string | null
}

export interface OpenFileOptions {
  title?: string
  accept?: string[]
  multiple?: boolean
}

export interface SaveFileOptions {
  title?: string
  defaultName?: string
  accept?: string[]
}

export interface PropertiesOptions {
  title?: string
  data: Record<string, string | number | boolean>
}

export interface ProgressHandle {
  update(value: number): void
  setMessage(message: string): void
  close(): void
}

export function createDialog(rpc: RpcClient) {
  function alert(message: string, title?: string): Promise<void>
  function alert(options: AlertOptions): Promise<void>
  async function alert(arg1: string | AlertOptions, arg2?: string): Promise<void> {
    const options = typeof arg1 === 'string' ? { message: arg1, title: arg2 } : arg1
    await rpc.call('dialog', 'alert', options)
  }

  function confirm(message: string, title?: string): Promise<boolean>
  function confirm(options: AlertOptions): Promise<boolean>
  async function confirm(arg1: string | AlertOptions, arg2?: string): Promise<boolean> {
    const options =
      typeof arg1 === 'string'
        ? { message: arg1, title: arg2, showCancel: true }
        : { ...arg1, showCancel: true }
    return rpc.call<boolean>('dialog', 'confirm', options)
  }

  function prompt(message: string, defaultValue?: string, title?: string): Promise<string | null>
  function prompt(options: PromptInputOptions): Promise<string | null>
  async function prompt(
    arg1: string | PromptInputOptions,
    arg2?: string,
    arg3?: string,
  ): Promise<string | null> {
    const options =
      typeof arg1 === 'string' ? { message: arg1, defaultValue: arg2, title: arg3 } : arg1
    return rpc.call<string | null>('dialog', 'prompt', options)
  }

  return {
    alert,
    confirm,
    prompt,

    // 自定义按钮版：resolve 出被点按钮的 value
    async show<T = unknown>(options: AlertOptions): Promise<T> {
      return rpc.call<T>('dialog', 'show', options)
    },

    // 完整 prompt：返回 { button, value }
    async promptEx(options: PromptInputOptions): Promise<PromptResult> {
      return rpc.call<PromptResult>('dialog', 'promptEx', options)
    },

    async openFile(options: OpenFileOptions = {}): Promise<File | File[] | null> {
      return rpc.call('dialog', 'openFile', options)
    },

    async saveFile(options: SaveFileOptions = {}): Promise<string | null> {
      return rpc.call('dialog', 'saveFile', options)
    },

    async pickDirectory(): Promise<string | null> {
      return rpc.call('dialog', 'pickDirectory')
    },

    progress(options: { title?: string; max?: number; message?: string }): ProgressHandle {
      // 进度对话框：先发开请求拿到 handleId，后续通过 update / close 调用
      let handleId: string | null = null
      const ready = rpc.call<string>('dialog', 'progressOpen', options).then((id) => {
        handleId = id
        return id
      })

      return {
        update(value: number) {
          void ready.then(() =>
            rpc.call('dialog', 'progressUpdate', { handleId, value }).catch(() => {}),
          )
        },
        setMessage(message: string) {
          void ready.then(() =>
            rpc.call('dialog', 'progressUpdate', { handleId, message }).catch(() => {}),
          )
        },
        close() {
          void ready.then(() =>
            rpc.call('dialog', 'progressClose', { handleId }).catch(() => {}),
          )
        },
      }
    },

    async properties(options: PropertiesOptions): Promise<void> {
      await rpc.call('dialog', 'properties', options)
    },

    async pickColor(options: { default?: string } = {}): Promise<string | null> {
      return rpc.call<string | null>('dialog', 'pickColor', options)
    },

    async pickFont(options: { default?: string } = {}): Promise<string | null> {
      return rpc.call<string | null>('dialog', 'pickFont', options)
    },

    async showQR(options: { data: string; title?: string }): Promise<void> {
      await rpc.call('dialog', 'showQR', options)
    },
  }
}

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

// ===== 自定义弹窗（嵌入 URL / 应用 entry） =====

export interface OpenPageButton {
  // 按钮唯一 id，回调 onAction 收到的就是这个
  id: string
  label: string
  type?: DialogButtonType
  autoFocus?: boolean
  // 标记为 cancel：按 Esc / 点关闭 都会触发该按钮（host 不再阻止关闭）
  cancel?: boolean
  disabled?: boolean
}

/**
 * 弹窗模态级别：
 * - 'none'   不阻塞任何东西（普通独立窗口）
 * - 'parent' 阻塞调用方应用窗口（默认；Windows 风格）
 * - 'global' 阻塞整个桌面（系统级，慎用）
 */
export type DialogModal = 'none' | 'parent' | 'global'

export interface OpenPageOptions {
  // ---- 嵌入内容（二选一）----
  // 任意 URL（同源 / 跨源都行，跟 iframe 一致）
  url?: string
  // 或者指定一个 webos 应用的 entry（更类型安全，会复用 manifest 权限检查）
  app?: { appId: string; entryId: string; params?: Record<string, unknown> }

  // ---- 窗口外观 ----
  title?: string
  icon?: string
  width?: number
  height?: number

  // ---- 底部按钮 ----
  // 不传则不渲染 footer，全靠内嵌页 Webos.dialog.close() 主动关
  buttons?: OpenPageButton[]

  // ---- 模态级别 ----
  modal?: DialogModal
}

export interface DialogResult<TData = unknown> {
  // 被点的按钮 id；如果是系统按钮（关闭十字 / Esc）或内嵌页主动 close({ buttonId }) 传的，则是那个值
  buttonId: string | null
  // 内嵌页 onAction / close() 透传过来的业务数据
  data?: TData
}

/**
 * 内嵌页 onAction 返回值：
 * - 不返回 / 返回 undefined → 默认行为：关闭并把 button.id 透传给调用方
 * - { close: true, data? }   → 关闭并把 data 给调用方
 * - { close: false, error? } → 阻止关闭；如果带 error，宿主在 footer 上显示错误（红色文字）
 * - 直接抛错                 → 等同 { close: false, error: err.message }
 */
export interface ActionHandlerResult {
  close: boolean
  data?: unknown
  error?: string
}

export type DialogActionHandler = (
  buttonId: string,
) => void | ActionHandlerResult | Promise<void | ActionHandlerResult>

export interface DialogContext {
  // 当前 iframe 是否在 dialog 模式下（不是的话所有 dialog API 是 no-op）
  inDialog: boolean
  // 当前 dialog 的 id（用于 close() 自指）
  dialogId: string | null
  // 渲染了哪些按钮
  buttons: OpenPageButton[]
  // 模态级别
  modal: DialogModal
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

    // ===========================================================================
    // 自定义弹窗（嵌入页面 + 自定义按钮 + 模态）
    // ===========================================================================

    /**
     * 弹一个嵌入页面的对话框。
     * <p>
     * 调用方等待用户操作 → resolve 出 {@link DialogResult}（含 buttonId 和内嵌页传回的 data）。
     * 内嵌页通过 {@link Webos.dialog.onAction} 接管按钮事件，可校验失败时阻止关闭。
     *
     * @example
     *   const r = await Webos.dialog.openPage({
     *     url: '/forms/edit?id=42',
     *     title: '编辑工单',
     *     buttons: [
     *       { id: 'save', label: '保存', type: 'primary', autoFocus: true },
     *       { id: 'cancel', label: '取消', cancel: true },
     *     ],
     *     modal: 'parent',          // 默认；阻塞调用方应用窗口
     *   })
     *   if (r.buttonId === 'save') console.log('saved data:', r.data)
     */
    async openPage<TData = unknown>(options: OpenPageOptions): Promise<DialogResult<TData>> {
      if (!options.url && !options.app) {
        throw new Error('Webos.dialog.openPage: 必须传 url 或 app 之一')
      }
      return rpc.call<DialogResult<TData>>('dialog', 'openPage', options)
    },

    /**
     * 当前 iframe 在 dialog 中时，注册按钮点击处理器。返回取消函数。
     * <p>
     * 不在 dialog 中调用是 no-op（取消函数返回空操作）。
     *
     * @example
     *   Webos.dialog.onAction(async (buttonId) => {
     *     if (buttonId !== 'save') return                  // 默认放过
     *     if (!form.isValid()) {
     *       return { close: false, error: '请填完必填项' }
     *     }
     *     return { close: true, data: form.getValues() }
     *   })
     */
    onAction(handler: DialogActionHandler): () => void {
      if (!isInDialog()) {
        return () => {}
      }
      const off = rpc.on('dialog.action', (payload) => {
        const args = payload as { buttonId: string; actionId: string }
        void runActionHandler(rpc, handler, args.buttonId, args.actionId)
      })
      return off
    },

    /**
     * 内嵌页主动关闭（不需要等用户点按钮）。
     * <p>
     * 调用方的 openPage Promise 会以传入的 buttonId + data resolve。
     */
    async close(result: { buttonId?: string; data?: unknown } = {}): Promise<void> {
      if (!isInDialog()) return
      await rpc.call('dialog', 'closeFromInside', {
        dialogId: getDialogId(),
        buttonId: result.buttonId ?? null,
        data: result.data,
      })
    },

    /** 查询当前 iframe 的 dialog 上下文（不在 dialog 中时 inDialog=false） */
    async context(): Promise<DialogContext> {
      if (!isInDialog()) {
        return { inDialog: false, dialogId: null, buttons: [], modal: 'none' }
      }
      return rpc.call<DialogContext>('dialog', 'context', { dialogId: getDialogId() })
    },
  }
}

// ===== 内部工具 =====

/**
 * 判断当前 iframe 是不是在 dialog 模式下。
 * 规则：URL 上有 ?webosDialogId=xxx 就是在 dialog 里（由 DialogWindow 创建 iframe 时拼上）。
 */
function isInDialog(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).has('webosDialogId')
  } catch {
    return false
  }
}

function getDialogId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('webosDialogId')
  } catch {
    return null
  }
}

/**
 * 把用户的 handler 跑起来，结果汇报给宿主。
 * 不论 handler 返回什么 / 抛什么，都翻成 ActionHandlerResult 让宿主决定关不关。
 */
async function runActionHandler(
  rpc: RpcClient,
  handler: DialogActionHandler,
  buttonId: string,
  actionId: string,
): Promise<void> {
  let result: ActionHandlerResult
  try {
    const r = await handler(buttonId)
    if (r === undefined || r === null) {
      // 默认行为：关闭，无 data
      result = { close: true }
    } else {
      result = r
    }
  } catch (err) {
    result = { close: false, error: err instanceof Error ? err.message : String(err) }
  }
  // 回报宿主；宿主据此决定关闭 dialog 或显示 error
  try {
    await rpc.call('dialog', 'actionResult', {
      dialogId: getDialogId(),
      actionId,
      ...result,
    })
  } catch (err) {
    console.error('[webos] dialog actionResult 上报失败', err)
  }
}

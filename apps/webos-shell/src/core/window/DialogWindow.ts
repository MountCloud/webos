/**
 * 弹窗窗口 —— 嵌入 iframe + 渲染 footer 按钮 + 双向 RPC 协调"按钮 → 内嵌页 → 关闭/阻止"。
 *
 * 跟 AppWindow 的区别：
 * - 多一行 footer（按钮区）
 * - 嵌入的 iframe URL 上自动拼 ?webosDialogId=xxx，让 SDK 知道自己在 dialog 模式下
 * - 内置 action 调度器：按钮点击 → push event 到 iframe → 等 RPC 回 actionResult →
 *   决定关闭 / 阻止关闭 / 显示错误
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { AppWindow, type AppWindowOptions } from './AppWindow'
import { createEl } from '../../helpers/dom'

export type DialogButtonType = 'primary' | 'secondary' | 'danger'

export interface DialogButtonDef {
  id: string
  label: string
  type?: DialogButtonType
  autoFocus?: boolean
  cancel?: boolean
  disabled?: boolean
}

export type DialogModal = 'none' | 'parent' | 'global'

/**
 * 注意：基类 WindowOptions.modal 是 boolean（旧 alert/confirm 路径用），
 * 这里用 DialogModal 字符串语义，所以 Omit 掉再加自己的。
 */
export interface DialogWindowOptions extends Omit<AppWindowOptions, 'modal'> {
  dialogId: string
  buttons: DialogButtonDef[]
  modal: DialogModal
  /**
   * push event 到 iframe 的通道。由 AppMessageBus 注入。
   */
  pushEvent: (event: string, payload: unknown) => void
}

export interface ActionResult {
  close: boolean
  data?: unknown
  error?: string
}

export interface DialogResult<TData = unknown> {
  buttonId: string | null
  data?: TData
}

export class DialogWindow extends AppWindow {
  readonly dialogId: string
  readonly buttons: DialogButtonDef[]
  readonly modal: DialogModal

  private _footer: HTMLElement | null = null
  private _errorEl: HTMLElement | null = null
  private _buttonEls = new Map<string, HTMLButtonElement>()
  private _nextActionId = 0
  private _pendingActions = new Map<string, (r: ActionResult) => void>()
  private _resolveResult: ((r: DialogResult) => void) | null = null
  private _settled = false
  private _pushEvent: (event: string, payload: unknown) => void

  constructor(options: DialogWindowOptions) {
    // 拼上 webosDialogId 让内嵌页 SDK 识别
    const urlWithDialog = appendQuery(options.url, 'webosDialogId', options.dialogId)
    // 把 DialogWindow 特有字段从透传里剔掉，把 modal 翻成 boolean 喂给基类（旧 modal=true 语义）
    const { dialogId: _d, buttons: _b, modal: _m, pushEvent: _p, ...rest } = options
    super({
      ...rest,
      url: urlWithDialog,
      // 基类的 modal 是 boolean，dialog 一律带模态记号（实际"阻塞"由 WindowManager 做）
      modal: true,
      showInTaskbar: options.showInTaskbar ?? false,
      // 不能最小化（语义上不合理 —— 模态弹窗不能藏起来）
      minimizable: false,
      // 默认居中
      center: options.center ?? true,
    })

    this.dialogId = options.dialogId
    this.buttons = options.buttons
    this.modal = options.modal
    this._pushEvent = options.pushEvent

    this.el.classList.add('webos-dialog-window')

    // 渲染 footer
    if (this.buttons.length > 0) {
      this._renderFooter()
    }

    // 加载遮罩由父类 AppWindow 在构造期已经挂上了（_renderLoadingMask），
    // 用同一份 .webos-iframe-loading-* CSS，dialog 不再重复挂
  }

  private _renderFooter(): void {
    const footer = createEl('div', { className: 'webos-dialog-window-footer' })

    const errEl = createEl('div', { className: 'webos-dialog-window-error' })
    footer.appendChild(errEl)
    this._errorEl = errEl

    const btnGroup = createEl('div', { className: 'webos-dialog-window-buttons' })
    for (const def of this.buttons) {
      const btn = createEl('button', {
        className: `webos-btn webos-btn--${def.type ?? 'secondary'}`,
        attrs: { type: 'button', 'data-button-id': def.id },
        text: def.label,
      })
      if (def.disabled) btn.disabled = true
      btn.addEventListener('click', () => void this._handleButtonClick(def.id))
      btnGroup.appendChild(btn)
      this._buttonEls.set(def.id, btn as HTMLButtonElement)
    }
    footer.appendChild(btnGroup)

    // footer 挂在 body 下面，跟 body 同层（Window.body 是 .webos-window-body）
    this.el.appendChild(footer)
    this._footer = footer
  }

  /** 调用方 await 的 promise 通道。由 builtinHandlers 在 open 时注册。 */
  setResultResolver(resolve: (r: DialogResult) => void): void {
    this._resolveResult = resolve
  }

  /** 关闭键 / Esc 走的就是这条路径（找一个 cancel=true 的按钮） */
  async tryCloseByCancel(): Promise<void> {
    const cancelBtn = this.buttons.find((b) => b.cancel)
    if (cancelBtn) {
      await this._handleButtonClick(cancelBtn.id)
    } else if (this.buttons.length === 0) {
      // 没按钮配置：内嵌页全权控制，宿主不能关
      // 但用户点了 × 又确实想关 —— 默认 buttonId = null
      this._settle({ buttonId: null })
    } else {
      // 有按钮但没 cancel 标记：闪一下 footer 提示用户必须选一个
      this._flashError('请选择一个操作')
    }
  }

  /** 内嵌页主动 close()：直接 settle */
  closeFromInside(buttonId: string | null, data: unknown): void {
    this._settle({ buttonId, data })
  }

  /** 内嵌页 actionResult RPC 调进来，完成对应 pending */
  completeAction(actionId: string, result: ActionResult): void {
    const cb = this._pendingActions.get(actionId)
    if (!cb) return
    this._pendingActions.delete(actionId)
    cb(result)
  }

  get context(): {
    inDialog: true
    dialogId: string
    buttons: DialogButtonDef[]
    modal: DialogModal
  } {
    return {
      inDialog: true,
      dialogId: this.dialogId,
      buttons: this.buttons,
      modal: this.modal,
    }
  }

  private async _handleButtonClick(buttonId: string): Promise<void> {
    if (this._settled) return
    const def = this.buttons.find((b) => b.id === buttonId)
    if (!def) return

    // 标记 cancel 类按钮：直接关，不问内嵌页
    if (def.cancel) {
      this._settle({ buttonId })
      return
    }

    // 防双击：相关按钮 disabled 期间不能再点
    this._disableButtons(true)
    this._clearError()

    const actionId = `act-${++this._nextActionId}`
    const result = await this._dispatchAction(buttonId, actionId)

    this._disableButtons(false)

    if (result.close) {
      this._settle({ buttonId, data: result.data })
    } else if (result.error) {
      this._flashError(result.error)
    }
  }

  private _dispatchAction(buttonId: string, actionId: string): Promise<ActionResult> {
    return new Promise<ActionResult>((resolve) => {
      // 超时兜底：iframe 没接 onAction 或卡死时，10s 后默认 close
      const timer = setTimeout(() => {
        if (this._pendingActions.has(actionId)) {
          this._pendingActions.delete(actionId)
          resolve({ close: true })
        }
      }, 10_000)

      this._pendingActions.set(actionId, (r) => {
        clearTimeout(timer)
        resolve(r)
      })
      this._pushEvent('dialog.action', { buttonId, actionId })
    })
  }

  private _settle(result: DialogResult): void {
    if (this._settled) return
    this._settled = true
    const resolve = this._resolveResult
    this._resolveResult = null
    // 先 resolve 真实结果再 close。close() 会触发 builtinHandlers 注册的
    // 'close' 兜底 listener 用 { buttonId: null } 再 resolve 一次——
    // Promise 只 settle 一次，必须保证我们的真实结果先到。
    resolve?.(result)
    void this.close()
  }

  private _disableButtons(disabled: boolean): void {
    for (const [id, btn] of this._buttonEls) {
      const def = this.buttons.find((b) => b.id === id)
      // 原本 disabled 的不动
      if (def?.disabled) continue
      btn.disabled = disabled
    }
  }

  private _clearError(): void {
    if (this._errorEl) {
      this._errorEl.textContent = ''
      this._errorEl.classList.remove('webos-dialog-window-error--shown')
    }
  }

  private _flashError(msg: string): void {
    if (!this._errorEl) return
    this._errorEl.textContent = msg
    this._errorEl.classList.add('webos-dialog-window-error--shown')
  }
}

function appendQuery(url: string, key: string, value: string): string {
  try {
    const u = new URL(url, window.location.href)
    u.searchParams.set(key, value)
    return u.toString()
  } catch {
    // 相对路径无 base URL 时降级用字符串拼
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  }
}

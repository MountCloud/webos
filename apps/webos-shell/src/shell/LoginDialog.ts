/**
 * 登录对话框
 *
 * 苹果风：未登录时全屏遮罩 + 居中浮卡，必须填入账号密码才能解除。
 * Esc / 点遮罩 / 浏览器后退 都不能取消——这是"锁屏"语义，不是普通 dialog。
 *
 * 用法（main.ts 启动时）：
 *   if (!UserSession.instance.authenticated) {
 *     document.body.classList.add('webos-locked')
 *     await LoginDialog.show()
 *     document.body.classList.remove('webos-locked')
 *   }
 *
 * 登出后回弹也走 show() —— 内部 singleton，不重复挂多个。
 *
 * mock 登录逻辑：账号非空 + 密码 ≥ 4 位即认；想接 SSO 把
 * configure({ signIn: async (u,p) => fetch('/api/auth/login',...) }) 替换即可。
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { createEl, removeEl } from '../helpers/dom'
import { UserSession, type UserInfo, type TokenInfo } from '../user'

/**
 * 业务方注入的真实登录逻辑。失败请抛 Error，message 会显示在登录卡片上。
 */
export type SignInFn = (
  username: string,
  password: string,
  remember: boolean,
) => Promise<{ user: UserInfo; token?: TokenInfo | null }>

export interface LoginDialogOptions {
  /** 卡片上方的标题。默认 "登录到 WebOS" */
  title?: string
  /** 副标题。默认 "使用企业账号继续" */
  subtitle?: string
  /** 真实登录函数。不传走 mock（任意账号 + ≥4 位密码即认） */
  signIn?: SignInFn
}

export class LoginDialog {
  private static _instance: LoginDialog | null = null
  static get instance(): LoginDialog {
    if (!LoginDialog._instance) LoginDialog._instance = new LoginDialog()
    return LoginDialog._instance
  }

  private _root: HTMLElement | null = null
  private _userInput: HTMLInputElement | null = null
  private _pwdInput: HTMLInputElement | null = null
  private _rememberInput: HTMLInputElement | null = null
  private _errorBox: HTMLElement | null = null
  private _submitBtn: HTMLButtonElement | null = null
  private _cardEl: HTMLElement | null = null

  private _options: LoginDialogOptions = {}
  private _pendingResolve: ((u: UserInfo) => void) | null = null

  configure(options: LoginDialogOptions): void {
    this._options = { ...this._options, ...options }
  }

  /**
   * 弹出登录框，resolve 出登录成功的用户。
   * 已有一个 show() 在等待时再调，直接返回同一个 Promise。
   */
  show(): Promise<UserInfo> {
    if (this._pendingResolve && this._root) {
      // 已经在显示，复用同一个 Promise
      return new Promise((resolve) => {
        const prev = this._pendingResolve!
        this._pendingResolve = (u) => {
          prev(u)
          resolve(u)
        }
      })
    }
    return new Promise<UserInfo>((resolve) => {
      this._pendingResolve = resolve
      this._mount()
    })
  }

  /** 强制关闭（外部调用，比如外部 SSO 完成）。不会触发 pendingResolve。 */
  close(): void {
    if (!this._root) return
    removeEl(this._root)
    this._root = null
    this._userInput = null
    this._pwdInput = null
    this._rememberInput = null
    this._errorBox = null
    this._submitBtn = null
    this._cardEl = null
  }

  // ===== 内部 =====

  private _mount(): void {
    if (this._root) return
    const root = createEl('div', {
      className: 'webos-login-overlay',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'webos-login-title' },
    })
    const card = createEl('div', { className: 'webos-login-card' })
    this._cardEl = card

    // 头像（默认 SVG，业务方将来可改成真实用户头像）
    const avatar = createEl('div', { className: 'webos-login-avatar' })
    avatar.innerHTML =
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="32" fill="rgba(255,255,255,0.16)"/>' +
      '<circle cx="32" cy="26" r="10" fill="rgba(255,255,255,0.85)"/>' +
      '<path d="M14 54 C14 44 22 38 32 38 C42 38 50 44 50 54 Z" fill="rgba(255,255,255,0.85)"/>' +
      '</svg>'
    card.appendChild(avatar)

    // 标题
    const title = createEl('div', {
      id: 'webos-login-title',
      className: 'webos-login-title',
      text: this._options.title ?? '登录到 WebOS',
    })
    card.appendChild(title)
    const subtitle = createEl('div', {
      className: 'webos-login-subtitle',
      text: this._options.subtitle ?? '使用企业账号继续',
    })
    card.appendChild(subtitle)

    // 错误提示
    const errBox = createEl('div', {
      className: 'webos-login-error',
      attrs: { role: 'alert', 'aria-live': 'polite' },
    })
    card.appendChild(errBox)
    this._errorBox = errBox

    // 账号输入
    const userField = this._field('username', '账号', 'text', 'username')
    card.appendChild(userField.wrap)
    this._userInput = userField.input

    // 密码 + 提交（pill 形式，右侧带圆形箭头按钮，跟 macOS 类似）
    const pwdRow = createEl('div', { className: 'webos-login-pwd-row' })
    const pwdField = this._field('password', '密码', 'password', 'current-password', true)
    pwdRow.appendChild(pwdField.wrap)
    this._pwdInput = pwdField.input

    const submit = createEl('button', {
      className: 'webos-login-submit',
      attrs: { type: 'button', 'aria-label': '登录' },
    })
    submit.innerHTML =
      '<svg class="webos-login-submit-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="5" y1="12" x2="19" y2="12"/>' +
      '<polyline points="12 5 19 12 12 19"/>' +
      '</svg>' +
      '<span class="webos-login-submit-spinner" aria-hidden="true"></span>'
    submit.addEventListener('click', () => void this._submit())
    pwdRow.appendChild(submit)
    card.appendChild(pwdRow)
    this._submitBtn = submit as HTMLButtonElement

    // 记住我
    const remember = createEl('label', { className: 'webos-login-remember' })
    const rememberInput = createEl('input', { attrs: { type: 'checkbox' } })
    rememberInput.checked = true
    remember.appendChild(rememberInput)
    remember.appendChild(createEl('span', { text: '记住我（7 天）' }))
    card.appendChild(remember)
    this._rememberInput = rememberInput

    root.appendChild(card)
    document.body.appendChild(root)
    this._root = root

    // Enter 提交
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void this._submit()
      } else if (e.key === 'Escape') {
        // 锁屏语义：Esc 不能取消，静默吞掉。不再抖动——抖动只保留给登录失败。
        e.preventDefault()
      }
    }
    this._userInput.addEventListener('keydown', onKeydown)
    this._pwdInput.addEventListener('keydown', onKeydown)

    // 锁屏语义：点击 / 右键遮罩都不能关闭。指针事件在 overlay 边界 stopPropagation，
    // 避免任何冒泡到下层桌面。不再触发抖动——只有登录失败时抖。
    const blockOnOverlay = (e: Event): void => {
      if (e.target === root) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    root.addEventListener('mousedown', blockOnOverlay)
    root.addEventListener('click', blockOnOverlay)
    root.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    // 自动聚焦
    requestAnimationFrame(() => {
      this._userInput?.focus()
      root.classList.add('webos-login-overlay--shown')
    })
  }

  private _field(
    id: string,
    label: string,
    type: 'text' | 'password',
    autocomplete: string,
    inPwdRow = false,
  ): { wrap: HTMLElement; input: HTMLInputElement } {
    const wrap = createEl('div', {
      className:
        'webos-login-field' + (inPwdRow ? ' webos-login-field--in-row' : ''),
    })
    const input = createEl('input', {
      id: 'webos-login-' + id,
      className: 'webos-login-input',
      attrs: {
        type,
        autocomplete,
        spellcheck: 'false',
        placeholder: label,
        'aria-label': label,
      },
    })
    input.addEventListener('input', () => this._clearError())
    wrap.appendChild(input)
    return { wrap, input }
  }

  private _shake(): void {
    if (!this._cardEl) return
    this._cardEl.classList.remove('webos-login-card--shake')
    // 强制 reflow 触发动画
    void this._cardEl.offsetWidth
    this._cardEl.classList.add('webos-login-card--shake')
  }

  private _showError(msg: string): void {
    if (!this._errorBox) return
    this._errorBox.textContent = msg
    this._errorBox.classList.add('webos-login-error--shown')
    this._shake()
  }

  private _clearError(): void {
    if (!this._errorBox) return
    this._errorBox.classList.remove('webos-login-error--shown')
  }

  private async _submit(): Promise<void> {
    if (!this._userInput || !this._pwdInput || !this._submitBtn) return
    const username = this._userInput.value.trim()
    const password = this._pwdInput.value
    const remember = this._rememberInput?.checked ?? false

    if (!username || !password) {
      this._showError('请填写账号和密码')
      ;(username ? this._pwdInput : this._userInput).focus()
      return
    }

    this._submitBtn.classList.add('webos-login-submit--loading')
    this._submitBtn.disabled = true
    try {
      const fn = this._options.signIn ?? defaultMockSignIn
      const { user, token } = await fn(username, password, remember)
      UserSession.instance.set({ user, token: token ?? null })

      // 收尾动画后关闭
      this._cardEl?.classList.add('webos-login-card--success')
      await sleep(180)
      const resolve = this._pendingResolve
      this._pendingResolve = null
      this.close()
      resolve?.(user)
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : '登录失败，请稍后再试'
      this._showError(msg)
      this._pwdInput.focus()
      this._pwdInput.select()
    } finally {
      if (this._submitBtn) {
        this._submitBtn.classList.remove('webos-login-submit--loading')
        this._submitBtn.disabled = false
      }
    }
  }
}

/**
 * 默认 mock 登录：固定只接受 admin / admin（开发期演示用）。
 * 业务方接入真实后端时调 LoginDialog.instance.configure({ signIn: ... }) 替换。
 */
async function defaultMockSignIn(
  username: string,
  password: string,
  remember: boolean,
): Promise<{ user: UserInfo; token: TokenInfo }> {
  await sleep(450)
  if (username !== 'admin' || password !== 'admin') {
    throw new Error('账号密码错误')
  }
  const now = Date.now()
  const ttlMs = remember ? 7 * 24 * 3600 * 1000 : 8 * 3600 * 1000
  return {
    user: {
      id: 'u-admin',
      name: 'admin',
      email: 'admin@webos.local',
      permissions: ['user.read', 'console.access', 'admin.*'],
    },
    token: {
      accessToken: 'mock-admin-' + now,
      refreshToken: 'mock-rt-' + Math.random().toString(36).slice(2),
      tokenType: 'Bearer',
      expiresAt: now + ttlMs,
      scope: 'openid profile',
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

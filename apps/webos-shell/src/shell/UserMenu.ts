/**
 * 用户下拉菜单
 * 直接挂 UserSession singleton —— 不走 RPC，主程序内同进程调
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl, removeEl } from '../helpers/dom'
import { UserSession, type UserInfo } from '../user'

export interface UserMenuOptions {
  // 退出登录后的回调。UserSession.clear() 已经在内部调过，这里只是给业务方"事后钩子"
  // （比如清自家的业务缓存）。回到登录态由 main.ts 的 LoginDialog 流程自动处理，
  // 不需要在这里写跳转。
  onLogout?: () => void
  // 点 "账户设置" 时（业务方按需打开自家账户管理应用）
  onAccountSettings?: () => void
}

export class UserMenu extends UIElement {
  private static _instance: UserMenu | null = null

  static get instance(): UserMenu {
    if (!UserMenu._instance) UserMenu._instance = new UserMenu()
    return UserMenu._instance
  }

  private _isOpen = false
  private _removeTimer: ReturnType<typeof setTimeout> | null = null
  private _user: UserInfo | null = null
  private _options: UserMenuOptions = {}

  constructor() {
    super({ id: 'user-menu' })
    // 启动时同步当前用户
    this._user = UserSession.instance.user
    // 跟随 UserSession 的变化（登录 / 登出 / 切换都触发）
    this.addDisposer(
      UserSession.instance.on('change', ({ user }) => {
        this._user = user
        if (this._el) {
          this._el.innerHTML = ''
          this._renderInto(this._el)
        }
      }),
    )
  }

  // 配置交互回调（一般在 main.ts bootstrap 时调一次）
  configure(options: UserMenuOptions): void {
    this._options = { ...this._options, ...options }
  }

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-user-menu' })
    this._renderInto(el)
    return el
  }

  private _renderInto(el: HTMLElement): void {
    const head = createEl('div', { className: 'webos-user-menu-head' })

    // 注意：UserMenu 只在登录态打开（未登录态整个顶栏由 main.ts 的 webos-locked 类隐藏掉），
    // 所以这里假设 _user 永远非空。理论上不会进 else 分支，
    // 留个降级显示防止万一（比如登出瞬间 popover 还在）。
    if (!this._user) {
      head.appendChild(createEl('div', {
        className: 'webos-user-menu-name',
        text: '未登录',
      }))
      el.appendChild(head)
      return
    }

    const avatar = createEl('div', {
      className: 'webos-user-menu-avatar',
      text: this._user.name[0]?.toUpperCase() ?? '?',
    })
    if (this._user.avatar) {
      avatar.innerHTML = ''
      avatar.appendChild(
        createEl('img', { attrs: { src: this._user.avatar, alt: this._user.name } }),
      )
    }
    head.appendChild(avatar)
    const info = createEl('div', { className: 'webos-user-menu-info' })
    info.appendChild(createEl('div', { className: 'webos-user-menu-name', text: this._user.name }))
    if (this._user.email) {
      info.appendChild(
        createEl('div', { className: 'webos-user-menu-email', text: this._user.email }),
      )
    }
    head.appendChild(info)
    el.appendChild(head)

    const list = createEl('div', { className: 'webos-user-menu-list' })
    list.appendChild(
      this._item('账户设置', () => {
        this._options.onAccountSettings?.()
        this.close()
      }),
    )
    list.appendChild(
      this._item(
        '退出登录',
        () => {
          // UserSession.clear() 触发 user.change(null) → main.ts 的监听器自动重弹登录框
          UserSession.instance.clear()
          this._options.onLogout?.()
          this.close()
        },
        true,
      ),
    )
    el.appendChild(list)
  }

  private _item(label: string, onClick: () => void, danger = false): HTMLElement {
    const it = createEl('button', {
      className: `webos-user-menu-item${danger ? ' webos-user-menu-item--danger' : ''}`,
      attrs: { type: 'button' },
      text: label,
    })
    this.addDomListener(it, 'click', onClick)
    return it
  }

  open(anchor: { x: number; y: number }): void {
    if (this._isOpen) return
    this._isOpen = true
    if (this._removeTimer) {
      clearTimeout(this._removeTimer)
      this._removeTimer = null
    }
    document.body.appendChild(this.el)
    requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect()
      let left = anchor.x - rect.width
      if (left < 8) left = 8
      this.el.style.left = `${left}px`
      this.el.style.top = `${anchor.y}px`
      this.el.classList.add('webos-user-menu--shown')
    })
    setTimeout(() => {
      document.addEventListener('mousedown', this._onOutsideClick, true)
      document.addEventListener('keydown', this._onKeyDown, true)
    }, 0)
  }

  close(): void {
    if (!this._isOpen) return
    this._isOpen = false
    document.removeEventListener('mousedown', this._onOutsideClick, true)
    document.removeEventListener('keydown', this._onKeyDown, true)
    this.el.classList.remove('webos-user-menu--shown')
    if (this._removeTimer) clearTimeout(this._removeTimer)
    this._removeTimer = setTimeout(() => {
      this._removeTimer = null
      if (!this._isOpen) removeEl(this.el)
    }, 150)
  }

  toggle(anchor: { x: number; y: number }): void {
    if (this._isOpen) this.close()
    else this.open(anchor)
  }

  private _onOutsideClick = (e: MouseEvent): void => {
    if (!this._isOpen) return
    if (!this.el.contains(e.target as Node)) this.close()
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }
}

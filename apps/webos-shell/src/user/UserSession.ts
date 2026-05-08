/**
 * 当前用户会话
 * 桌面壳级别的 singleton；所有 iframe 应用通过 Webos.user.* 间接访问
 *
 * 持久化底层走 @webos/host-sdk 的 session 模块（writeWebosSession 等），
 * 与登录页、SDK RPC 共用同一份实现，**单一真实来源**。
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../util'
import {
  readWebosSession,
  writeWebosSession,
  writeWebosUser,
  writeWebosToken,
  clearWebosSession,
  type User,
  type TokenInfo,
} from '@webos/host-sdk'

// shell 内部继续用 UserInfo 这个名字（与 SDK 的 User 等价）
export type UserInfo = User
export type { TokenInfo }

export interface UserSessionEvents {
  change: { user: UserInfo | null; token: TokenInfo | null }
  [key: string]: unknown
}

export class UserSession extends EventEmitter<UserSessionEvents> {
  private static _instance: UserSession | null = null

  static get instance(): UserSession {
    if (!UserSession._instance) UserSession._instance = new UserSession()
    return UserSession._instance
  }

  private _user: UserInfo | null = null
  private _token: TokenInfo | null = null
  // 是否把 user/token 持久化到 localStorage（默认 true；token 敏感场景使用方可关闭）
  private _persistEnabled = true

  constructor() {
    super()
    // 启动时从 localStorage 恢复（同一份格式，登录页或 SDK 写进去都能读）
    const saved = readWebosSession()
    this._user = saved.user
    this._token = saved.token
  }

  // 设置 user + token（登录成功时调）
  set(payload: { user: UserInfo; token?: TokenInfo | null }): void {
    this._user = payload.user
    this._token = payload.token ?? null
    if (this._persistEnabled) writeWebosSession(payload)
    this.emit('change', { user: this._user, token: this._token })
  }

  // 仅更新 user（资料 / 头像变化；token 保持不变）
  setUser(user: UserInfo | null): void {
    this._user = user
    if (this._persistEnabled) writeWebosUser(user)
    this.emit('change', { user: this._user, token: this._token })
  }

  // 仅更新 token（refresh token 流程；user 保持不变）
  setToken(token: TokenInfo | null): void {
    this._token = token
    if (this._persistEnabled) writeWebosToken(token)
    this.emit('change', { user: this._user, token: this._token })
  }

  // 清除（登出 / token 过期）
  clear(): void {
    this._user = null
    this._token = null
    if (this._persistEnabled) clearWebosSession()
    this.emit('change', { user: null, token: null })
  }

  get user(): UserInfo | null {
    return this._user
  }

  get token(): TokenInfo | null {
    return this._token
  }

  // 只读 access token 字符串
  get accessToken(): string | null {
    return this._token?.accessToken ?? null
  }

  get permissions(): string[] {
    return this._user?.permissions ?? []
  }

  // access token 是否已过期（基于 expiresAt 与本机时间）
  isTokenExpired(): boolean {
    if (!this._token || typeof this._token.expiresAt !== 'number') return false
    return this._token.expiresAt <= Date.now()
  }

  // 是否登录
  get authenticated(): boolean {
    return this._user !== null
  }

  // 持久化开关；敏感场景使用方可关掉（关掉后内存里仍有，但 localStorage 不再写）
  setPersist(enabled: boolean): void {
    this._persistEnabled = enabled
    if (!enabled) clearWebosSession()
    else writeWebosSession({ user: this._user!, token: this._token })
  }
}

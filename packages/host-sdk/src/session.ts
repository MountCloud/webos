/**
 * webos 用户会话 —— localStorage 读写的纯函数
 *
 * 单一真实来源：登录页 / webos shell 的 UserSession / RPC 处理器 都走这里。
 * 数据格式：{ user: User | null, token: TokenInfo | null }，
 * 存储 key：'webos:user.session'
 *
 * 同 origin（同协议 + 同域 + 同端口）下 localStorage 共享，所以登录页
 * 写完直接跳到 webos 主程序，UserSession 启动时会读到这里写的数据。
 *
 *   // 登录页
 *   import { writeWebosSession } from '@webos/host-sdk'
 *
 *   writeWebosSession({
 *     user: { id, name },
 *     token: { accessToken, refreshToken, expiresAt },
 *   })
 *   location.href = '/'
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { User, TokenInfo } from './core/types'

const STORAGE_KEY = 'webos:user.session'

export interface WebosSessionPayload {
  user: User | null
  token: TokenInfo | null
}

// ===== 内部辅助 =====

function readRaw(): WebosSessionPayload {
  if (typeof localStorage === 'undefined') return { user: null, token: null }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw) as Partial<WebosSessionPayload>
    return { user: parsed.user ?? null, token: parsed.token ?? null }
  } catch {
    return { user: null, token: null }
  }
}

function writeRaw(payload: WebosSessionPayload): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage 满 / 禁用：静默失败
  }
}

// ===== 公开 API =====

// 同时写 user + token（登录成功）
export function writeWebosSession(payload: { user: User; token?: TokenInfo | null }): void {
  writeRaw({ user: payload.user, token: payload.token ?? null })
}

// 只更新 user（user 信息变化，比如改名 / 改头像；token 保持不变）
export function writeWebosUser(user: User | null): void {
  const cur = readRaw()
  writeRaw({ user, token: cur.token })
}

// 只更新 token（refresh token 流程；user 保持不变）
export function writeWebosToken(token: TokenInfo | null): void {
  const cur = readRaw()
  writeRaw({ user: cur.user, token })
}

// 读出当前会话；未登录 user / token 都为 null
export function readWebosSession(): WebosSessionPayload {
  return readRaw()
}

// 清除（登出）
export function clearWebosSession(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// 是否已登录的便利方法
export function hasWebosSession(): boolean {
  return readRaw().user !== null
}

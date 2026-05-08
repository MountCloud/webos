/**
 * Webos.user.*
 * 用户与权限：读取 / 写入当前 SSO 会话；订阅变化
 *
 * 数据真正来源：webos shell 端的 UserSession singleton。
 * 使用方在 webos 启动时调 UserSession.instance.set({...}) 注入用户信息，
 * 之后任意应用都能通过 Webos.user.* 访问。
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'
import type { User, TokenInfo, UserChangePayload } from '../core/types'

export function createUser(rpc: RpcClient) {
  return {
    // 当前登录用户；未登录返回 null
    async current(): Promise<User | null> {
      return rpc.call<User | null>('user', 'current')
    },

    // 当前用户的权限列表（user.permissions 字段）
    async permissions(): Promise<string[]> {
      return rpc.call<string[]>('user', 'permissions')
    },

    // 当前完整 token 信息：accessToken / refreshToken / expiresAt / scope / ...
    async token(): Promise<TokenInfo | null> {
      return rpc.call<TokenInfo | null>('user', 'token')
    },

    // 便利方法：只取 access token 字符串（最常见的"塞 Authorization 头"场景）
    async accessToken(): Promise<string | null> {
      const t = await rpc.call<TokenInfo | null>('user', 'token')
      return t?.accessToken ?? null
    },

    // 便利方法：access token 是否已过期（基于 expiresAt 与本机时间）
    // 没设 expiresAt 视为不过期 → 返回 false
    async isTokenExpired(): Promise<boolean> {
      const t = await rpc.call<TokenInfo | null>('user', 'token')
      if (!t || typeof t.expiresAt !== 'number') return false
      return t.expiresAt <= Date.now()
    },

    // 设置当前用户 + token —— 登录成功 / SSO 回调时调
    // 不做权限校验，任何应用都能调；生产建议覆盖 host handler 限制白名单
    async set(payload: { user: User; token?: TokenInfo | null }): Promise<void> {
      await rpc.call('user', 'set', payload)
    },

    // 清除会话（登出）
    async clear(): Promise<void> {
      await rpc.call('user', 'clear')
    },

    // 仅更新 user（资料修改、头像变更等；token 保持不变）
    async setUser(user: User | null): Promise<void> {
      await rpc.call('user', 'setUser', { user })
    },

    // 仅刷新 token（refresh token 流程；user 保持不变）
    async setToken(token: TokenInfo | null): Promise<void> {
      await rpc.call('user', 'setToken', { token })
    },

    // 订阅会话变化：登录 / 登出 / 用户切换 / token 刷新都触发
    on(event: 'change', handler: (payload: UserChangePayload) => void): () => void {
      void event
      return rpc.on('user.changed', (payload) => handler(payload as UserChangePayload))
    },
  }
}

export function createPermission(rpc: RpcClient) {
  return async function requestPermission(options: {
    permissions: string[]
    reason?: string
  }): Promise<boolean> {
    return rpc.call<boolean>('permission', 'request', options)
  }
}

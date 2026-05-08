/**
 * SDK 内部类型定义
 * 这里复制了 protocol 包的类型，避免运行时依赖（让 SDK 完全独立）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export interface RpcRequest {
  type: 'webos.request'
  id: string
  appId: string
  module: string
  method: string
  args: unknown
}

export interface RpcResponse {
  type: 'webos.response'
  id: string
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}

export interface RpcEvent {
  type: 'webos.event'
  event: string
  payload?: unknown
}

export interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  permissions?: string[]
  // 业务方扩展字段任意（只要能 JSON 序列化）
  [key: string]: unknown
}

// OAuth / OIDC 标准字段都收齐；不用的字段不传
export interface TokenInfo {
  // 必填：access token 本体（调 API 往 Authorization 头塞的就是它）
  accessToken: string
  // access token 过期后换新的凭证
  refreshToken?: string
  // 一般是 'Bearer'
  tokenType?: string
  // 过期时间（epoch ms 时间戳；不传表示不知道 / 不过期）
  expiresAt?: number
  // 作用域 / 权限范围
  scope?: string
  // OIDC id_token（含身份声明的 JWT）
  idToken?: string
  // 业务方扩展字段（只要能 JSON 序列化）
  [key: string]: unknown
}

export interface UserChangePayload {
  user: User | null
  token: TokenInfo | null
}

export type Theme = 'light' | 'dark'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'critical'

export interface NotificationAction {
  label: string
  // 注：actions 通过 SDK 不能直接传函数（postMessage 不能传函数）
  // 实际上 onClick 由 SDK 端 wrap 成 actionId，桌面壳调用时回 actionId 给应用
  actionId: string
}

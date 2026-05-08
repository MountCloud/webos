/**
 * webos 通信协议
 * 桌面壳与 iframe 应用通过 postMessage 交换的消息格式
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

// 应用 → 桌面壳：请求
export interface RpcRequest {
  type: 'webos.request'
  id: string
  appId: string
  module: string
  method: string
  args: unknown
}

// 桌面壳 → 应用：响应
export interface RpcResponse {
  type: 'webos.response'
  id: string
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}

// 桌面壳 → 应用：事件推送
export interface RpcEvent {
  type: 'webos.event'
  event: string
  payload?: unknown
}

export type WebosMessage = RpcRequest | RpcResponse | RpcEvent

// 错误码
export const RpcErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  HANDLER_ERROR: 'HANDLER_ERROR',
  TIMEOUT: 'TIMEOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_ARGS: 'INVALID_ARGS',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const

export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode]

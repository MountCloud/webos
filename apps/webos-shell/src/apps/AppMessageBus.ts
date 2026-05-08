/**
 * 应用消息总线
 * 桌面壳与 iframe 应用通过 postMessage 通信
 *
 * 协议：
 *   { type: 'webos.request', id, module, method, args }
 *   { type: 'webos.response', id, ok, data, error }
 *   { type: 'webos.event', event, payload }
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../util'
import type { AppWindow } from '../core/window'

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

export interface AppEvent {
  type: 'webos.event'
  event: string
  payload?: unknown
}

export type RpcHandler = (req: RpcRequest, source: AppWindow) => Promise<unknown> | unknown

export interface AppMessageBusEvents {
  request: { req: RpcRequest; source: AppWindow }
  [key: string]: unknown
}

export class AppMessageBus extends EventEmitter<AppMessageBusEvents> {
  private static _instance: AppMessageBus | null = null

  static get instance(): AppMessageBus {
    if (!AppMessageBus._instance) AppMessageBus._instance = new AppMessageBus()
    return AppMessageBus._instance
  }

  private rpcHandlers = new Map<string, Map<string, RpcHandler>>()
  private appWindows = new Set<AppWindow>()
  private installed = false

  install(): void {
    if (this.installed) return
    this.installed = true
    window.addEventListener('message', (e) => {
      const msg = e.data
      if (!msg || typeof msg !== 'object' || msg.type !== 'webos.request') return

      // 找到来源窗口
      const source = this._findSourceWindow(e.source)
      if (!source) return

      void this._handleRequest(msg as RpcRequest, source)
    })
  }

  registerWindow(win: AppWindow): void {
    this.appWindows.add(win)
    win.on('close', () => this.appWindows.delete(win))
  }

  // 注册某个 module.method 的处理器
  registerHandler(module: string, method: string, handler: RpcHandler): void {
    if (!this.rpcHandlers.has(module)) {
      this.rpcHandlers.set(module, new Map())
    }
    this.rpcHandlers.get(module)!.set(method, handler)
  }

  // 向某个应用 iframe 推送事件
  pushEvent(target: AppWindow, event: string, payload?: unknown): void {
    target.sendMessage({ type: 'webos.event', event, payload })
  }

  // 向所有应用广播事件
  broadcast(event: string, payload?: unknown): void {
    for (const win of this.appWindows) {
      this.pushEvent(win, event, payload)
    }
  }

  private _findSourceWindow(eventSource: MessageEventSource | null): AppWindow | null {
    for (const win of this.appWindows) {
      if (win.iframe?.contentWindow === eventSource) return win
    }
    return null
  }

  private async _handleRequest(req: RpcRequest, source: AppWindow): Promise<void> {
    // 用 source window 反查的 appId 覆盖 iframe 自报的 —— 防伪造、防漏传
    const trustedAppId = source.appId
    if (req.appId !== trustedAppId) {
      if (req.appId && req.appId !== 'unknown') {
        console.warn(
          `[webos] appId mismatch: iframe="${req.appId}" trusted="${trustedAppId}"`,
        )
      }
      req = { ...req, appId: trustedAppId }
    }

    this.emit('request', { req, source })

    const handler = this.rpcHandlers.get(req.module)?.get(req.method)
    if (!handler) {
      this._respond(source, req.id, false, undefined, {
        code: 'NOT_FOUND',
        message: `未找到处理器：${req.module}.${req.method}`,
      })
      return
    }

    try {
      const result = await handler(req, source)
      this._respond(source, req.id, true, result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      // handler 主动 Object.assign(new Error, {code}) 这种带 code 的不要被吞
      const code = (err as { code?: string } | null)?.code ?? 'HANDLER_ERROR'
      this._respond(source, req.id, false, undefined, { code, message })
    }
  }

  private _respond(
    target: AppWindow,
    id: string,
    ok: boolean,
    data?: unknown,
    error?: { code: string; message: string },
  ): void {
    const resp: RpcResponse = { type: 'webos.response', id, ok }
    if (data !== undefined) resp.data = data
    if (error) resp.error = error
    target.sendMessage(resp)
  }
}

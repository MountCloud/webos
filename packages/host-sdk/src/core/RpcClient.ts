/**
 * RPC 客户端
 * 通过 postMessage 与父窗口（桌面壳）通信
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcRequest, RpcResponse, RpcEvent } from './types'

const DEFAULT_TIMEOUT = 30_000

export interface RpcClientOptions {
  // 父窗口（默认 window.parent）
  target?: Window
  // 应用 ID（自动从 URL 参数 / manifest 读取）
  appId?: string
  // 默认超时（毫秒）
  timeout?: number
  // 是否打印调试信息
  debug?: boolean
}

interface PendingCall {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class RpcClient {
  private pending = new Map<string, PendingCall>()
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>()
  private nextId = 0
  private installed = false

  constructor(private readonly options: RpcClientOptions = {}) {}

  install(): void {
    if (this.installed) return
    if (typeof window === 'undefined') return
    this.installed = true
    window.addEventListener('message', (e) => this._handleMessage(e))
  }

  private get target(): Window {
    return this.options.target ?? window.parent ?? window
  }

  private get appId(): string {
    return this.options.appId ?? this._guessAppId()
  }

  private get timeout(): number {
    return this.options.timeout ?? DEFAULT_TIMEOUT
  }

  // 调用桌面壳能力
  async call<T = unknown>(module: string, method: string, args: unknown = {}): Promise<T> {
    if (!this.installed) this.install()
    const id = `req-${++this.nextId}-${Date.now().toString(36)}`
    const req: RpcRequest = {
      type: 'webos.request',
      id,
      appId: this.appId,
      module,
      method,
      args,
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`[webos] RPC timeout: ${module}.${method}`))
      }, this.timeout)

      this.pending.set(id, {
        resolve: (data) => resolve(data as T),
        reject,
        timer,
      })

      if (this.options.debug) {
        console.log('[webos] →', req)
      }
      this.target.postMessage(req, '*')
    })
  }

  // 监听桌面壳推送的事件
  on(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.installed) this.install()
    let set = this.eventHandlers.get(event)
    if (!set) {
      set = new Set()
      this.eventHandlers.set(event, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  private _handleMessage(e: MessageEvent): void {
    const msg = e.data
    if (!msg || typeof msg !== 'object') return

    if (msg.type === 'webos.response') {
      this._handleResponse(msg as RpcResponse)
    } else if (msg.type === 'webos.event') {
      this._handleEvent(msg as RpcEvent)
    }
  }

  private _handleResponse(resp: RpcResponse): void {
    const pending = this.pending.get(resp.id)
    if (!pending) return
    this.pending.delete(resp.id)
    clearTimeout(pending.timer)

    if (this.options.debug) {
      console.log('[webos] ←', resp)
    }

    if (resp.ok) {
      pending.resolve(resp.data)
    } else {
      const err = new Error(resp.error?.message ?? 'RPC failed')
      ;(err as Error & { code?: string }).code = resp.error?.code ?? 'UNKNOWN'
      pending.reject(err)
    }
  }

  private _handleEvent(ev: RpcEvent): void {
    const handlers = this.eventHandlers.get(ev.event)
    if (!handlers) return
    for (const fn of handlers) {
      try {
        fn(ev.payload)
      } catch (err) {
        console.error(`[webos] event handler error: ${ev.event}`, err)
      }
    }
  }

  // 自动从 URL 参数或 referrer 推测 appId
  private _guessAppId(): string {
    if (typeof window === 'undefined') return 'unknown'
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('webosAppId')
    if (fromQuery) return fromQuery
    return 'unknown'
  }
}

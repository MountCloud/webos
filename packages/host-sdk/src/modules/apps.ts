/**
 * Webos.apps / Webos.message / Webos.events
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

// 应用维度的扁平元信息
export interface AppMeta {
  appId: string
  name: string
  icon?: string
  version?: string
}

// 入口维度的扁平元信息（host listEntries 的回包）
export interface EntryMeta {
  appId: string
  appName: string
  appIcon?: string
  id: string
  name: string
  icon?: string
  uri: string
  description?: string
  launchMode?: 'window' | 'tab'
  showIn?: Array<'desktop' | 'start-menu' | 'app-store'>
  order?: number
  category?: string
  tags?: string[]
}

export interface OpenOptions {
  // 必填：哪个 entry
  entryId: string
  // 直达子功能（该 entry 的 features 里登记过的 id）
  feature?: string
  // 启动参数（透传给应用，URL 查询串）
  params?: Record<string, unknown>
}

export function createAppsApi(rpc: RpcClient) {
  return {
    // 应用维度（每个 app 一条）
    async list(): Promise<AppMeta[]> {
      return rpc.call<AppMeta[]>('apps', 'list')
    },

    // 入口维度（每个 entry 一条；含 appId / appName 扁平字段）
    async listEntries(filter?: {
      showIn?: 'desktop' | 'start-menu' | 'app-store'
    }): Promise<EntryMeta[]> {
      return rpc.call<EntryMeta[]>('apps', 'listEntries', filter ?? {})
    },

    // 打开应用的某个 entry（必须显式 entryId）
    async open(appId: string, options: OpenOptions): Promise<void> {
      if (!options || !options.entryId) {
        throw new Error('Webos.apps.open(appId, { entryId, ... }) 必须传 entryId')
      }
      await rpc.call('apps', 'open', {
        appId,
        entryId: options.entryId,
        feature: options.feature,
        params: options.params,
      })
    },

    async has(appId: string, entryId?: string): Promise<boolean> {
      return rpc.call<boolean>('apps', 'has', { appId, entryId })
    },
  }
}

export function createMessage(rpc: RpcClient) {
  const handlers = new Set<(message: unknown, fromAppId: string) => void>()
  let installed = false

  function ensureInstalled(): void {
    if (installed) return
    installed = true
    rpc.on('message', (payload) => {
      const data = payload as { message?: unknown; from?: string }
      for (const fn of handlers) fn(data?.message, data?.from ?? 'unknown')
    })
  }

  return {
    async send(targetAppId: string, message: unknown): Promise<void> {
      await rpc.call('message', 'send', { targetAppId, message })
    },
    on(handler: (message: unknown, fromAppId: string) => void): () => void {
      ensureInstalled()
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
  }
}

export function createEvents(rpc: RpcClient) {
  return {
    async emit(event: string, payload?: unknown): Promise<void> {
      await rpc.call('events', 'emit', { event, payload })
    },
    on(event: string, handler: (payload: unknown) => void): () => void {
      return rpc.on(event, handler)
    },
  }
}

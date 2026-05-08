/**
 * Webos.storage.*
 * 应用本地存储（KV）
 * V1：直接用 localStorage（每个应用独立 namespace）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export function createStorage(rpc: RpcClient) {
  // 通过 rpc 拿到 appId 作为 namespace
  let nsPrefix: string | null = null

  async function getPrefix(): Promise<string> {
    if (nsPrefix !== null) return nsPrefix
    try {
      // apps.self 返回 { appId, entryId }；按 appId 共享 storage
      // （多个 entry 同属一个应用，共享存储更符合直觉）
      const self = await rpc.call<{ appId?: string } | string>('apps', 'self')
      const appId = typeof self === 'string' ? self : self?.appId
      nsPrefix = `webos.app.${appId ?? 'unknown'}.`
    } catch {
      nsPrefix = 'webos.app.unknown.'
    }
    return nsPrefix
  }

  function safeKey(prefix: string, key: string): string {
    return prefix + key
  }

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const prefix = await getPrefix()
      const raw = localStorage.getItem(safeKey(prefix, key))
      if (raw === null) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      const prefix = await getPrefix()
      const raw = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(safeKey(prefix, key), raw)
    },
    async remove(key: string): Promise<void> {
      const prefix = await getPrefix()
      localStorage.removeItem(safeKey(prefix, key))
    },
    async clear(): Promise<void> {
      const prefix = await getPrefix()
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) toRemove.push(k)
      }
      toRemove.forEach((k) => localStorage.removeItem(k))
    },
  }
}

/**
 * Webos.system.*
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface SystemInfo {
  version: string
  platform: string
  locale: string
  theme: 'light' | 'dark'
  userAgent: string
}

export function createSystem(rpc: RpcClient) {
  return {
    async info(): Promise<SystemInfo> {
      return rpc.call<SystemInfo>('system', 'info')
    },
    async openSettings(panel?: string): Promise<void> {
      await rpc.call('system', 'openSettings', { panel })
    },
    async search(query: string): Promise<void> {
      await rpc.call('system', 'search', { query })
    },
  }
}

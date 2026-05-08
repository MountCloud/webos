/**
 * Webos.window.*
 * 当前窗口控制
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export function createWindow(rpc: RpcClient) {
  return {
    async minimize(): Promise<void> {
      await rpc.call('window', 'minimize')
    },
    async maximize(): Promise<void> {
      await rpc.call('window', 'maximize')
    },
    async restore(): Promise<void> {
      await rpc.call('window', 'restore')
    },
    async close(): Promise<void> {
      await rpc.call('window', 'close')
    },
    async setTitle(title: string): Promise<void> {
      await rpc.call('window', 'setTitle', { title })
    },
    async setBadge(n: number | null): Promise<void> {
      await rpc.call('window', 'setBadge', { n })
    },
    async setBusy(busy: boolean): Promise<void> {
      await rpc.call('window', 'setBusy', { busy })
    },
    async fullscreen(): Promise<void> {
      await rpc.call('window', 'fullscreen')
    },

    // ===== 尺寸 / 位置 =====
    async setSize(width: number, height: number): Promise<void> {
      await rpc.call('window', 'setSize', { width, height })
    },
    async setBounds(bounds: Partial<WindowBounds>): Promise<void> {
      await rpc.call('window', 'setBounds', bounds)
    },
    async getBounds(): Promise<WindowBounds> {
      return rpc.call<WindowBounds>('window', 'getBounds')
    },
    async center(): Promise<void> {
      await rpc.call('window', 'center')
    },
  }
}

/**
 * Webos.notify
 * 桌面通知
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'
import type { NotificationLevel } from '../core/types'

export interface NotifyOptions {
  title: string
  message?: string
  level?: NotificationLevel
  duration?: number
}

export function createNotify(rpc: RpcClient) {
  return async function notify(options: NotifyOptions): Promise<void> {
    await rpc.call('notify', 'show', options)
  }
}

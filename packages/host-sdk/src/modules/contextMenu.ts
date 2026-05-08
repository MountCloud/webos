/**
 * Webos.contextMenu
 * 弹出上下文菜单
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface ContextMenuItem {
  label?: string
  icon?: string
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  // 不能直接传函数，用 actionId 让桌面壳回调
  actionId?: string
  children?: ContextMenuItem[]
}

export interface ContextMenuOptions {
  items: ContextMenuItem[]
  x: number
  y: number
}

export function createContextMenu(rpc: RpcClient) {
  return async function contextMenu(options: ContextMenuOptions): Promise<string | null> {
    // 返回选中项的 actionId（应用方据此分发）
    return rpc.call<string | null>('contextMenu', 'show', options)
  }
}

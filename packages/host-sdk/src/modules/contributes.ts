/**
 * Webos.contributes.*
 * 扩展点契约：宿主应用查询"哪些应用想嵌进我的某个 slot"
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface ContributedExtension {
  // 提供方应用 ID
  appId: string
  appName: string
  // 提供方对应的 entry（host 端用来追踪窗口 / 启动）
  entryId: string
  // 显示名（host 用来渲染入口标签）
  label: string
  icon?: string
  description?: string
  // 完整可加载的 URL（host 已解析 entry.uri + ep.uri）
  uri: string
}

export function createContributes(rpc: RpcClient) {
  return {
    // 列出所有匹配 (host, slot) 的扩展贡献
    // host = 宿主 appId；slot = 宿主自定义的扩展槽名（如 'settings.tabs'）
    async list(filter: { host: string; slot?: string }): Promise<ContributedExtension[]> {
      return rpc.call<ContributedExtension[]>('contributes', 'list', filter)
    },
  }
}

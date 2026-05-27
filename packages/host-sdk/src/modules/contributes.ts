/**
 * Webos.contributes.*
 * 扩展点契约：宿主应用查询"哪些应用想嵌进我的某个 slot"
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface ContributedExtension {
  // 框架注入，一定有
  appId: string
  appName: string
  // 提供方对应的 entry（host 端用来追踪窗口 / 启动）
  entryId: string
  // 与查询条件一致，原样带回
  host: string
  slot: string
  // 仅当扩展点声明了 uri：host 已解析 entry.uri + ep.uri 的完整 URL；没声明则不带
  uri?: string
  // 以下是常用业务字段，框架不强制；给出类型方便补全
  label?: string
  icon?: string
  description?: string
  // 扩展点里放的其余任意业务属性，原样透传
  [key: string]: unknown
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

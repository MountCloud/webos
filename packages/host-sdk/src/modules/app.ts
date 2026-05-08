/**
 * Webos.app.*
 * 应用自身相关查询（与 Webos.apps.* 区分：那个是查"所有应用"）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface AppBootInfo {
  // 当前应用 ID
  appId: string
  // 当前 entry ID
  entryId: string
  // 启动时若指定了 feature，这里给出 id
  feature?: string
  // 实际加载的 URL（含 feature.uri / params）
  uri?: string
  // 启动时透传的 params
  params?: Record<string, unknown>
}

export function createApp(rpc: RpcClient) {
  return {
    // 启动元信息：当前应用 ID / entry ID、首次进入是哪个子功能、传入的参数
    async bootInfo(): Promise<AppBootInfo> {
      return rpc.call<AppBootInfo>('app', 'bootInfo')
    },

    // 监听 host 端推送的 app.navigate 事件（已运行实例被 launch(feature: ...) 唤起时触发）
    onNavigate(
      handler: (payload: {
        feature?: string
        uri?: string
        params?: Record<string, unknown>
      }) => void,
    ): () => void {
      return rpc.on('app.navigate', (payload) => {
        handler(payload as Parameters<typeof handler>[0])
      })
    },
  }
}

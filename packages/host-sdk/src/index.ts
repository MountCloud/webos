/**
 * @webos/host-sdk
 * webos 应用 SDK
 *
 * 应用接入示例：
 *
 *   import { Webos } from '@webos/host-sdk'
 *
 *   await Webos.notify({ title: 'Hello', message: '...' })
 *   const file = await Webos.dialog.openFile({ accept: ['.json'] })
 *   const ok = await Webos.dialog.confirm('确定？')
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { RpcClient, type RpcClientOptions } from './core/RpcClient'
import { createNotify } from './modules/notify'
import { createWindow } from './modules/window'
import { createDialog } from './modules/dialog'
import { createContextMenu } from './modules/contextMenu'
import { createDownload, createUpload } from './modules/file'
import { createUser, createPermission } from './modules/user'
import { createTheme } from './modules/theme'
import { createStorage } from './modules/storage'
import { createAppsApi, createMessage, createEvents } from './modules/apps'
import { createSystem } from './modules/system'
import { createApp } from './modules/app'
import { createContributes } from './modules/contributes'
import { installBaseStyles } from './baseStyles'

// SDK 单例（默认全局只有一份）
const defaultClient = new RpcClient()

// 在 iframe 里自动注入基础样式（滚动条 + 主题跟随），顶级页面不动
installBaseStyles(defaultClient)

export const Webos = {
  notify: createNotify(defaultClient),
  window: createWindow(defaultClient),
  dialog: createDialog(defaultClient),
  contextMenu: createContextMenu(defaultClient),
  download: createDownload(defaultClient),
  upload: createUpload(defaultClient),
  user: createUser(defaultClient),
  requestPermission: createPermission(defaultClient),
  theme: createTheme(defaultClient),
  storage: createStorage(defaultClient),
  apps: createAppsApi(defaultClient),
  app: createApp(defaultClient),
  contributes: createContributes(defaultClient),
  message: createMessage(defaultClient),
  events: createEvents(defaultClient),
  system: createSystem(defaultClient),

  // 配置 SDK（appId / target / debug 等）
  configure(options: RpcClientOptions): void {
    Object.assign((defaultClient as unknown as { options: RpcClientOptions }).options, options)
  },

  // 直接访问底层 RpcClient（高级用法）
  get client(): RpcClient {
    return defaultClient
  },
}

// 默认导出
export default Webos

// 类型导出
export { RpcClient } from './core/RpcClient'
export type { RpcClientOptions } from './core/RpcClient'
export type { User, UserChangePayload, Theme, NotificationLevel } from './core/types'
export type { NotifyOptions } from './modules/notify'
export type {
  OpenFileOptions,
  SaveFileOptions,
  PropertiesOptions,
  ProgressHandle,
} from './modules/dialog'
export type { ContextMenuItem, ContextMenuOptions } from './modules/contextMenu'
export type { DownloadOptions, UploadOptions, UploadResult } from './modules/file'
export type { AppMeta, EntryMeta, OpenOptions } from './modules/apps'
export type { SystemInfo } from './modules/system'
export type { AppBootInfo } from './modules/app'
export type { ContributedExtension } from './modules/contributes'
export type { WindowBounds } from './modules/window'
export type { TokenInfo } from './core/types'

// 同 origin 登录页用：直接读写 localStorage，不走 RPC
// 同时也是 webos shell UserSession 的持久化底层 —— 单一真实来源
export {
  writeWebosSession,
  writeWebosUser,
  writeWebosToken,
  readWebosSession,
  clearWebosSession,
  hasWebosSession,
  type WebosSessionPayload,
} from './session'

/**
 * 应用 Manifest 类型定义（共享给桌面壳与 SDK 使用）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export interface AppManifest {
  appId: string
  name: string
  nameI18n?: Record<string, string>
  version?: string
  vendor?: string
  description?: string
  icon: string
  category?: string
  tags?: string[]

  entry: string

  defaultWindow?: {
    width?: number | string
    height?: number | string
    resizable?: boolean
    minWidth?: number
    minHeight?: number
    maximizable?: boolean
  }

  permissions?: string[]
  showIn?: ('desktop' | 'start-menu' | 'app-store')[]
  order?: number
  singleInstance?: boolean
}

export interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  permissions?: string[]
}

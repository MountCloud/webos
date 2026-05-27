/**
 * 应用清单（Manifest）
 *
 * 设计要点：
 * - 应用 = 元信息层（顶层）+ 一个或多个 entries（启动单元）
 * - 顶层只放应用元信息；启动相关字段（uri / launchMode / defaultWindow / showIn / singleInstance / permissions / features）全部写在 entries[i] 里
 * - features 归属各 entry，不允许在顶层
 * - permissions 归属各 entry（per-iframe 上下文）
 * - 一个 entry = 一个桌面图标 / dock 项 / 启动方式
 * - 严格校验：顶层出现启动相关字段直接报错
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export interface AppManifest {
  // ===== 应用元信息层（与启动无关）=====
  // 全局唯一 ID，仅允许字母 / 数字 / _ . -
  appId: string
  // 应用本身名（用于商店 / 关于）
  name: string
  nameI18n?: Record<string, string>
  version?: string
  vendor?: string
  description?: string
  // 应用本身图标（商店 / 关于用；桌面图标走 entry.icon）
  icon?: string
  category?: string
  tags?: string[]

  // ===== 入口（必填，至少 1 个）=====
  entries: AppEntry[]

  // ===== 扩展点（可选，与 entries 解耦）=====
  contributes?: AppContributes
}

export interface AppEntry {
  // 应用内唯一
  id: string
  // 桌面 / dock / 搜索结果显示名
  name: string
  // 桌面图标
  icon: string
  // 入口的绝对 URL（http / https / data: 等）
  uri: string

  // 描述（搜索结果副标题 / hover tooltip 用）
  description?: string

  // 启动模式
  // - 'window'：iframe 进 webos 窗口（默认，可与 SDK 通信）
  // - 'tab'：浏览器新开标签页（脱离 webos，SDK 不可用）
  launchMode?: 'window' | 'tab'

  // 默认窗口配置（仅 launchMode='window' 时生效；应用运行时可再改）
  defaultWindow?: {
    width?: number | string
    height?: number | string
    resizable?: boolean
    minWidth?: number
    minHeight?: number
    maximizable?: boolean
  }

  // 显示位置
  showIn?: ('desktop' | 'start-menu' | 'app-store')[]
  // 排序权重（越小越靠前；同 showIn 区域内生效）
  order?: number

  // 单例：true = 该 entry 只允许一个窗口（per-entry，不影响其他 entry）
  singleInstance?: boolean

  // 申请权限（仅声明，不强制校验；V1.0 计划 handler 拦截）
  permissions?: string[]

  // 子功能 / 深链入口（属于该 entry）
  features?: AppFeature[]
}

export interface AppFeature {
  // 该 entry 内唯一
  id: string
  name: string
  description?: string
  // 不传则继承 entry.icon
  icon?: string
  // 相对所属 entry.uri 的子路径 / 查询串 / hash；也可绝对 URL 覆盖
  uri: string
  keywords?: string[]
  // 搜索结果分组标签
  category?: string
}

export interface AppContributes {
  extensionPoints?: ExtensionPoint[]
}

export interface ExtensionPoint {
  // ===== 固定字段（框架必填）=====
  // 被扩展的应用 appId（host / extension 之间约定的字符串）
  host: string
  // 槽位名（host / extension 之间约定）
  slot: string
  // 触发时打开本应用哪个 entry（必填）
  entryId: string
  // ===== 业务字段（框架不强制；常用的给出类型方便补全）=====
  // 给了才解析：相对所选 entry.uri 的子路径，支持 {var} 占位符；不给则 list() 不带 uri
  uri?: string
  // host UI 上显示的文字
  label?: string
  icon?: string
  description?: string
  permissions?: string[]
  // 业务自定义任意属性，原样透传给 host（list() 会带回）
  [key: string]: unknown
}

// ===== 校验 =====

export class AppManifestError extends Error {
  constructor(message: string) {
    super(`[AppManifest] ${message}`)
  }
}

const APP_ID_RE = /^[a-zA-Z0-9_.-]+$/
const VALID_SHOW_IN = ['desktop', 'start-menu', 'app-store'] as const
const VALID_LAUNCH_MODE = ['window', 'tab'] as const

export function validateManifest(manifest: unknown): AppManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new AppManifestError('manifest 必须是对象')
  }
  const m = manifest as Record<string, unknown>

  // ----- 顶层 -----
  if (typeof m.appId !== 'string' || !APP_ID_RE.test(m.appId)) {
    throw new AppManifestError(`appId 不合法：${String(m.appId)}（仅允许字母、数字、_ . -）`)
  }
  if (typeof m.name !== 'string' || !m.name) {
    throw new AppManifestError(`${m.appId}：name 必填`)
  }

  // 拦截顶层启动相关字段（这些只能写在 entries[i] 里）
  for (const old of ['entry', 'launchMode', 'defaultWindow', 'showIn', 'singleInstance', 'permissions', 'features']) {
    if (old in m) {
      throw new AppManifestError(
        `${m.appId}：字段 "${old}" 只能写在 entries[i] 里，不能放顶层`,
      )
    }
  }

  // ----- entries -----
  if (!Array.isArray(m.entries) || m.entries.length === 0) {
    throw new AppManifestError(`${m.appId}：entries 必须是非空数组`)
  }
  const entryIds = new Set<string>()
  for (let i = 0; i < m.entries.length; i++) {
    const e = m.entries[i] as Record<string, unknown>
    const where = `${m.appId}.entries[${i}]`
    if (!e || typeof e !== 'object') {
      throw new AppManifestError(`${where} 必须是对象`)
    }
    if (typeof e.id !== 'string' || !e.id) {
      throw new AppManifestError(`${where}.id 必填`)
    }
    if (entryIds.has(e.id)) {
      throw new AppManifestError(`${where}.id 重复：${e.id}（应用内唯一）`)
    }
    entryIds.add(e.id)
    if (typeof e.name !== 'string' || !e.name) {
      throw new AppManifestError(`${where}.name 必填`)
    }
    if (typeof e.icon !== 'string' || !e.icon) {
      throw new AppManifestError(`${where}.icon 必填`)
    }
    if (typeof e.uri !== 'string' || !e.uri) {
      throw new AppManifestError(`${where}.uri 必填`)
    }
    if (!isAbsoluteUri(e.uri)) {
      throw new AppManifestError(
        `${where}.uri 必须是绝对 URL（http(s) / data: 等）或以 / 开头的根相对路径，实际：${e.uri}`,
      )
    }
    if (e.launchMode !== undefined && !VALID_LAUNCH_MODE.includes(e.launchMode as never)) {
      throw new AppManifestError(`${where}.launchMode 不合法：${String(e.launchMode)}`)
    }
    if (e.showIn !== undefined) {
      if (!Array.isArray(e.showIn)) {
        throw new AppManifestError(`${where}.showIn 必须是数组`)
      }
      for (const s of e.showIn) {
        if (!VALID_SHOW_IN.includes(s as never)) {
          throw new AppManifestError(`${where}.showIn 含非法值：${String(s)}`)
        }
      }
    }
    if (e.permissions !== undefined && !Array.isArray(e.permissions)) {
      throw new AppManifestError(`${where}.permissions 必须是数组`)
    }

    // ----- features（每个 entry 内独立命名空间）-----
    if (e.features !== undefined) {
      if (!Array.isArray(e.features)) {
        throw new AppManifestError(`${where}.features 必须是数组`)
      }
      const featureIds = new Set<string>()
      for (let j = 0; j < e.features.length; j++) {
        const f = e.features[j] as Record<string, unknown>
        const fwhere = `${where}.features[${j}]`
        if (!f || typeof f !== 'object') {
          throw new AppManifestError(`${fwhere} 必须是对象`)
        }
        if (typeof f.id !== 'string' || !f.id) {
          throw new AppManifestError(`${fwhere}.id 必填`)
        }
        if (featureIds.has(f.id)) {
          throw new AppManifestError(`${fwhere}.id 重复：${f.id}（entry 内唯一）`)
        }
        featureIds.add(f.id)
        if (typeof f.name !== 'string' || !f.name) {
          throw new AppManifestError(`${fwhere}.name 必填`)
        }
        if (typeof f.uri !== 'string' || !f.uri) {
          throw new AppManifestError(`${fwhere}.uri 必填`)
        }
      }
    }
  }

  // ----- contributes（可选）-----
  if (m.contributes !== undefined) {
    const c = m.contributes as Record<string, unknown>
    if (typeof c !== 'object' || c === null) {
      throw new AppManifestError(`${m.appId}.contributes 必须是对象`)
    }
    if (c.extensionPoints !== undefined) {
      if (!Array.isArray(c.extensionPoints)) {
        throw new AppManifestError(`${m.appId}.contributes.extensionPoints 必须是数组`)
      }
      for (let i = 0; i < c.extensionPoints.length; i++) {
        const ep = c.extensionPoints[i] as Record<string, unknown>
        const where = `${m.appId}.contributes.extensionPoints[${i}]`
        if (typeof ep.host !== 'string' || !ep.host) {
          throw new AppManifestError(`${where}.host 必填`)
        }
        if (typeof ep.slot !== 'string' || !ep.slot) {
          throw new AppManifestError(`${where}.slot 必填`)
        }
        if (typeof ep.entryId !== 'string' || !ep.entryId) {
          throw new AppManifestError(`${where}.entryId 必填`)
        }
        if (!entryIds.has(ep.entryId)) {
          throw new AppManifestError(
            `${where}.entryId 不存在：${ep.entryId}（应用 entries 里没有这个 id）`,
          )
        }
        // host / slot / entryId 之外的属性（label / icon / uri / 业务自定义…）一律放行，原样透传
      }
    }
  }

  return m as unknown as AppManifest
}

function isAbsoluteUri(s: string): boolean {
  // 绝对 URL：http(s) / data: / file: 等带协议前缀
  // 也接受 /-开头的根相对路径（相对宿主壳同源资源，常用于本地静态示例）
  if (s.startsWith('/')) return true
  return /^[a-z][a-z0-9+.-]*:/i.test(s)
}

// ===== 工具函数 =====

// 国际化名称选取（应用顶层 name）
export function getDisplayName(manifest: AppManifest, lang = 'zh'): string {
  return manifest.nameI18n?.[lang] ?? manifest.name
}

// 拼接 entry.uri + 子路径（features.uri / contributes.uri 用）
export function resolveEntryUri(entry: AppEntry, sub?: string): string {
  if (!sub) return entry.uri
  // 绝对 URL 覆盖
  if (/^[a-z][a-z0-9+.-]*:/i.test(sub)) return sub
  // 查询串 / hash 直接拼到 entry.uri 末尾
  if (sub.startsWith('?') || sub.startsWith('#')) return entry.uri + sub
  // 路径：替换 entry.uri 的 path 部分
  if (sub.startsWith('/')) {
    try {
      const u = new URL(entry.uri)
      return `${u.protocol}//${u.host}${sub}`
    } catch {
      return entry.uri.replace(/\/?$/, '') + sub
    }
  }
  // 相对路径：拼到 entry.uri 末尾
  return entry.uri.replace(/\/?$/, '/') + sub
}

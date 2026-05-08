/**
 * 应用加载器
 * 以 entryId 为粒度启动 / 跟踪窗口：
 *
 * - launch(appId, { entryId, ... }) 必须显式 entryId
 * - 单例 / runningWindows 都按 (appId, entryId) 复合 key 维护
 * - bootInfo 含 appId + entryId + feature? + params?
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../util'
import { WindowManager, AppWindow } from '../core/window'
import { AppRegistry } from './AppRegistry'
import { AppMessageBus } from './AppMessageBus'
import { resolveEntryUri, type AppManifest, type AppEntry } from './AppManifest'

export interface LaunchOptions {
  // 必填：哪个 entry
  entryId: string
  // 直达子功能（该 entry 的 features 里登记过的 id）
  feature?: string
  // 启动参数（透传给应用，URL 查询串）
  params?: Record<string, unknown>
  // 强制创建新窗口（即使是单例）
  forceNew?: boolean
}

export interface AppLoaderEvents {
  appLaunched: { app: AppManifest; entry: AppEntry; window: AppWindow }
  appClosed: { app: AppManifest; entry: AppEntry; window: AppWindow }
  [key: string]: unknown
}

interface BootInfo {
  appId: string
  entryId: string
  feature?: string
  uri?: string
  params?: Record<string, unknown>
}

function makeKey(appId: string, entryId: string): string {
  return `${appId}:${entryId}`
}

export class AppLoader extends EventEmitter<AppLoaderEvents> {
  private static _instance: AppLoader | null = null

  static get instance(): AppLoader {
    if (!AppLoader._instance) AppLoader._instance = new AppLoader()
    return AppLoader._instance
  }

  // key = `appId:entryId`，每个 entry 独立追踪运行实例
  private runningWindows = new Map<string, Set<AppWindow>>()
  // 每个 AppWindow 的启动信息
  private bootInfoMap = new WeakMap<AppWindow, BootInfo>()

  // 启动应用的某个 entry
  launch(appId: string, options: LaunchOptions): AppWindow | null {
    const manifest = AppRegistry.instance.get(appId)
    if (!manifest) {
      console.warn(`[AppLoader] 未找到应用：${appId}`)
      return null
    }
    const entry = manifest.entries.find((e) => e.id === options.entryId)
    if (!entry) {
      console.warn(`[AppLoader] 应用 ${appId} 没有 entry：${options.entryId}`)
      return null
    }

    // 解析 feature
    const feature = options.feature
      ? entry.features?.find((f) => f.id === options.feature)
      : null

    // 构造 URL：entry.uri + feature.uri + params
    let url = entry.uri
    if (feature?.uri) url = resolveEntryUri(entry, feature.uri)
    if (options.params) {
      const sep = url.includes('?') ? '&' : '?'
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(options.params)) {
        qs.set(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
      url = `${url}${sep}${qs.toString()}`
    }

    // tab 模式：脱离 webos
    if (entry.launchMode === 'tab') {
      window.open(url, '_blank', 'noopener,noreferrer')
      return null
    }

    const key = makeKey(appId, entry.id)

    // 已运行 + 传了 feature：不开新窗口，向已存在 iframe 推送 app.navigate
    if (feature && !options.forceNew) {
      const existing = [...(this.runningWindows.get(key) ?? [])]
      if (existing.length > 0) {
        const target = existing[0]!
        target.focus()
        target.sendMessage({
          type: 'webos.event',
          event: 'app.navigate',
          payload: { feature: feature.id, uri: feature.uri, params: options.params },
        })
        return target
      }
    }

    // 单例（per-entry）
    if (entry.singleInstance && !options.forceNew) {
      const existing = this.runningWindows.get(key)?.values().next().value
      if (existing) {
        existing.focus()
        return existing
      }
    }

    // 创建 AppWindow
    const win = new AppWindow({
      appId: manifest.appId,
      entryId: entry.id,
      url,
      title: entry.name,
      icon: entry.icon,
      width: entry.defaultWindow?.width ?? 800,
      height: entry.defaultWindow?.height ?? 500,
      minWidth: entry.defaultWindow?.minWidth,
      minHeight: entry.defaultWindow?.minHeight,
      resizable: entry.defaultWindow?.resizable !== false,
      maximizable: entry.defaultWindow?.maximizable !== false,
    })

    WindowManager.instance.register(win)
    AppMessageBus.instance.registerWindow(win)

    if (!this.runningWindows.has(key)) this.runningWindows.set(key, new Set())
    this.runningWindows.get(key)!.add(win)

    this.bootInfoMap.set(win, {
      appId: manifest.appId,
      entryId: entry.id,
      feature: feature?.id,
      uri: feature?.uri,
      params: options.params,
    })

    win.on('close', () => {
      this.runningWindows.get(key)?.delete(win)
      if (this.runningWindows.get(key)?.size === 0) {
        this.runningWindows.delete(key)
      }
      this.emit('appClosed', { app: manifest, entry, window: win })
    })

    this.emit('appLaunched', { app: manifest, entry, window: win })
    return win
  }

  // 查询某 entry 的运行中窗口
  getRunning(appId: string, entryId: string): AppWindow[] {
    return Array.from(this.runningWindows.get(makeKey(appId, entryId)) ?? [])
  }

  // 查询某应用所有 entries 的所有运行窗口
  getRunningByApp(appId: string): AppWindow[] {
    const out: AppWindow[] = []
    for (const [key, set] of this.runningWindows) {
      if (key.startsWith(`${appId}:`)) out.push(...set)
    }
    return out
  }

  // 启动信息查询
  getBootInfo(win: AppWindow): BootInfo | null {
    return this.bootInfoMap.get(win) ?? null
  }

  // 关闭某 entry 的所有窗口
  async closeEntry(appId: string, entryId: string): Promise<void> {
    for (const w of this.getRunning(appId, entryId)) {
      await w.close()
    }
  }

  // 关闭某应用所有 entry 的所有窗口
  async closeApp(appId: string): Promise<void> {
    for (const w of this.getRunningByApp(appId)) {
      await w.close()
    }
  }

  isRunning(appId: string, entryId?: string): boolean {
    if (entryId) {
      return (this.runningWindows.get(makeKey(appId, entryId))?.size ?? 0) > 0
    }
    return this.getRunningByApp(appId).length > 0
  }

  // 列出所有运行中（按 entry 维度）
  listRunning(): Array<{ appId: string; entryId: string; windows: AppWindow[] }> {
    return [...this.runningWindows.entries()].map(([key, wins]) => {
      const [appId, entryId] = key.split(':') as [string, string]
      return { appId, entryId, windows: [...wins] }
    })
  }
}

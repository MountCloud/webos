/**
 * 应用注册表
 * 聚合 AppSource 的应用清单，提供"应用维度"和"入口维度"两种查询
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../util'
import { CompositeAppSource, type AppSource } from './AppSource'
import type { AppManifest, AppEntry } from './AppManifest'

export interface AppRegistryEvents {
  appsChanged: AppManifest[]
  [key: string]: unknown
}

// 入口维度的元信息：把 entry + 它所属的 app 元信息扁平化
export interface EntryMeta extends AppEntry {
  appId: string
  appName: string
  appIcon?: string
}

export class AppRegistry extends EventEmitter<AppRegistryEvents> {
  private static _instance: AppRegistry | null = null

  static get instance(): AppRegistry {
    if (!AppRegistry._instance) AppRegistry._instance = new AppRegistry()
    return AppRegistry._instance
  }

  private composite = new CompositeAppSource()
  private apps: AppManifest[] = []

  addSource(source: AppSource): void {
    this.composite.add(source)
    if (source.subscribe) {
      source.subscribe(() => void this.refresh())
    }
  }

  async refresh(): Promise<AppManifest[]> {
    this.apps = await this.composite.list()
    this.emit('appsChanged', this.apps)
    return this.apps
  }

  // 应用维度：返回完整 manifest
  // showIn 过滤的语义：该应用至少有一个 entry 的 showIn 包含 target
  list(filter?: {
    showIn?: 'desktop' | 'start-menu' | 'app-store'
    category?: string
  }): AppManifest[] {
    let r = [...this.apps]
    if (filter?.showIn) {
      const target = filter.showIn
      r = r.filter((a) => a.entries.some((e) => !e.showIn || e.showIn.includes(target)))
    }
    if (filter?.category) {
      r = r.filter((a) => a.category === filter.category)
    }
    return r
  }

  // 入口维度：扁平列出所有应用的全部 entries（桌面 / dock / 搜索渲染用）
  // 按 entry.order 升序，order 缺省视为 100
  listEntries(filter?: {
    showIn?: 'desktop' | 'start-menu' | 'app-store'
  }): EntryMeta[] {
    const out: EntryMeta[] = []
    for (const app of this.apps) {
      for (const entry of app.entries) {
        if (filter?.showIn) {
          if (!entry.showIn || !entry.showIn.includes(filter.showIn)) continue
        }
        out.push({
          ...entry,
          appId: app.appId,
          appName: app.name,
          appIcon: app.icon,
        })
      }
    }
    return out.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  }

  get(appId: string): AppManifest | undefined {
    return this.apps.find((a) => a.appId === appId)
  }

  // 取应用的某个 entry
  getEntry(appId: string, entryId: string): AppEntry | undefined {
    return this.get(appId)?.entries.find((e) => e.id === entryId)
  }

  has(appId: string): boolean {
    return this.apps.some((a) => a.appId === appId)
  }

  // 应用是否包含指定 entry
  hasEntry(appId: string, entryId: string): boolean {
    return this.getEntry(appId, entryId) !== undefined
  }
}

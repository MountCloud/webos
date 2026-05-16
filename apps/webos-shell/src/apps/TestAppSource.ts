/**
 * 开发期"测试程序"数据源
 *
 * 仅 dev 模式（pnpm dev）由 main.ts 注册到 AppRegistry。
 * 数据存 localStorage（key: webos:test-apps），开发期重启 / 切环境数据保留。
 *
 * 行为：
 * - list()：从 localStorage 读 [{ id, name, url }] 数组，合成 AppManifest 数组
 * - add / update / remove：写回 localStorage 并触发订阅者刷新（让 AppRegistry 重新拉）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { AppManifest } from './AppManifest'
import type { AppSource } from './AppSource'

const STORAGE_KEY = 'webos:test-apps'

export interface TestAppRecord {
  id: string
  name: string
  url: string
}

/** 默认 SVG 图标（橙色 "T" 标识"测试"） */
const DEFAULT_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="12" fill="#d97706"/>' +
      '<text x="32" y="44" font-size="32" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">T</text>' +
      '</svg>',
  )

export class TestAppSource implements AppSource {
  private subscribers = new Set<(apps: AppManifest[]) => void>()

  async list(): Promise<AppManifest[]> {
    return this.readRecords().map((r) => recordToManifest(r))
  }

  subscribe(handler: (apps: AppManifest[]) => void): () => void {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }

  // ===== CRUD =====

  readRecords(): TestAppRecord[] {
    if (typeof localStorage === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isValidRecord) : []
    } catch {
      return []
    }
  }

  writeRecords(records: TestAppRecord[]): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    } catch {
      // 满 / 禁用 静默
    }
    this.notifySubscribers()
  }

  add(name: string, url: string): TestAppRecord {
    const rec: TestAppRecord = {
      id: 'test-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim() || '测试程序',
      url: url.trim(),
    }
    const list = this.readRecords()
    list.push(rec)
    this.writeRecords(list)
    return rec
  }

  update(id: string, patch: Partial<Pick<TestAppRecord, 'name' | 'url'>>): boolean {
    const list = this.readRecords()
    const i = list.findIndex((r) => r.id === id)
    if (i < 0) return false
    list[i] = {
      ...list[i],
      name: (patch.name ?? list[i].name).trim() || list[i].name,
      url: (patch.url ?? list[i].url).trim(),
    }
    this.writeRecords(list)
    return true
  }

  remove(id: string): boolean {
    const list = this.readRecords()
    const next = list.filter((r) => r.id !== id)
    if (next.length === list.length) return false
    this.writeRecords(next)
    return true
  }

  private async notifySubscribers(): Promise<void> {
    if (this.subscribers.size === 0) return
    const apps = await this.list()
    for (const fn of this.subscribers) {
      try {
        fn(apps)
      } catch (err) {
        console.error('[TestAppSource] subscriber error', err)
      }
    }
  }
}

// ===== helpers =====

function isValidRecord(r: unknown): r is TestAppRecord {
  return (
    !!r &&
    typeof r === 'object' &&
    typeof (r as TestAppRecord).id === 'string' &&
    typeof (r as TestAppRecord).name === 'string' &&
    typeof (r as TestAppRecord).url === 'string'
  )
}

function recordToManifest(r: TestAppRecord): AppManifest {
  return {
    appId: r.id,
    name: r.name,
    version: '0.0.0',
    icon: DEFAULT_ICON,
    description: `测试程序 · ${r.url}`,
    category: 'test',
    tags: ['test', 'dev'],
    entries: [
      {
        id: 'main',
        name: r.name,
        icon: DEFAULT_ICON,
        uri: r.url,
        launchMode: 'window',
        defaultWindow: { width: 1000, height: 700, resizable: true },
        showIn: ['desktop', 'start-menu'],
      },
    ],
  } as AppManifest
}

// 单例
export const testAppSource = new TestAppSource()

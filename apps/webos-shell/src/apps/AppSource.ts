/**
 * 应用清单数据源接口
 * webos 不知道应用从哪来，使用方实现 AppSource 接口
 *
 * 内置实现：
 * - StaticAppSource：静态数组
 * - JsonAppSource：从 URL 加载 apps.json
 * - 使用方可自实现：从 Nacos / Consul / REST 等数据源
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { AppManifest } from './AppManifest'
import { validateManifest } from './AppManifest'

export interface AppSource {
  // 加载应用清单
  list(): Promise<AppManifest[]>

  // 可选：订阅应用清单变更
  subscribe?(handler: (apps: AppManifest[]) => void): () => void
}

// ===== 内置数据源 =====

export class StaticAppSource implements AppSource {
  constructor(private readonly apps: AppManifest[]) {}

  async list(): Promise<AppManifest[]> {
    return this.apps.map(validateManifest)
  }
}

export class JsonAppSource implements AppSource {
  constructor(private readonly url: string) {}

  async list(): Promise<AppManifest[]> {
    const resp = await fetch(this.url, { cache: 'no-cache' })
    if (!resp.ok) {
      throw new Error(`[JsonAppSource] 加载失败：${resp.status} ${resp.statusText}`)
    }
    const data = await resp.json()
    if (!Array.isArray(data)) {
      throw new Error('[JsonAppSource] 应用清单必须是数组')
    }
    return data.map(validateManifest)
  }
}

// 多源合并（按 appId 去重，后注册的覆盖前面）
export class CompositeAppSource implements AppSource {
  private sources: AppSource[] = []

  add(source: AppSource): void {
    this.sources.push(source)
  }

  async list(): Promise<AppManifest[]> {
    const allLists = await Promise.all(this.sources.map((s) => s.list()))
    const merged = new Map<string, AppManifest>()
    for (const list of allLists) {
      for (const app of list) {
        merged.set(app.appId, app)
      }
    }
    return [...merged.values()]
  }
}

/**
 * 全局搜索（Cmd/Ctrl + K）
 * 跨应用 / 设置 / 命令的快速搜索面板
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl, removeEl } from '../helpers/dom'
import { AppRegistry, type EntryMeta } from '../apps/AppRegistry'
import { AppLoader } from '../apps/AppLoader'
import { t } from '../i18n'
import type { AppFeature } from '../apps/AppManifest'

interface SearchResult {
  type: 'app' | 'feature' | 'command'
  id: string
  title: string
  subtitle?: string
  icon?: string
  // 标识"会新开浏览器标签"
  external?: boolean
  action: () => void
}

export class GlobalSearch extends UIElement {
  private static _instance: GlobalSearch | null = null

  static get instance(): GlobalSearch {
    if (!GlobalSearch._instance) GlobalSearch._instance = new GlobalSearch()
    return GlobalSearch._instance
  }

  private _isOpen = false
  private _input: HTMLInputElement | null = null
  private _list: HTMLElement | null = null
  private _selectedIndex = 0
  private _currentResults: SearchResult[] = []
  // 当前结果项对应的 DOM 节点（不含分组标题），与 _currentResults 一一对应
  private _itemNodes: HTMLElement[] = []
  private _commands: SearchResult[] = []
  private _removeTimer: ReturnType<typeof setTimeout> | null = null
  private _shortcutInstalled = false
  private _shortcutHandler: ((e: KeyboardEvent) => void) | null = null

  constructor() {
    super({ id: 'global-search' })
  }

  // 注册命令（系统级命令、来自外部的命令）
  registerCommand(cmd: SearchResult): void {
    this._commands.push(cmd)
  }

  installShortcut(): void {
    if (this._shortcutInstalled) return
    this._shortcutInstalled = true
    this._shortcutHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        this.toggle()
      }
    }
    document.addEventListener('keydown', this._shortcutHandler)
  }

  uninstallShortcut(): void {
    if (!this._shortcutInstalled || !this._shortcutHandler) return
    document.removeEventListener('keydown', this._shortcutHandler)
    this._shortcutInstalled = false
    this._shortcutHandler = null
  }

  protected render(): HTMLElement {
    const overlay = createEl('div', { className: 'webos-global-search-overlay' })
    const panel = createEl('div', { className: 'webos-global-search' })

    const inputWrap = createEl('div', { className: 'webos-global-search-input-wrap' })
    inputWrap.appendChild(createEl('span', { className: 'webos-global-search-icon', text: '🔍' }))
    this._input = createEl('input', {
      className: 'webos-global-search-input',
      attrs: {
        type: 'text',
        placeholder: t('search_placeholder'),
        autocomplete: 'off',
      },
    })
    this._input.addEventListener('input', () => this._search())
    this._input.addEventListener('keydown', (e) => this._onKey(e))
    inputWrap.appendChild(this._input)
    panel.appendChild(inputWrap)

    this._list = createEl('div', { className: 'webos-global-search-list' })
    panel.appendChild(this._list)

    overlay.appendChild(panel)

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) this.close()
    })

    return overlay
  }

  open(): void {
    if (this._isOpen) return
    this._isOpen = true
    if (this._removeTimer) {
      clearTimeout(this._removeTimer)
      this._removeTimer = null
    }
    document.body.appendChild(this.el)
    requestAnimationFrame(() => {
      this.el.classList.add('webos-global-search-overlay--shown')
      this._input?.focus()
    })
    this._search()
  }

  close(): void {
    if (!this._isOpen) return
    this._isOpen = false
    this.el.classList.remove('webos-global-search-overlay--shown')
    if (this._removeTimer) clearTimeout(this._removeTimer)
    this._removeTimer = setTimeout(() => {
      this._removeTimer = null
      if (!this._isOpen) removeEl(this.el)
    }, 150)
    if (this._input) this._input.value = ''
    this._currentResults = []
    this._selectedIndex = 0
  }

  toggle(): void {
    if (this._isOpen) this.close()
    else this.open()
  }

  private _search(): void {
    const query = this._input?.value.trim().toLowerCase() ?? ''
    const entries = AppRegistry.instance.listEntries()

    const apps_: SearchResult[] = []
    const features: SearchResult[] = []
    const commands: SearchResult[] = []

    // 入口 + 入口下的子功能
    for (const entry of entries) {
      const entryMatched =
        !query ||
        entry.name.toLowerCase().includes(query) ||
        entry.appId.toLowerCase().includes(query) ||
        entry.id.toLowerCase().includes(query)
      if (entryMatched) apps_.push(this._entryToResult(entry))

      if (entry.features) {
        for (const f of entry.features) {
          const matched =
            !query ||
            f.name.toLowerCase().includes(query) ||
            f.description?.toLowerCase().includes(query) ||
            f.keywords?.some((k) => k.toLowerCase().includes(query)) ||
            (entryMatched && query.length > 0)
          if (matched) features.push(this._featureToResult(entry, f))
        }
      }
    }

    // 命令
    for (const cmd of this._commands) {
      if (
        !query ||
        cmd.title.toLowerCase().includes(query) ||
        cmd.subtitle?.toLowerCase().includes(query)
      ) {
        commands.push(cmd)
      }
    }

    // 顺序：入口 → 子功能 → 命令；总数 24 上限
    this._currentResults = [...apps_, ...features, ...commands].slice(0, 24)
    this._selectedIndex = 0
    this._renderList()
  }

  private _entryToResult(entry: EntryMeta): SearchResult {
    const subtitle =
      entry.description ?? (entry.appName === entry.name ? entry.appId : entry.appName)
    return {
      type: 'app',
      id: `entry-${entry.appId}-${entry.id}`,
      title: entry.name,
      subtitle,
      icon: entry.icon,
      external: entry.launchMode === 'tab',
      action: () => {
        AppLoader.instance.launch(entry.appId, { entryId: entry.id })
        this.close()
      },
    }
  }

  private _featureToResult(entry: EntryMeta, feature: AppFeature): SearchResult {
    const subtitleParts = [entry.name]
    if (feature.category) subtitleParts.unshift(feature.category)
    return {
      type: 'feature',
      id: `feature-${entry.appId}-${entry.id}-${feature.id}`,
      title: feature.name,
      subtitle: feature.description ?? subtitleParts.join(' · '),
      icon: feature.icon ?? entry.icon,
      external: entry.launchMode === 'tab',
      action: () => {
        AppLoader.instance.launch(entry.appId, { entryId: entry.id, feature: feature.id })
        this.close()
      },
    }
  }

  private _renderList(): void {
    if (!this._list) return
    this._list.innerHTML = ''
    this._itemNodes = []
    if (this._currentResults.length === 0) {
      this._list.appendChild(
        createEl('div', { className: 'webos-global-search-empty', text: t('empty') }),
      )
      return
    }

    let lastType: SearchResult['type'] | null = null
    const groupTitle: Record<SearchResult['type'], string> = {
      app: '应用',
      feature: '子功能',
      command: '命令',
    }

    this._currentResults.forEach((r, i) => {
      // 分组小标题
      if (r.type !== lastType) {
        this._list!.appendChild(
          createEl('div', {
            className: 'webos-global-search-group',
            text: groupTitle[r.type],
          }),
        )
        lastType = r.type
      }

      const item = createEl('div', {
        className: `webos-global-search-item ${i === this._selectedIndex ? 'webos-global-search-item--active' : ''}`,
      })
      if (r.icon) {
        item.appendChild(
          createEl('img', {
            className: 'webos-global-search-item-icon',
            attrs: { src: r.icon, alt: '', draggable: 'false' },
          }),
        )
      }
      const text = createEl('div', { className: 'webos-global-search-item-text' })
      text.appendChild(createEl('div', { className: 'webos-global-search-item-title', text: r.title }))
      if (r.subtitle) {
        text.appendChild(
          createEl('div', { className: 'webos-global-search-item-subtitle', text: r.subtitle }),
        )
      }
      item.appendChild(text)
      // 新标签外链角标
      if (r.external) {
        const ext = createEl('span', { className: 'webos-global-search-item-external' })
        ext.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M4 8l4-4M5 4h3v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
        item.appendChild(ext)
      }
      item.addEventListener('mousemove', () => {
        this._selectedIndex = i
        this._updateActive()
      })
      item.addEventListener('click', () => r.action())
      this._list!.appendChild(item)
      this._itemNodes.push(item)
    })
  }

  // 用 _itemNodes（仅 item 节点）匹配 _selectedIndex（结果索引），
  // 避免分组标题混在 list.children 里偏移索引导致"鼠标在 A 高亮在 B"
  private _updateActive(): void {
    for (let i = 0; i < this._itemNodes.length; i++) {
      this._itemNodes[i]!.classList.toggle(
        'webos-global-search-item--active',
        i === this._selectedIndex,
      )
    }
    // 选中项滚动到可视区
    this._itemNodes[this._selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      this.close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      this._selectedIndex = (this._selectedIndex + 1) % Math.max(1, this._currentResults.length)
      this._updateActive()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this._selectedIndex =
        (this._selectedIndex - 1 + this._currentResults.length) %
        Math.max(1, this._currentResults.length)
      this._updateActive()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      this._currentResults[this._selectedIndex]?.action()
    }
  }
}

/**
 * 主菜单 / 应用启动器
 * Ubuntu / Synology DSM 风格全屏覆盖：顶部搜索（仅按名称筛选）+ 居中应用网格
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl, removeEl } from '../helpers/dom'
import { AppRegistry, type EntryMeta } from '../apps/AppRegistry'
import { AppLoader } from '../apps/AppLoader'
import { t } from '../i18n'

export interface StartMenuEvents {
  open: void
  close: void
  [key: string]: unknown
}

export class StartMenu extends UIElement<StartMenuEvents> {
  private _isOpen = false
  private _searchInput: HTMLInputElement | null = null
  private _grid: HTMLElement | null = null
  private _removeTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super({ id: 'start-menu' })
  }

  protected render(): HTMLElement {
    const overlay = createEl('div', { className: 'webos-launcher-overlay' })

    // 搜索框（顶部居中）
    const searchWrap = createEl('div', { className: 'webos-launcher-search-wrap' })
    const iconWrap = createEl('div', { className: 'webos-launcher-search-icon' })
    iconWrap.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    searchWrap.appendChild(iconWrap)
    this._searchInput = createEl('input', {
      className: 'webos-launcher-search-input',
      attrs: {
        type: 'text',
        placeholder: '按应用名称筛选',
        autocomplete: 'off',
        spellcheck: 'false',
      },
    })
    this.addDomListener(this._searchInput, 'input', () => this._renderApps())
    this.addDomListener(this._searchInput, 'keydown', (e) => {
      const ke = e as KeyboardEvent
      if (ke.key === 'Escape') {
        this.close()
      } else if (ke.key === 'Enter') {
        // 回车启动第一个匹配
        const firstItem = this._grid?.querySelector<HTMLElement>('.webos-launcher-item')
        firstItem?.click()
      }
    })
    searchWrap.appendChild(this._searchInput)
    overlay.appendChild(searchWrap)

    // 应用网格
    this._grid = createEl('div', { className: 'webos-launcher-grid' })
    overlay.appendChild(this._grid)

    // 点击空白处关闭：grid 用 flex:1 占满了 searchWrap 下方全部空间，
    // 不能只比 e.target === overlay；改成"目标不在搜索框 / 应用项 内部 → 关"
    this.addDomListener(overlay, 'mousedown', (e) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.webos-launcher-search-wrap, .webos-launcher-item')) return
      this.close()
    })

    return overlay
  }

  private _renderApps(): void {
    if (!this._grid) return
    const query = this._searchInput?.value.trim().toLowerCase() ?? ''
    // 一个 entry 一个图标；按 entry.name 筛选
    const entries = AppRegistry.instance
      .listEntries({ showIn: 'start-menu' })
      .filter((e) => (query ? e.name.toLowerCase().includes(query) : true))

    this._grid.innerHTML = ''
    if (entries.length === 0) {
      this._grid.appendChild(
        createEl('div', { className: 'webos-launcher-empty', text: t('empty') }),
      )
      return
    }
    for (const entry of entries) {
      this._grid.appendChild(this._createTile(entry))
    }
  }

  private _createTile(entry: EntryMeta): HTMLElement {
    const tile = createEl('div', {
      className: 'webos-launcher-item',
      attrs: { title: entry.name, tabindex: '0' },
    })
    const isTab = entry.launchMode === 'tab'

    const iconWrap = createEl('div', { className: 'webos-launcher-item-icon-wrap' })
    iconWrap.appendChild(
      createEl('img', {
        className: 'webos-launcher-item-icon',
        attrs: { src: entry.icon, alt: '', draggable: 'false' },
      }),
    )
    if (isTab) {
      const ext = createEl('span', { className: 'webos-launcher-item-external' })
      ext.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M4 8l4-4M5 4h3v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
      iconWrap.appendChild(ext)
    }
    tile.appendChild(iconWrap)
    tile.appendChild(
      createEl('div', { className: 'webos-launcher-item-label', text: entry.name }),
    )

    const launch = (): void => {
      AppLoader.instance.launch(entry.appId, { entryId: entry.id })
      this.close()
    }

    this.addDomListener(tile, 'click', launch)
    this.addDomListener(tile, 'keydown', (e) => {
      const ke = e as KeyboardEvent
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault()
        launch()
      }
    })

    return tile
  }

  // ===== 公开 API =====（保留 anchor 参数兼容老调用，全屏 launcher 不需要锚点）
  open(_anchor?: { x: number; y: number }): void {
    if (this._isOpen) return
    this._isOpen = true
    if (this._removeTimer) {
      clearTimeout(this._removeTimer)
      this._removeTimer = null
    }
    document.body.appendChild(this.el)
    requestAnimationFrame(() => {
      this.el.classList.add('webos-launcher-overlay--shown')
      this._searchInput?.focus()
    })
    setTimeout(() => {
      document.addEventListener('keydown', this._onKeyDown, true)
    }, 0)
    void this._refreshApps()
    this.emit('open', undefined)
  }

  close(): void {
    if (!this._isOpen) return
    this._isOpen = false
    document.removeEventListener('keydown', this._onKeyDown, true)
    this.el.classList.remove('webos-launcher-overlay--shown')
    if (this._removeTimer) clearTimeout(this._removeTimer)
    this._removeTimer = setTimeout(() => {
      this._removeTimer = null
      if (!this._isOpen) removeEl(this.el)
    }, 180)
    if (this._searchInput) this._searchInput.value = ''
    this.emit('close', undefined)
  }

  toggle(anchor?: { x: number; y: number }): void {
    if (this._isOpen) this.close()
    else this.open(anchor)
  }

  private async _refreshApps(): Promise<void> {
    if (AppRegistry.instance.listEntries().length === 0) {
      await AppRegistry.instance.refresh().catch(() => {})
    }
    this._renderApps()
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }
}

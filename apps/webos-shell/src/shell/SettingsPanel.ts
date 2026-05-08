/**
 * 系统设置下拉面板
 * 占位实现：主题切换 / 语言切换 / 关于
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { UIElement } from '../core/UIElement'
import { createEl, removeEl } from '../helpers/dom'
import { ThemeRegistry, type ThemeMode } from '../theme'
import { i18n, t } from '../i18n'
import { persist } from '../helpers'

export type IconSize = 'small' | 'medium' | 'large'

const ICON_SIZE_PX: Record<IconSize, number> = {
  small: 72,
  medium: 96,
  large: 120,
}

const ICON_SIZE_KEY = 'desktop.iconSize'

// 把图标大小写到 :root，整个桌面立即跟着变
export function applyIconSize(size: IconSize): void {
  const px = ICON_SIZE_PX[size]
  document.documentElement.style.setProperty('--webos-icon-size', `${px}px`)
}

// 读持久化的尺寸；启动时调一次
export function loadAndApplyIconSize(): IconSize {
  const saved = persist.getJSON<IconSize>(ICON_SIZE_KEY, 'medium')
  applyIconSize(saved)
  return saved
}

export class SettingsPanel extends UIElement {
  private static _instance: SettingsPanel | null = null

  static get instance(): SettingsPanel {
    if (!SettingsPanel._instance) SettingsPanel._instance = new SettingsPanel()
    return SettingsPanel._instance
  }

  private _isOpen = false
  private _removeTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super({ id: 'settings-panel' })
  }

  protected render(): HTMLElement {
    const el = createEl('div', { className: 'webos-settings-panel' })

    // 头部
    const head = createEl('div', { className: 'webos-settings-panel-head' })
    head.appendChild(createEl('span', { text: '系统设置' }))
    el.appendChild(head)

    const body = createEl('div', { className: 'webos-settings-panel-body' })

    // ===== 主题 =====
    body.appendChild(this._sectionLabel('主题'))
    const themeGroup = createEl('div', { className: 'webos-settings-segment' })
    const themes: Array<{ id: ThemeMode; label: string }> = [
      { id: 'light', label: '浅色' },
      { id: 'dark', label: '深色' },
      { id: 'auto', label: '跟随系统' },
    ]
    for (const m of themes) {
      const btn = createEl('button', {
        className: 'webos-settings-segment-btn',
        attrs: { type: 'button', 'data-mode': m.id },
        text: m.label,
      })
      this.addDomListener(btn, 'click', () => {
        ThemeRegistry.instance.mode = m.id
        this._refreshThemeButtons(themeGroup)
      })
      themeGroup.appendChild(btn)
    }
    body.appendChild(themeGroup)
    // 初次渲染时反射当前选中
    queueMicrotask(() => this._refreshThemeButtons(themeGroup))
    // 主题变更时同步
    this.addDisposer(
      ThemeRegistry.instance.on('modeChanged', () => this._refreshThemeButtons(themeGroup)),
    )

    // ===== 桌面图标大小 =====
    body.appendChild(this._sectionLabel('桌面图标'))
    const iconGroup = createEl('div', { className: 'webos-settings-segment' })
    const sizes: Array<{ id: IconSize; label: string }> = [
      { id: 'small', label: '小' },
      { id: 'medium', label: '中' },
      { id: 'large', label: '大' },
    ]
    const currentSize = persist.getJSON<IconSize>(ICON_SIZE_KEY, 'medium')
    for (const s of sizes) {
      const btn = createEl('button', {
        className: 'webos-settings-segment-btn',
        attrs: { type: 'button', 'data-size': s.id },
        text: s.label,
      })
      if (s.id === currentSize) btn.classList.add('webos-settings-segment-btn--active')
      this.addDomListener(btn, 'click', () => {
        applyIconSize(s.id)
        persist.setJSON(ICON_SIZE_KEY, s.id)
        for (const b of iconGroup.querySelectorAll<HTMLButtonElement>('[data-size]')) {
          b.classList.toggle('webos-settings-segment-btn--active', b.dataset.size === s.id)
        }
      })
      iconGroup.appendChild(btn)
    }
    body.appendChild(iconGroup)

    // ===== 语言 =====
    body.appendChild(this._sectionLabel('语言'))
    const langGroup = createEl('div', { className: 'webos-settings-segment' })
    const langs: Array<{ id: 'zh' | 'en'; label: string }> = [
      { id: 'zh', label: '中文' },
      { id: 'en', label: 'English' },
    ]
    for (const l of langs) {
      const btn = createEl('button', {
        className: 'webos-settings-segment-btn',
        attrs: { type: 'button', 'data-lang': l.id },
        text: l.label,
      })
      if (i18n.locale === l.id) btn.classList.add('webos-settings-segment-btn--active')
      this.addDomListener(btn, 'click', () => {
        if (i18n.locale === l.id) return
        i18n.locale = l.id
        // i18n 切换后大量字符串需要重渲染：刷新 + 关闭面板
        this.close()
        location.reload()
      })
      langGroup.appendChild(btn)
    }
    body.appendChild(langGroup)

    // ===== 关于 =====
    body.appendChild(this._sectionLabel('关于'))
    const about = createEl('div', { className: 'webos-settings-about' })
    about.innerHTML =
      '<div><strong>webos</strong> v1.0.0</div>' +
      '<div>通用 Web 桌面平台</div>' +
      '<div style="opacity:0.7">作者：MountCloud · MIT License</div>'
    body.appendChild(about)

    el.appendChild(body)
    return el
  }

  private _sectionLabel(text: string): HTMLElement {
    return createEl('div', { className: 'webos-settings-section-label', text })
  }

  private _refreshThemeButtons(group: HTMLElement): void {
    const cur = ThemeRegistry.instance.mode
    for (const btn of group.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      const m = btn.dataset.mode as ThemeMode
      btn.classList.toggle('webos-settings-segment-btn--active', m === cur)
    }
  }

  open(anchor: { x: number; y: number }): void {
    if (this._isOpen) return
    this._isOpen = true
    if (this._removeTimer) {
      clearTimeout(this._removeTimer)
      this._removeTimer = null
    }
    document.body.appendChild(this.el)
    requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect()
      let left = anchor.x - rect.width
      const top = anchor.y
      if (left < 8) left = 8
      this.el.style.left = `${left}px`
      this.el.style.top = `${top}px`
      this.el.classList.add('webos-settings-panel--shown')
    })
    setTimeout(() => {
      document.addEventListener('mousedown', this._onOutsideClick, true)
      document.addEventListener('keydown', this._onKeyDown, true)
    }, 0)
  }

  close(): void {
    if (!this._isOpen) return
    this._isOpen = false
    document.removeEventListener('mousedown', this._onOutsideClick, true)
    document.removeEventListener('keydown', this._onKeyDown, true)
    this.el.classList.remove('webos-settings-panel--shown')
    if (this._removeTimer) clearTimeout(this._removeTimer)
    this._removeTimer = setTimeout(() => {
      this._removeTimer = null
      if (!this._isOpen) removeEl(this.el)
    }, 150)
  }

  toggle(anchor: { x: number; y: number }): void {
    if (this._isOpen) this.close()
    else this.open(anchor)
  }

  private _onOutsideClick = (e: MouseEvent): void => {
    if (!this._isOpen) return
    if (!this.el.contains(e.target as Node)) this.close()
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }
}

void t // 引用一下避免 unused 报错（i18n 在 location.reload 之后才生效）

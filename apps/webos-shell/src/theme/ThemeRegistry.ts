/**
 * 主题注册表
 * 管理可用主题，支持切换 / 跟随系统
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../util'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'webos.theme'

export interface ThemeRegistryEvents {
  modeChanged: ThemeMode
  effectiveThemeChanged: 'light' | 'dark'
  [key: string]: unknown
}

export class ThemeRegistry extends EventEmitter<ThemeRegistryEvents> {
  private static _instance: ThemeRegistry | null = null

  static get instance(): ThemeRegistry {
    if (!ThemeRegistry._instance) ThemeRegistry._instance = new ThemeRegistry()
    return ThemeRegistry._instance
  }

  private _mode: ThemeMode = 'light'
  private _mediaQuery: MediaQueryList | null = null

  init(): void {
    // 读取持久化偏好
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      this._mode = saved
    }
    this._apply()

    // 监听系统主题变化
    if (typeof window.matchMedia === 'function') {
      this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      this._mediaQuery.addEventListener('change', () => {
        if (this._mode === 'auto') this._apply()
      })
    }
  }

  get mode(): ThemeMode {
    return this._mode
  }

  set mode(m: ThemeMode) {
    if (m === this._mode) return
    this._mode = m
    localStorage.setItem(STORAGE_KEY, m)
    this.emit('modeChanged', m)
    this._apply()
  }

  // 当前实际渲染的主题（解析 auto）
  get effective(): 'light' | 'dark' {
    if (this._mode === 'auto') {
      return this._mediaQuery?.matches ? 'dark' : 'light'
    }
    return this._mode
  }

  toggle(): void {
    this.mode = this.effective === 'dark' ? 'light' : 'dark'
  }

  private _apply(): void {
    const eff = this.effective
    document.documentElement.setAttribute('data-webos-theme', eff)
    this.emit('effectiveThemeChanged', eff)
  }
}

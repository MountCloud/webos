/**
 * 国际化
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { EventEmitter } from '../util'
import { zh, type I18nMessages } from './zh'
import { en } from './en'

const STORAGE_KEY = 'webos.locale'

export type Locale = 'zh' | 'en'

const messages: Record<Locale, I18nMessages> = { zh, en }

export interface I18nEvents {
  localeChanged: Locale
  [key: string]: unknown
}

class I18n extends EventEmitter<I18nEvents> {
  private _locale: Locale = 'zh'

  init(): void {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved === 'zh' || saved === 'en') {
      this._locale = saved
    } else {
      // 浏览器语言自动检测
      const lang = navigator.language.toLowerCase()
      this._locale = lang.startsWith('en') ? 'en' : 'zh'
    }
    document.documentElement.lang = this._locale === 'zh' ? 'zh-CN' : 'en'
  }

  get locale(): Locale {
    return this._locale
  }

  set locale(l: Locale) {
    if (l === this._locale) return
    this._locale = l
    localStorage.setItem(STORAGE_KEY, l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    this.emit('localeChanged', l)
  }

  t(key: keyof I18nMessages): string {
    return messages[this._locale][key] ?? messages.zh[key] ?? String(key)
  }
}

export const i18n = new I18n()
export const t = i18n.t.bind(i18n)

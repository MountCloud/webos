/**
 * useWebosTheme
 * 自动跟随 webos 桌面壳的主题切换；脱离 webos 时 fallback 到 prefers-color-scheme
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { useEffect, useMemo, useState } from 'react'
import type { Theme } from '@mui/material/styles'
import { createWebosTheme, type CreateWebosThemeOptions } from './theme'
import type { ThemeMode } from './tokens'

interface WebosLike {
  theme?: {
    current: () => Promise<ThemeMode>
    on: (event: 'change', handler: (theme: ThemeMode) => void) => () => void
  }
}

function getGlobalWebos(): WebosLike | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { Webos?: WebosLike }
  return w.Webos ?? null
}

export interface UseWebosThemeOptions extends Omit<CreateWebosThemeOptions, 'mode'> {
  // 强制使用某个模式（不跟随）；不传则自动检测
  forceMode?: ThemeMode
}

export function useWebosTheme(options: UseWebosThemeOptions = {}): Theme {
  const [mode, setMode] = useState<ThemeMode>(() => detectInitialMode())

  useEffect(() => {
    if (options.forceMode) {
      setMode(options.forceMode)
      return
    }

    // 优先：webos SDK 在场就听 SDK
    const webos = getGlobalWebos()
    if (webos?.theme) {
      let cancelled = false
      webos.theme.current().then((t) => {
        if (!cancelled) setMode(t)
      })
      const off = webos.theme.on('change', (t) => setMode(t))
      return () => {
        cancelled = true
        off()
      }
    }

    // fallback：跟系统
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      setMode(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent): void => {
        setMode(e.matches ? 'dark' : 'light')
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    return
  }, [options.forceMode])

  return useMemo(
    () => createWebosTheme({ mode, overrides: options.overrides }),
    [mode, options.overrides],
  )
}

function detectInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  // 同步检测：先看 prefers-color-scheme（webos SDK 是异步的，等 useEffect 才知道）
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

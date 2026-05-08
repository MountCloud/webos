/**
 * Webos.theme.*
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'
import type { Theme } from '../core/types'

export function createTheme(rpc: RpcClient) {
  const handlers = new Set<(theme: Theme) => void>()
  let installed = false

  function ensureInstalled(): void {
    if (installed) return
    installed = true
    rpc.on('theme.changed', (payload) => {
      const theme = (payload as { theme?: Theme })?.theme
      if (theme) {
        for (const fn of handlers) fn(theme)
      }
    })
  }

  return {
    async current(): Promise<Theme> {
      return rpc.call<Theme>('theme', 'current')
    },
    async set(name: Theme | 'auto'): Promise<void> {
      await rpc.call('theme', 'set', { name })
    },
    on(event: 'change', handler: (theme: Theme) => void): () => void {
      ensureInstalled()
      if (event !== 'change') return () => {}
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    async getTokens(): Promise<Record<string, string>> {
      return rpc.call('theme', 'getTokens')
    },
  }
}

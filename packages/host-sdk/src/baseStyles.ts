/**
 * webos 应用基础样式自动注入
 * SDK 在 iframe 里跑时，往 iframe 自己的 document.head 插一段 <style>，
 * 让应用内的滚动条等基础元素跟 webos 桌面壳风格保持一致；并跟随主题切换。
 *
 * 顶级页面（非 iframe）不注入，避免污染独立测试环境。
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from './core/RpcClient'

const STYLE_ID = 'webos-app-base-styles'
const THEME_ATTR = 'data-webos-theme'

const STYLE_TEXT = `
/* 滚动条（亮色） */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.20) transparent;
}
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.20);
  border-radius: 5px;
  background-clip: padding-box;
  border: 2px solid transparent;
  transition: background 150ms ease;
}
*::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.35);
}
*::-webkit-scrollbar-corner {
  background: transparent;
}

/* 深色 */
html[data-webos-theme="dark"] {
  scrollbar-color: rgba(255, 255, 255, 0.20) transparent;
}
html[data-webos-theme="dark"] *::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.20);
}
html[data-webos-theme="dark"] *::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}
`.trim()

export function installBaseStyles(rpc: RpcClient): void {
  // 仅在 iframe 模式（即作为 webos 应用运行）时注入
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.parent === window) return

  const inject = (): void => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLE_TEXT
    document.head.appendChild(style)

    // 同步当前主题到 <html data-webos-theme>，让深色变体生效
    rpc
      .call<'light' | 'dark'>('theme', 'current')
      .then((theme) => {
        if (theme === 'light' || theme === 'dark') {
          document.documentElement.setAttribute(THEME_ATTR, theme)
        }
      })
      .catch(() => {
        /* 独立运行 / RPC 不通时静默 */
      })

    // 跟随宿主主题切换
    rpc.on('theme.changed', (payload) => {
      const theme = (payload as { theme?: string } | null)?.theme
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute(THEME_ATTR, theme)
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true })
  } else {
    inject()
  }
}

/**
 * 应用窗口
 * 承载 iframe 应用的窗口子类
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { Window } from './Window'
import { createEl } from '../../helpers/dom'
import type { WindowOptions } from './types'

export interface AppWindowOptions extends WindowOptions {
  appId: string
  // 必填：哪个 entry 启动了它
  entryId: string
  url: string
  appParams?: Record<string, unknown>
}

export class AppWindow extends Window {
  readonly appId: string
  readonly entryId: string
  readonly appUrl: string
  private _iframe: HTMLIFrameElement | null = null

  constructor(options: AppWindowOptions) {
    super({
      ...options,
      body: (container) => {
        const iframe = createEl('iframe', {
          className: 'webos-app-iframe',
          attrs: {
            src: options.url,
            frameborder: '0',
            allow: 'clipboard-read; clipboard-write; fullscreen',
          },
          style: {
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          },
        })
        container.appendChild(iframe)
        // 缓存引用（注意：此时 super 还在构造，不能访问 this）
        ;(container as HTMLElement & { _iframe: HTMLIFrameElement })._iframe = iframe
      },
    })
    this.appId = options.appId
    this.entryId = options.entryId
    this.appUrl = options.url

    const bodyWithIframe = this.body as HTMLElement & { _iframe?: HTMLIFrameElement }
    if (bodyWithIframe._iframe) {
      this._iframe = bodyWithIframe._iframe
    }

    // 标记 data attrs 便于 CSS / 查询
    this.el.dataset.appId = this.appId
    this.el.dataset.entryId = this.entryId
  }

  get iframe(): HTMLIFrameElement | null {
    return this._iframe
  }

  // 向 iframe 内应用 postMessage
  sendMessage(message: unknown, targetOrigin = '*'): void {
    this._iframe?.contentWindow?.postMessage(message, targetOrigin)
  }

  // 重新加载应用
  reload(): void {
    if (this._iframe) {
      this._iframe.src = this.appUrl
    }
  }
}

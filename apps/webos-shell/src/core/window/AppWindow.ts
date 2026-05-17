/**
 * 应用窗口
 * 承载 iframe 应用的窗口子类
 *
 * iframe 加载完成前盖一层 spinner 遮罩（避免一开始白屏），跟 DialogWindow 共用
 * 同一套 .webos-iframe-loading-* CSS。DialogWindow 继承自本类，自动获得遮罩。
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

/** iframe 'load' 不一定可靠（跨源 / 长连接），多少秒后兜底淡出遮罩 */
const LOADING_FALLBACK_MS = 8000
/** 遮罩淡出动画时长，跟 CSS 的 transition 对齐 */
const LOADING_FADE_MS = 220

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

    // 首次加载罩遮罩——子类（DialogWindow）继承时也会得到，不需重复挂
    this._renderLoadingMask()
  }

  get iframe(): HTMLIFrameElement | null {
    return this._iframe
  }

  // 向 iframe 内应用 postMessage
  sendMessage(message: unknown, targetOrigin = '*'): void {
    this._iframe?.contentWindow?.postMessage(message, targetOrigin)
  }

  // 重新加载应用 —— 顺带再罩一次遮罩
  reload(): void {
    if (this._iframe) {
      this._iframe.src = this.appUrl
      this._renderLoadingMask()
    }
  }

  /**
   * 给当前 iframe 罩一层 spinner 遮罩。挂在 {@link Window#body} 上，CSS 绝对定位覆盖 iframe。
   *
   * 触发淡出的条件（任一）：
   * <ul>
   *   <li>{@code iframe 'load'} 事件 —— 正常路径</li>
   *   <li>{@code iframe 'error'} 事件 —— 切到错误样式，文案变红</li>
   *   <li>{@code LOADING_FALLBACK_MS} 后兜底——跨源 iframe 的 load 事件可能不可靠</li>
   * </ul>
   *
   * 子类可以 override 替换 spinner 样式（{@link DialogWindow} 现在没必要——视觉一致）。
   */
  protected _renderLoadingMask(): void {
    if (!this._iframe) return

    // 已经在罩的话先清掉，避免 reload() 出现叠加
    const existing = this.body.querySelector('.webos-iframe-loading')
    if (existing) existing.remove()

    const mask = createEl('div', { className: 'webos-iframe-loading' })
    // 用纯 CSS border 转圈代替 SVG —— SVG 旋转的层提升在 webkit/blink 上不保证，
    // 主线程一卡（iframe 加载 / HMR）会漏帧。div + border-top 是业界最稳的纯 GPU 旋转。
    mask.innerHTML =
      '<div class="webos-iframe-loading-spinner" aria-hidden="true"></div>' +
      '<div class="webos-iframe-loading-text">加载中…</div>'
    this.body.appendChild(mask)

    const iframe = this._iframe
    const hide = (): void => {
      mask.classList.add('webos-iframe-loading--hide')
      setTimeout(() => mask.remove(), LOADING_FADE_MS)
    }
    const showError = (): void => {
      const text = mask.querySelector('.webos-iframe-loading-text')
      if (text) text.textContent = '页面加载失败'
      mask.classList.add('webos-iframe-loading--error')
      // 失败时不再自动淡出，留着提示用户
    }
    iframe.addEventListener('load', hide, { once: true })
    iframe.addEventListener('error', showError, { once: true })
    // 兜底：长时间没 load 也淡出（跨源 iframe 的 'load' 可能永远不触发）
    setTimeout(() => {
      if (mask.isConnected && !mask.classList.contains('webos-iframe-loading--hide')) {
        hide()
      }
    }, LOADING_FALLBACK_MS)
  }
}

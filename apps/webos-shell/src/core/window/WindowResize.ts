/**
 * 窗口缩放
 * 基于 interact.js 实现，支持 4 边 + 4 角
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import interact from 'interactjs'
import type { Window } from './Window'

export class WindowResize {
  private interactable: ReturnType<typeof interact> | null = null

  constructor(private readonly win: Window) {}

  attach(): void {
    if (this.interactable) return

    // 8 个透明 resize handle div 由 Window.ts 在 render() 时挂上去（z-index 高于 iframe）
    // 用 CSS 选择器把每条 edge 绑到对应 handle —— 角落 handle 同时匹配 2 条 edge
    // 这样跨 origin iframe 的窗口也能从边缘触发 resize（之前 iframe 吞鼠标事件，
    // 只能在窗口最外 1px 边框处触发，所以"得很精确"）
    this.interactable = interact(this.win.el).resizable({
      edges: {
        top: '.webos-window-resize-handle--n, .webos-window-resize-handle--nw, .webos-window-resize-handle--ne',
        bottom:
          '.webos-window-resize-handle--s, .webos-window-resize-handle--sw, .webos-window-resize-handle--se',
        left: '.webos-window-resize-handle--w, .webos-window-resize-handle--nw, .webos-window-resize-handle--sw',
        right:
          '.webos-window-resize-handle--e, .webos-window-resize-handle--ne, .webos-window-resize-handle--se',
      },
      modifiers: [
        interact.modifiers.restrictSize({
          min: { width: this.win.options.minWidth, height: this.win.options.minHeight },
        }),
        // 限制 resize 后窗口仍在可见区
        interact.modifiers.restrictEdges({
          outer: 'parent',
        }),
      ],
      listeners: {
        start: () => {
          this.win.el.classList.add('webos-window--resizing')
          // 关键：iframe 在 resize 期间会把 mousemove/mouseup 全吞掉
          // → 父 document 收不到 end 事件 → 松开后窗口仍跟着鼠标变
          document.body.classList.add('webos-window-interacting')
          if (this.win.state === 'maximized') {
            this.win.restore()
          }
        },
        move: (event) => {
          const el = this.win.el
          const w = event.rect.width
          const h = event.rect.height
          el.style.width = `${w}px`
          el.style.height = `${h}px`
          el.style.left = `${event.rect.left}px`
          el.style.top = `${event.rect.top}px`
          this.win.emit('resize', { width: w, height: h })
        },
        end: () => {
          this.win.el.classList.remove('webos-window--resizing')
          document.body.classList.remove('webos-window-interacting')
        },
      },
    })
  }

  detach(): void {
    this.interactable?.unset()
    this.interactable = null
  }
}

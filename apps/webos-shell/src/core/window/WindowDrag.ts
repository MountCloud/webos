/**
 * 窗口拖拽
 * 基于 interact.js 实现
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import interact from 'interactjs'
import type { Window } from './Window'

export class WindowDrag {
  private interactable: ReturnType<typeof interact> | null = null

  constructor(private readonly win: Window) {}

  attach(): void {
    if (this.interactable) return

    this.interactable = interact(this.win.head).draggable({
      allowFrom: '.webos-window-head-draggable',
      ignoreFrom: '.webos-window-action-btn',
      inertia: false,
      modifiers: [
        // 限制：顶栏以下为可拖区，底部不再保留 dock 空间
        interact.modifiers.restrict({
          restriction: () => {
            const topReserve =
              this._readCssPx('--webos-top-bar-height', 40) +
              this._readCssPx('--webos-top-bar-margin', 12) * 2
            return {
              top: topReserve,
              left: -this.win.bounds.width + 100,
              right: window.innerWidth - 100,
              bottom: window.innerHeight - 40,
            }
          },
        }),
      ],
      listeners: {
        start: () => {
          if (this.win.state === 'maximized') {
            this.win.restore()
          }
          this.win.el.classList.add('webos-window--dragging')
          // 关键：让 iframe 不再吞事件，否则鼠标移过 iframe 后 mouseup 不会回到父 document
          document.body.classList.add('webos-window-interacting')
          this.win.focus()
        },
        move: (event) => {
          const el = this.win.el
          el.style.left = `${el.offsetLeft + event.dx}px`
          el.style.top = `${el.offsetTop + event.dy}px`
          this.win.emit('move', { x: el.offsetLeft, y: el.offsetTop })
        },
        end: () => {
          this.win.el.classList.remove('webos-window--dragging')
          document.body.classList.remove('webos-window-interacting')
        },
      },
    })
  }

  detach(): void {
    this.interactable?.unset()
    this.interactable = null
  }

  // 读 :root 上的 px 值，找不到走 fallback
  private _readCssPx(name: string, fallback: number): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : fallback
  }
}

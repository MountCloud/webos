/**
 * 鼠标 / 触摸位置追踪
 * 全局记录最后一次鼠标 / 触摸点，供菜单弹出位置等场景使用
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export interface Position {
  x: number
  y: number
}

const state = {
  mouse: { x: 0, y: 0 } as Position,
  touch: { x: 0, y: 0 } as Position,
}

let installed = false

export function installPositionTrackers(): void {
  if (installed) return
  installed = true

  document.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX
    state.mouse.y = e.clientY
  })

  document.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0]
      if (t) {
        state.touch.x = t.clientX
        state.touch.y = t.clientY
      }
    },
    { passive: true },
  )

  document.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0]
      if (t) {
        state.touch.x = t.clientX
        state.touch.y = t.clientY
      }
    },
    { passive: true },
  )
}

export function getMousePosition(): Position {
  return { ...state.mouse }
}

export function getTouchPosition(): Position {
  return { ...state.touch }
}

// 优先取触摸位置（移动端），否则取鼠标
export function getInteractionPosition(): Position {
  if (state.touch.x > 0 || state.touch.y > 0) return getTouchPosition()
  return getMousePosition()
}

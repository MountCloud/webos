/**
 * 窗口模块类型定义
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export type WindowState = 'normal' | 'maximized' | 'minimized' | 'closed'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowOptions {
  title?: string
  icon?: string

  // 尺寸与位置
  width?: number | string
  height?: number | string
  x?: number
  y?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number

  // 行为
  resizable?: boolean
  draggable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  closable?: boolean
  modal?: boolean
  parent?: WindowHandle
  alwaysOnTop?: boolean
  showInTaskbar?: boolean
  center?: boolean

  // 内容
  body?: HTMLElement | string | ((container: HTMLElement) => void)
  className?: string

  // 用户数据
  data?: Record<string, unknown>

  // 钩子
  onClose?: () => boolean | Promise<boolean>
}

// 对外暴露的窗口句柄（避免循环引用）
export interface WindowHandle {
  readonly id: string
  readonly el: HTMLElement
  state: WindowState
  bounds: WindowBounds
  zIndex: number
  focus(): void
  close(): Promise<boolean>
}

export interface WindowEvents {
  open: void
  focus: void
  blur: void
  close: void
  beforeClose: { cancel: () => void; cancelled: boolean }
  resize: { width: number; height: number }
  move: { x: number; y: number }
  maximize: void
  restore: void
  minimize: void
  stateChange: { from: WindowState; to: WindowState }
  titleChange: string
  iconChange: string
  [key: string]: unknown
}

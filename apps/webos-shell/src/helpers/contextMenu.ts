/**
 * 上下文菜单项工具函数
 * 提供常用菜单项的快捷构造
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export interface ContextMenuItem {
  label?: string
  icon?: string
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  children?: ContextMenuItem[]
  onClick?: () => void | Promise<void>
}

// 分隔符
export const MENU_DIVIDER: ContextMenuItem = { label: '-' }

export function isDivider(item: ContextMenuItem): boolean {
  return item.label === '-'
}

// 构建一个普通菜单项
export function menuItem(
  label: string,
  onClick: () => void,
  opts: Partial<ContextMenuItem> = {},
): ContextMenuItem {
  return { label, onClick, ...opts }
}

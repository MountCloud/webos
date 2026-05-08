/**
 * 简易 UUID 生成
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

// 用浏览器原生 crypto API，比 polyfill 库快得多
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 降级方案（老浏览器）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 短 ID（用于 DOM id 等）
let shortIdCounter = 0
export function shortId(prefix = 'id'): string {
  return `${prefix}-${++shortIdCounter}-${Date.now().toString(36)}`
}

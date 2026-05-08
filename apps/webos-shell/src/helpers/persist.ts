/**
 * 桌面壳级别的简单持久化（localStorage 包装）
 * 应用级别请用 Webos.storage（按 appId 隔离）
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

const PREFIX = 'webos:'

export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage 满 / 禁用：静默失败，不让 UI 因此崩溃
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

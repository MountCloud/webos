/**
 * DOM 操作工具
 * 替代 jQuery 常用操作的现代实现
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

// 创建元素并设置属性、子节点
export interface CreateOptions {
  className?: string
  id?: string
  style?: Partial<CSSStyleDeclaration>
  attrs?: Record<string, string>
  dataset?: Record<string, string>
  text?: string
  html?: string
  children?: (Node | string)[]
}

export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: CreateOptions = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)

  if (opts.className) el.className = opts.className
  if (opts.id) el.id = opts.id

  if (opts.style) {
    Object.assign(el.style, opts.style)
  }

  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) el.setAttribute(k, v)
  }

  if (opts.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) el.dataset[k] = v
  }

  if (opts.text !== undefined) {
    el.textContent = opts.text
  } else if (opts.html !== undefined) {
    el.innerHTML = opts.html
  } else if (opts.children) {
    for (const child of opts.children) {
      el.append(child)
    }
  }

  return el
}

// 安全 HTML 转义（避免 XSS）
export function htmlEncode(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 设置多条样式
export function setStyle(el: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, style)
}

// toggle class
export function toggleClass(el: HTMLElement, name: string, force?: boolean): boolean {
  return el.classList.toggle(name, force)
}

// 简易代理事件（在父元素上监听子元素事件）
export function delegate<K extends keyof HTMLElementEventMap>(
  parent: HTMLElement,
  selector: string,
  event: K,
  handler: (e: HTMLElementEventMap[K], target: HTMLElement) => void,
): () => void {
  const listener = (e: Event) => {
    const target = (e.target as HTMLElement | null)?.closest(selector) as HTMLElement | null
    if (target && parent.contains(target)) {
      handler(e as HTMLElementEventMap[K], target)
    }
  }
  parent.addEventListener(event, listener)
  return () => parent.removeEventListener(event, listener)
}

// 等待元素出现
export function waitForElement(selector: string, timeout = 5000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLElement>(selector)
    if (existing) {
      resolve(existing)
      return
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      reject(new Error(`waitForElement timeout: ${selector}`))
    }, timeout)
  })
}

// 移除元素
export function removeEl(el: Element | null): void {
  el?.parentNode?.removeChild(el)
}

// 获取元素绝对位置
export function getOffset(el: HTMLElement): { top: number; left: number } {
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
  }
}

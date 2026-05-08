# 03 · 编码风格约定

## TypeScript

### 严格模式 + ES2022

`tsconfig.base.json` 开了 `strict: true`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`。

任何 PR 提交前必须通过：

```bash
"E:/project/html/osweb/apps/webos-shell/node_modules/.bin/tsc" --noEmit -p apps/webos-shell/tsconfig.json
```

### 类型导入用 `import type`

```ts
// ✅
import type { AppManifest } from './AppManifest'
import { AppLoader } from './AppLoader'

// ❌
import { type AppManifest, AppLoader } from './AppManifest'   // 混用看着乱
```

### 接口优于 type 别名（除非必须用 union / intersection）

```ts
// ✅
export interface NotifyOptions {
  title: string
  level?: NotificationLevel
}

// ❌（除非真要 union）
export type NotifyOptions = { title: string; level?: NotificationLevel }
```

### 索引签名表达"业务方扩展字段"

```ts
export interface User {
  id: string
  name: string
  // 业务方可加任意自家字段
  [key: string]: unknown
}
```

### 函数重载用 `function ... function ...` 形式

不要写 union type 参数 + 内部 `if (typeof arg === 'string')` 让调用方用 type guard，重载更清晰：

```ts
// ✅
export function alert(message: string, title?: string): Promise<void>
export function alert(options: AlertOptions): Promise<void>
export function alert(arg1: string | AlertOptions, arg2?: string): Promise<void> {
  const options = typeof arg1 === 'string' ? { message: arg1, title: arg2 } : arg1
  return openAlert(options)
}
```

### 错误处理

`catch (err: unknown)` + `instanceof Error` 判断：

```ts
try {
  await action()
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string }).code ?? 'UNKNOWN'
  // ...
}
```

handler 抛 typed error：

```ts
throw Object.assign(new Error('找不到应用'), { code: 'NOT_FOUND' })
```

### 不用 enum

用 string union 或 const object：

```ts
// ✅
export type NotificationLevel = 'info' | 'success' | 'warning' | 'critical'

// ❌
enum NotificationLevel { Info, Success, Warning, Critical }
```

---

## 注释

**核心原则：注释解释 WHY，不解释 WHAT。**

### ✅ 好的注释（解释非显然的事）

```ts
// iframe 在 resize 期间会把 mousemove/mouseup 全吞掉
// → 父 document 收不到 end 事件 → 松开后窗口仍跟着鼠标变
document.body.classList.add('webos-window-interacting')
```

```ts
// 用 source.appId 反查的 trusted 值覆盖 iframe 自报的 —— 防伪造、防漏传
const trustedAppId = source.appId
if (req.appId !== trustedAppId) {
  ...
}
```

### ❌ 不要写

- AI 风格的"任务编号 / step 1 我们..." → **绝对禁止**
- 重复代码本身的描述：`// 调用 launch 方法`
- 多段 docstring（除非真的暴露 public API）
- 历史日志：`// 2026-04-29 changed by xxx`（这是 git 的事）

### 文件头

每个文件顶端一段简短 JSDoc 说明文件职责 + 作者：

```ts
/**
 * 应用加载器
 * 启动应用：根据 manifest 创建 AppWindow，注册到 MessageBus
 *
 * @author MountCloud <mountcloud@outlook.com>
 */
```

**作者** 一律 `MountCloud <mountcloud@outlook.com>`，**MIT 协议**。

### 中文 OK，混着英文 OK

代码注释和 markdown 文档默认中文（项目语言）。技术名词（如 RPC / postMessage / iframe）保留英文。

---

## 命名

### 类 / 接口 PascalCase

`Window`、`AppLoader`、`UserSession`、`NotifyOptions`、`UIElement`

### 函数 / 变量 / 字段 camelCase

`registerHandler`、`appWindows`、`isTokenExpired`

### CSS 类名 BEM-ish + `webos-` 前缀

```
.webos-window
.webos-window-head
.webos-window-head--maximized            // 修饰符
.webos-window-action-btn--close          // 元素 + 修饰符
```

### CSS 变量 `--webos-` 前缀，分组

```
--webos-color-primary
--webos-color-bg-window
--webos-spacing-md
--webos-icon-size
--webos-top-bar-height
```

### postMessage 事件 / RPC module / method 全小写下划线 OR camelCase

实际用了 camelCase（`Webos.window.setSize`）。RPC 协议固定，不要改 module 名。

### 文件命名

- 类一文件一导出：文件名 = 类名（PascalCase.ts）
- 工具集合：camelCase / kebab-case
- index.ts 仅 re-export

---

## 文件组织

每个子目录保持小（< 10 个文件），有 `index.ts` 做 barrel export。

```
core/window/
├── Window.ts                  # 基础窗口类
├── AppWindow.ts               # 子类，加 iframe
├── WindowManager.ts           # singleton
├── WindowDrag.ts              # 拖动逻辑（interact.js 包装）
├── WindowResize.ts            # 缩放逻辑
├── types.ts                   # 共用类型
└── index.ts                   # 全部 re-export
```

外部 import 走 `index.ts`：

```ts
import { Window, WindowManager, type WindowOptions } from './core/window'
```

---

## DOM 操作

### 用 `helpers/dom.ts` 的 `createEl`，不要 `document.createElement` 后挨个 setAttribute

```ts
// ✅
const btn = createEl('button', {
  className: 'webos-btn webos-btn--primary',
  attrs: { type: 'button', 'aria-label': '保存' },
  text: '保存',
})

// ❌
const btn = document.createElement('button')
btn.className = 'webos-btn webos-btn--primary'
btn.setAttribute('type', 'button')
// ...
```

### SVG 用 innerHTML（受控字符串），不要 createElementNS

```ts
btn.innerHTML = '<svg xmlns="..." viewBox="0 0 24 24">...</svg>'
```

### 事件用 `addDomListener`（UIElement 内）/ `addEventListener`（其他）

UIElement 子类内一律 `this.addDomListener(...)` 让 destroy 自动清。其他场合用原生 addEventListener。

### options 选项 stopPropagation

```ts
btn.addEventListener('click', (e) => {
  e.stopPropagation()   // 关掉冒泡到父级 outsideClick 监听
  doSomething()
})
```

但**不要无脑 stopPropagation** —— 想清楚是不是真的需要。

---

## 样式（SCSS）

- BEM 命名 + `webos-` 前缀
- 颜色 / 间距 / 圆角 / 阴影 / 字号 全部走 CSS 变量（不要硬编码 `#fff`、`16px`）
- 一个组件一份 SCSS（dock.scss / window.scss / dialog.scss）—— 在 `styles/index.scss` 里 `@use`
- 状态 class 用 `--shown`、`--active`、`--dragging`、`--resizing`、`--busy` 等

例：

```scss
.webos-dock {
  position: fixed;
  background: var(--webos-color-bg-glass);
  backdrop-filter: blur(var(--webos-blur-strong));
  border-radius: var(--webos-radius-lg);
  padding: var(--webos-spacing-sm);

  &--empty {
    display: none;
  }
}
```

---

## 不写防御代码 if 不会发生

```ts
// ❌ 过度防御
function setBadge(n: number | null): void {
  if (typeof n !== 'number' && n !== null) return
  if (n < 0) n = 0
  if (n > Number.MAX_SAFE_INTEGER) n = 99
  ...
}

// ✅ 信任内部调用方；TS 已经在编译期保证类型
function setBadge(n: number | null): void {
  if (n === null || n <= 0) {
    this._badgeEl.style.display = 'none'
  } else {
    this._badgeEl.textContent = n > 99 ? '99+' : String(n)
    ...
  }
}
```

防御代码只放在系统边界（用户输入 / 网络数据 / SDK 给应用的接口）。

---

## 测试

项目当前没有自动化测试。改代码后必须**手动验证**：

1. `tsc --noEmit` 过
2. `vite build` 过
3. **手动 dev server 起来在浏览器里点一遍受影响的功能**

未来计划补 Vitest 单元测试 + Playwright E2E。

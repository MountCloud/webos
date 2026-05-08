# 02 · SDK 速查（含完整类型）

`@webos/host-sdk` 全模块的方法 + 类型 + 典型用法。**这一份能独立查清楚**，不用再翻 docs。

```ts
import { Webos } from '@webos/host-sdk'
// 类型按需 import
import type { User, TokenInfo, NotifyOptions, AlertOptions, DialogButton } from '@webos/host-sdk'
```

通用约定：
- 所有方法返回 `Promise`（除 `Webos.download` 同步触发、`on()` 同步返回 unsubscribe）
- 失败 reject `Error`，可能带 `code: string` 字段（`'NOT_FOUND' | 'NOT_IMPLEMENTED' | 'INVALID_ARGS' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'HANDLER_ERROR'`）
- 默认 RPC 超时 30s，可改：`Webos.configure({ timeout: 60000 })`

---

## Webos.notify（桌面通知）

### 类型

```ts
type NotificationLevel = 'info' | 'success' | 'warning' | 'critical'

interface NotifyOptions {
  title: string
  message?: string
  level?: NotificationLevel       // 默认 'info'
  duration?: number               // 毫秒；0 = 常驻不自动关；默认 4500（critical 默认 0）
  actions?: Array<{
    label: string
    actionId: string              // 用户点中后回 actionId（onClick 函数不能传，因为 postMessage）
  }>
  onClick?: () => void            // 仅 SDK 端有效（点 toast 主体触发；webos shell 端会 close）
}

interface NotifyHandle {
  close: () => void
}
```

### 方法

```ts
Webos.notify(options: NotifyOptions): Promise<NotifyHandle>
```

### 用法

```ts
Webos.notify({ title: '保存成功', level: 'success' })

const h = await Webos.notify({
  title: '严重告警', message: '检测到关键事件',
  level: 'critical', duration: 0,
})
// 5 秒后主动关
setTimeout(() => h.close(), 5000)
```

同屏最多 5 条 toast，超出关掉最旧的。

---

## Webos.dialog（对话框）

### 类型

```ts
type DialogButtonType = 'primary' | 'secondary' | 'danger'
type DialogIcon = 'info' | 'warning' | 'danger' | 'success' | 'question' | string  // string = URL/data-uri

interface DialogButton {
  label: string
  value?: unknown                 // 点击时 resolve 出的值；不传则 = label
  type?: DialogButtonType
  autoFocus?: boolean             // 按 Enter 触发
  cancel?: boolean                // 按 Esc / 点窗口 × 触发
  disabled?: boolean
}

interface AlertOptions {
  title?: string
  message: string
  icon?: DialogIcon
  buttons?: DialogButton[]        // 自定义按钮列表（优先级最高）
  // 简化字段（不传 buttons 时生效）
  confirmText?: string            // 默认 '确定'
  cancelText?: string             // 默认 '取消'
  showCancel?: boolean
  danger?: boolean                // 主按钮变红
  width?: number
  height?: number
}

interface PromptInputOptions extends Omit<AlertOptions, 'icon'> {
  defaultValue?: string
  placeholder?: string
  validate?: (value: string) => true | string  // 返回 true 通过；返回 string 显示为错误
}

interface PromptResult {
  button?: unknown                // 用户点的按钮 value
  value: string | null            // 输入值；用户取消则 null
}

interface OpenFileOptions {
  title?: string
  accept?: string[]               // ['.json', 'image/*']
  multiple?: boolean
}

interface SaveFileOptions {
  title?: string
  defaultName?: string
  accept?: string[]
}
```

### 方法

```ts
// 简化签名（兼容老接口）
Webos.dialog.alert(message: string, title?: string): Promise<void>
Webos.dialog.confirm(message: string, title?: string): Promise<boolean>
Webos.dialog.prompt(message: string, defaultValue?: string, title?: string): Promise<string | null>

// 选项形式
Webos.dialog.alert(options: AlertOptions): Promise<void>
Webos.dialog.confirm(options: AlertOptions): Promise<boolean>
Webos.dialog.prompt(options: PromptInputOptions): Promise<string | null>

// 完全自定义按钮 —— resolve 出被点按钮的 value
Webos.dialog.show<T = unknown>(options: AlertOptions): Promise<T>

// 完整 prompt（带校验，返回 button + value）
Webos.dialog.promptEx(options: PromptInputOptions): Promise<PromptResult>

// V1.5 待实现（当前抛 NOT_IMPLEMENTED）
Webos.dialog.openFile(options?: OpenFileOptions): Promise<File | File[] | null>
Webos.dialog.saveFile(options?: SaveFileOptions): Promise<string | null>
Webos.dialog.pickDirectory(): Promise<string | null>
Webos.dialog.pickColor(options?: { default?: string }): Promise<string | null>
Webos.dialog.pickFont(options?: { default?: string }): Promise<string | null>
Webos.dialog.showQR(options: { data: string; title?: string }): Promise<void>
```

### 用法

```ts
// 1. 简化
await Webos.dialog.alert('文件已保存')
const ok = await Webos.dialog.confirm('确认删除？')

// 2. 选项形式 + 危险样式
await Webos.dialog.confirm({
  title: '永久删除',
  message: '即将永久删除 12 个文件，不可撤销。',
  icon: 'warning',
  confirmText: '永久删除',
  cancelText: '保留',
  danger: true,
})

// 3. 自定义按钮
const action = await Webos.dialog.show<'save' | 'discard' | 'cancel'>({
  title: '保存修改？',
  message: '当前文档有未保存的修改。',
  icon: 'question',
  buttons: [
    { label: '不保存', value: 'discard', type: 'danger' },
    { label: '取消', value: 'cancel', cancel: true },                       // Esc
    { label: '保存', value: 'save', type: 'primary', autoFocus: true },     // Enter
  ],
})

// 4. 带校验的 prompt
const r = await Webos.dialog.promptEx({
  message: '邮箱',
  defaultValue: 'me@x.com',
  validate: (v) => /^[^@]+@[^@]+$/.test(v) || '邮箱格式不正确',
})
// r = { button: '__confirm__', value: 'me@x.com' } | { value: null }
```

---

## Webos.window（控制自己的窗口）

### 类型

```ts
interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}
```

### 方法

```ts
// 状态
Webos.window.minimize(): Promise<void>
Webos.window.maximize(): Promise<void>
Webos.window.restore(): Promise<void>
Webos.window.close(): Promise<void>
Webos.window.setTitle(title: string): Promise<void>
Webos.window.setBadge(n: number | null): Promise<void>     // V1.5
Webos.window.setBusy(busy: boolean): Promise<void>          // 显示忙碌遮罩 + 转圈
Webos.window.fullscreen(): Promise<void>                    // V1.5

// 尺寸 / 位置
Webos.window.setSize(width: number, height: number): Promise<void>
Webos.window.setBounds(bounds: Partial<WindowBounds>): Promise<void>   // 不传的字段保持
Webos.window.getBounds(): Promise<WindowBounds>
Webos.window.center(): Promise<void>                                    // 自动避开顶栏
```

### 用法

```ts
// 改尺寸
await Webos.window.setSize(800, 600)

// 改某一轴（其他保持）
await Webos.window.setBounds({ width: 1200 })
await Webos.window.setBounds({ x: 50, y: 50 })

// 自适应内容
const bounds = await Webos.window.getBounds()
const content = document.querySelector('main')!
await Webos.window.setSize(bounds.width, content.scrollHeight + 80)

// 居中
await Webos.window.center()

// 长任务 + 忙碌遮罩
await Webos.window.setBusy(true)
try { await heavyJob() } finally { await Webos.window.setBusy(false) }
```

---

## Webos.contextMenu（右键菜单）

### 类型

```ts
interface ContextMenuItem {
  label?: string                  // 不传 + 不传 children 视为分隔线（也可写 label: '-'）
  icon?: string                   // emoji 或 SVG / 数据 URI
  disabled?: boolean
  danger?: boolean                // 文字变红
  shortcut?: string               // 右侧显示的快捷键提示（如 'Ctrl+C'）
  actionId?: string               // 用户点中后 resolve 出来的标识
  children?: ContextMenuItem[]    // 子菜单
}

interface ContextMenuOptions {
  items: ContextMenuItem[]
  x: number                       // 视口坐标（e.clientX）
  y: number                       // 视口坐标（e.clientY）
}
```

### 方法

```ts
Webos.contextMenu(options: ContextMenuOptions): Promise<string | null>
// resolve 出被点项的 actionId；点空白或 Esc 关闭则 null
```

### 用法

```ts
window.addEventListener('contextmenu', async (e) => {
  e.preventDefault()
  const action = await Webos.contextMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      { actionId: 'copy', label: '复制', shortcut: 'Ctrl+C' },
      { actionId: 'paste', label: '粘贴', shortcut: 'Ctrl+V' },
      { label: '-' },
      {
        label: '导出为',
        children: [
          { actionId: 'export-pdf', label: 'PDF' },
          { actionId: 'export-csv', label: 'CSV' },
        ],
      },
      { label: '-' },
      { actionId: 'delete', label: '删除', danger: true },
    ],
  })
  if (action === 'copy') doCopy()
  if (action === 'export-pdf') exportPdf()
})
```

---

## Webos.user（用户身份 / token）⭐

### 类型

```ts
interface User {
  id: string
  name: string
  email?: string
  avatar?: string                 // URL
  permissions?: string[]
  // 业务方扩展字段任意（必须能 JSON 序列化）
  [key: string]: unknown
}

// OAuth / OIDC 标准字段
interface TokenInfo {
  accessToken: string             // 必填，调 API 时塞 Authorization 头的就是这个
  refreshToken?: string           // 用 refresh token 换新 access token
  tokenType?: string              // 一般是 'Bearer'
  expiresAt?: number              // 过期时间（epoch ms 时间戳）；不传视为不过期
  scope?: string                  // 作用域 / 权限范围
  idToken?: string                // OIDC id_token（含身份声明的 JWT）
  // 业务方扩展字段任意
  [key: string]: unknown
}

interface UserChangePayload {
  user: User | null
  token: TokenInfo | null
}

// 同 origin 登录页 helper 用
interface WebosSessionPayload {
  user: User | null
  token: TokenInfo | null
}
```

### 方法

```ts
// 读
Webos.user.current(): Promise<User | null>
Webos.user.permissions(): Promise<string[]>             // user.permissions 字段
Webos.user.token(): Promise<TokenInfo | null>           // 完整 token 对象
Webos.user.accessToken(): Promise<string | null>        // 便利：只取 accessToken 字符串
Webos.user.isTokenExpired(): Promise<boolean>           // 基于 expiresAt 与本机时间

// 写
Webos.user.set(payload: { user: User; token?: TokenInfo | null }): Promise<void>
Webos.user.setUser(user: User | null): Promise<void>             // 仅 user，token 保持
Webos.user.setToken(token: TokenInfo | null): Promise<void>      // 仅 token，user 保持
Webos.user.clear(): Promise<void>                                 // 登出

// 订阅
Webos.user.on(
  event: 'change',
  handler: (payload: UserChangePayload) => void
): () => void   // 返回 unsubscribe

// 同 origin 登录页用（不走 RPC，直接读写 localStorage 的纯函数）
import {
  writeWebosSession,    // (payload: { user: User; token?: TokenInfo | null }) => void
  writeWebosUser,       // (user: User | null) => void
  writeWebosToken,      // (token: TokenInfo | null) => void
  readWebosSession,     // () => WebosSessionPayload
  clearWebosSession,    // () => void
  hasWebosSession,      // () => boolean
} from '@webos/host-sdk'
```

### 用法

```ts
// 启动检查
const user = await Webos.user.current()
if (!user) location.href = '/login.html'

// 调 API 带 token
const accessToken = await Webos.user.accessToken()
fetch('/api/x', {
  headers: { Authorization: `Bearer ${accessToken}` },
})

// OAuth 登录后注入完整会话
const r = await fetch('/api/sso/callback?code=...').then(r => r.json())
await Webos.user.set({
  user: { id: r.id, name: r.name, email: r.email, permissions: r.perms },
  token: {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    tokenType: r.token_type ?? 'Bearer',
    expiresAt: Date.now() + r.expires_in * 1000,    // ⚠️ expires_in 是相对秒数
    scope: r.scope,
    idToken: r.id_token,
  },
})

// refresh token 流程
if (await Webos.user.isTokenExpired()) {
  const cur = await Webos.user.token()
  if (!cur?.refreshToken) { location.href = '/login.html'; return }
  const r = await fetch('/api/sso/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: cur.refreshToken }),
  }).then(r => r.json())
  await Webos.user.setToken({
    ...cur,
    accessToken: r.access_token,
    expiresAt: Date.now() + r.expires_in * 1000,
    refreshToken: r.refresh_token ?? cur.refreshToken,   // refresh-token-rotation
  })
}

// 仅更新 user（资料 / 头像变化）
const cur = await Webos.user.current()
if (cur) await Webos.user.setUser({ ...cur, name: '新名字', avatar: '...' })

// 登出
await Webos.user.clear()
location.href = '/login.html'

// 监听被登出
const off = Webos.user.on('change', ({ user, token }) => {
  if (!user) location.href = '/login.html'
  else apiClient.setToken(token?.accessToken ?? null)
})
```

详见专章 [04-user-session.md](./04-user-session.md)。

---

## Webos.app（自身启动信息）

### 类型

```ts
interface AppBootInfo {
  appId: string
  entryId: string                 // 当前是哪个 entry
  feature?: string                // entries[i].features 里的 id
  uri?: string                    // 实际加载的 URL（含 feature / params）
  params?: Record<string, unknown>  // launch 时传的 params
}
```

### 方法

```ts
Webos.app.bootInfo(): Promise<AppBootInfo>
Webos.app.onNavigate(handler: (payload: {
  feature?: string; uri?: string; params?: Record<string, unknown>
}) => void): () => void
```

### 用法

```ts
const info = await Webos.app.bootInfo()
console.log('我是', info.appId, '/', info.entryId, 'feature:', info.feature)

if (info.feature === 'reports') router.push('/reports')
else if (info.params?.docId) router.push(`/docs/${info.params.docId}`)

// 已运行时被深链调起（推荐用 onNavigate）
Webos.app.onNavigate(({ feature, uri }) => {
  router.push(uri ?? '/')
})
```

---

## Webos.events（全局事件广播）

### 方法

```ts
Webos.events.emit(event: string, payload?: unknown): Promise<void>
Webos.events.on(event: string, handler: (payload: unknown) => void): () => void
```

### 内置事件

| event | 何时触发 | payload |
|-------|---------|---------|
| `theme.changed` | webos 切深 / 浅模式时 | `{ theme: 'light' \| 'dark' }` |
| `user.changed` | UserSession set / setUser / setToken / clear 任一调用 | `{ user: User \| null; token: TokenInfo \| null }` |
| `app.navigate` | 已运行应用被全局搜索 / `apps.open({ entryId, feature })` 触发深链；推荐用 `Webos.app.onNavigate()` | `{ feature?: string; uri?: string; params?: Record<string, unknown> }` |

### 用法

```ts
// 业务自定义事件
await Webos.events.emit('config.changed', { key: 'locale', value: 'en' })

// 任意应用订阅
const off = Webos.events.on('config.changed', (payload) => {
  const p = payload as { key: string; value: unknown }
  if (p.key === 'locale') location.reload()
})
```

---

## Webos.message（应用 ↔ 应用单播）

### 方法

```ts
Webos.message.send(targetAppId: string, message: unknown): Promise<void>
Webos.message.on(handler: (message: unknown, fromAppId: string) => void): () => void
```

### 用法

```ts
// 日历应用：触发邮件应用打开撰写
await Webos.message.send('mail', { type: 'compose', to: 'a@x.com', subject: '会议' })

// 邮件应用：监听
Webos.message.on((msg, fromAppId) => {
  // ⚠️ 必须 type guard，外部数据不可信
  if (typeof msg !== 'object' || !msg) return
  const m = msg as { type?: string; to?: string }
  if (fromAppId === 'calendar' && m.type === 'compose' && m.to) openCompose(m.to)
})
```

---

## Webos.theme（主题）

### 类型

```ts
type Theme = 'light' | 'dark'
type ThemeMode = Theme | 'auto'
```

### 方法

```ts
Webos.theme.current(): Promise<Theme>
Webos.theme.set(name: ThemeMode): Promise<void>
Webos.theme.on(event: 'change', handler: (theme: Theme) => void): () => void
Webos.theme.getTokens(): Promise<Record<string, string>>   // 当前主题下所有 --webos-* 变量
```

### 用法

```ts
const t = await Webos.theme.current()         // 'light' | 'dark'
await Webos.theme.set('dark')                  // 影响全局（所有应用）
await Webos.theme.set('auto')                  // 跟随系统

const off = Webos.theme.on('change', (theme) => {
  document.documentElement.dataset.theme = theme
})

// 拿到所有主题 token（如做 canvas / svg 自定义渲染需要颜色）
const tokens = await Webos.theme.getTokens()
console.log(tokens['--webos-color-primary'])   // 当前主题下的真实色值
```

---

## Webos.storage（应用维度的 KV 存储）

按 `appId` 隔离 —— 每个应用读不到别人的数据。底层是 webos shell 的 localStorage（带前缀），最大 ~5MB。

### 方法

```ts
Webos.storage.get<T = unknown>(key: string): Promise<T | null>
Webos.storage.set(key: string, value: unknown): Promise<void>   // value 必须能 JSON 序列化
Webos.storage.remove(key: string): Promise<void>
Webos.storage.clear(): Promise<void>                             // 清空本应用的所有 key
```

### 用法

```ts
await Webos.storage.set('settings', { autoSave: true, theme: 'auto' })
const s = await Webos.storage.get<{ autoSave: boolean; theme: string }>('settings')
await Webos.storage.remove('settings')
```

---

## Webos.apps（其他应用）

### 类型

```ts
interface AppMeta {
  appId: string
  name: string
  icon?: string
  version?: string
}

interface EntryMeta {
  appId: string
  appName: string
  appIcon?: string
  id: string                  // entry id
  name: string
  icon?: string
  uri: string
  description?: string
  launchMode?: 'window' | 'tab'
  showIn?: ('desktop' | 'start-menu' | 'app-store')[]
  order?: number
}

interface OpenOptions {
  entryId: string                          // 必填
  feature?: string
  params?: Record<string, unknown>
}
```

### 方法

```ts
Webos.apps.list(): Promise<AppMeta[]>
Webos.apps.listEntries(filter?: { showIn?: 'desktop' | 'start-menu' | 'app-store' }): Promise<EntryMeta[]>
Webos.apps.has(appId: string, entryId?: string): Promise<boolean>
Webos.apps.open(appId: string, options: OpenOptions): Promise<void>
// options.params 走 URL 查询串透传给目标应用；目标应用可在 bootInfo() 拿到
```

### 用法

```ts
// 检查应用 + 某 entry
if (await Webos.apps.has('text-editor', 'main')) {
  await Webos.apps.open('text-editor', {
    entryId: 'main',
    params: { path: '/tmp/x.txt' },
  })
}

// 直达深链
await Webos.apps.open('com.acme.crm', {
  entryId: 'main',
  feature: 'reports',
})
```

---

## Webos.system（系统信息）

### 类型

```ts
interface SystemInfo {
  version: string         // webos 版本（如 '0.2.0'）
  platform: string        // navigator.platform
  locale: string          // 'zh' | 'en' | ...
  theme: 'light' | 'dark'
  userAgent: string
}
```

### 方法

```ts
Webos.system.info(): Promise<SystemInfo>
Webos.system.openSettings(panel?: string): Promise<void>   // 打开 webos 设置面板
Webos.system.search(query: string): Promise<void>           // 触发全局搜索（带预填词）
```

### 用法

```ts
const info = await Webos.system.info()
console.log('webos:', info.version, 'locale:', info.locale)

await Webos.system.search('客户')
```

---

## Webos.requestPermission（申请权限）

简单实现：弹一个 confirm 让用户授权（不强制校验）。V1.0 计划与 manifest `entries[i].permissions` 联动。

### 方法

```ts
Webos.requestPermission(options: {
  permissions: string[]
  reason?: string
}): Promise<boolean>
```

### 用法

```ts
const ok = await Webos.requestPermission({
  permissions: ['camera', 'mic'],
  reason: '会议室签到需要拍照',
})
if (!ok) return
```

---

## Webos.download / upload

### 类型

```ts
interface DownloadOptions {
  url: string
  filename?: string
}

interface UploadOptions {
  url: string
  files: File[]
  fieldName?: string                       // 默认 'file'
  headers?: Record<string, string>
  onProgress?: (loaded: number, total: number) => void
}

interface UploadResult {
  ok: boolean
  status: number
  body?: string
}
```

### 方法

```ts
Webos.download(options: DownloadOptions): void   // ⚠️ 同步，不返 Promise
Webos.upload(options: UploadOptions): Promise<UploadResult>   // V1.5 实装
```

### 用法

```ts
Webos.download({ url: 'https://x.com/file.pdf', filename: '账单.pdf' })
```

---

## Webos.configure / Webos.client（高级）

### 类型

```ts
interface RpcClientOptions {
  target?: Window               // 默认 window.parent
  appId?: string                // 默认从 URL `?webosAppId=` 推断
  timeout?: number              // 默认 30000ms
  debug?: boolean               // 控制台打印每个请求 / 响应
}
```

### 方法

```ts
Webos.configure(options: RpcClientOptions): void
Webos.client.call<T = unknown>(module: string, method: string, args?: unknown): Promise<T>
Webos.client.on(event: string, handler: (payload: unknown) => void): () => void
```

### 用法

```ts
// 调试
Webos.configure({ debug: true, timeout: 60000 })

// 直接调底层（绕过 SDK 包装；调集成方注册的自定义 module 时用）
const r = await Webos.client.call('myCompany', 'doSomething', { foo: 1 })
```

---

## 错误处理速查

```ts
try {
  await Webos.dialog.openFile()
} catch (err: any) {
  switch (err.code) {
    case 'NOT_IMPLEMENTED':
      Webos.notify({ title: '功能即将上线', level: 'info' })
      break
    case 'PERMISSION_DENIED':
      Webos.notify({ title: '没有权限', level: 'warning' })
      break
    case 'TIMEOUT':
      Webos.notify({ title: '请求超时，重试', level: 'warning' })
      break
    case 'NOT_FOUND':
    case 'INVALID_ARGS':
    case 'HANDLER_ERROR':
    default:
      Webos.notify({ title: '出错', message: err.message, level: 'critical' })
  }
}
```

---

## 类型导出一览

从 `@webos/host-sdk` 直接 import 的所有类型：

```ts
import type {
  // 用户 / token
  User, TokenInfo, UserChangePayload, WebosSessionPayload,
  // 通知
  NotifyOptions, NotificationLevel,
  // 对话框
  AlertOptions, DialogButton, DialogButtonType, DialogIcon,
  PromptInputOptions, PromptResult,
  OpenFileOptions, SaveFileOptions, PropertiesOptions, ProgressHandle,
  // 上下文菜单
  ContextMenuItem, ContextMenuOptions,
  // 文件
  DownloadOptions, UploadOptions, UploadResult,
  // 应用
  AppMeta, AppBootInfo,
  // 窗口
  WindowBounds,
  // 系统
  SystemInfo, Theme,
  // 底层
  RpcClient, RpcClientOptions,
} from '@webos/host-sdk'
```

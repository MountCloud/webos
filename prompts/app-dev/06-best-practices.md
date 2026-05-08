# 06 · 应用开发最佳实践

写"运行在 webos 里的应用"的工程实践。

---

## 启动期"自检三件套"

应用首次运行时按顺序做：

```ts
async function bootstrap() {
  // 1. 自身上下文（我是谁，从哪来）
  const info = await Webos.app.bootInfo()
  console.log('app:', info.appId, 'feature:', info.feature, 'params:', info.params)

  // 2. 用户身份（没登录就跳走）
  const user = await Webos.user.current()
  if (!user) {
    location.href = '/login.html'
    return
  }
  setUser(user)

  // 3. 主题同步
  applyTheme(await Webos.theme.current())
  Webos.theme.on('change', applyTheme)

  // 4. 启动业务
  startApp(info)
}

bootstrap().catch((err) => {
  Webos.notify({
    title: '启动失败',
    message: err instanceof Error ? err.message : String(err),
    level: 'critical',
  })
})
```

---

## API 调用集中拦截

把 `fetch` / `axios` 包一层，在 interceptor 里：
- 自动带 `Authorization: Bearer <accessToken>`
- 401 时尝试 refresh token
- 5xx 时弹 webos 通知 / 跳错误页

```ts
// api/client.ts
import { Webos } from '@webos/host-sdk'

async function ensureFreshToken() {
  if (!(await Webos.user.isTokenExpired())) return
  const cur = await Webos.user.token()
  if (!cur?.refreshToken) {
    await Webos.user.clear()
    location.href = '/login.html'
    throw new Error('需要登录')
  }
  const r = await fetch('/api/sso/refresh', { ... })
  await Webos.user.setToken({ ...cur, accessToken: r.access_token, ... })
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureFreshToken()
  const accessToken = await Webos.user.accessToken()
  const resp = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (resp.status === 401) {
    await Webos.user.clear()
    location.href = '/login.html'
    throw new Error('未登录')
  }
  if (!resp.ok) {
    Webos.notify({ title: 'API 错误', message: `${resp.status} ${resp.statusText}`, level: 'critical' })
    throw new Error(resp.statusText)
  }
  return resp.json()
}

// 业务用法
const customers = await api<Customer[]>('/api/customers')
```

---

## 事件订阅一律 `useEffect` + `return off`

错误：

```tsx
// ❌
function Foo() {
  Webos.events.on('xxx', handler)   // 每次 render 都订阅！内存 bomb
  return <div>...</div>
}
```

正确：

```tsx
// ✅
function Foo() {
  useEffect(() => {
    const off = Webos.events.on('xxx', handler)
    return off
  }, [])  // 空 deps：只订阅一次
  return <div>...</div>
}
```

---

## 错误处理统一走 webos 通知

```ts
import { Webos } from '@webos/host-sdk'

window.addEventListener('error', (e) => {
  Webos.notify({
    title: '应用出错',
    message: e.message,
    level: 'critical',
    duration: 0,    // 不自动关，让用户看到
  })
})

window.addEventListener('unhandledrejection', (e) => {
  Webos.notify({
    title: '未处理的 Promise 拒绝',
    message: String(e.reason),
    level: 'critical',
  })
})
```

代替自家 toast / 浏览器原生 alert。

---

## 长任务必带 setBusy

```ts
async function importBigFile(file: File) {
  await Webos.window.setBusy(true)
  try {
    await heavyParse(file)
    Webos.notify({ title: '导入完成', level: 'success' })
  } catch (err) {
    Webos.notify({
      title: '导入失败',
      message: err instanceof Error ? err.message : String(err),
      level: 'critical',
    })
  } finally {
    await Webos.window.setBusy(false)
  }
}
```

setBusy 给窗口加遮罩 + 转圈，防用户在长任务期间乱点。

---

## 关键操作绑右键菜单

提升应用集成观感：

```ts
document.addEventListener('contextmenu', async (e) => {
  // 排除文本输入框（用户可能想用浏览器原生菜单粘贴）
  const t = e.target as HTMLElement
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return

  e.preventDefault()
  const action = await Webos.contextMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      { actionId: 'save', label: '保存', shortcut: 'Ctrl+S' },
      { actionId: 'export', label: '导出' },
      { label: '-' },
      { actionId: 'delete', label: '删除', danger: true },
    ],
  })
  if (action === 'save') await save()
  if (action === 'delete') await del()
})
```

---

## 跨应用消息要明确目标

```ts
// 给 'mail' 应用发消息
await Webos.message.send('mail', { type: 'compose', to: 'a@x.com' })

// mail 应用监听
Webos.message.on((msg, fromAppId) => {
  // 1. 检查 fromAppId 是否可信
  if (!['calendar', 'contacts'].includes(fromAppId)) return
  // 2. 检查 msg 结构（外部数据，type guard 一下）
  if (typeof msg !== 'object' || !msg) return
  const m = msg as { type?: string; to?: string }
  if (m.type === 'compose' && m.to) openCompose(m.to)
})
```

跨应用消息 = 跨边界，**永远 type guard**。

---

## 性能

### 避免 SDK 调用风暴

每个 SDK 调用 = 一次 postMessage round-trip，~5-10ms。

```ts
// ❌
for (const item of items) {
  await Webos.notify({ title: item })   // 100 个 item = 100 个通知
}

// ✅
Webos.notify({ title: '导入完成', message: `共导入 ${items.length} 条` })
```

### 大数据不走 SDK

SDK 调用走 postMessage，数据走 JSON 序列化，**别用它传大对象**：

```ts
// ❌ 别这么干
await Webos.message.send('viewer', { type: 'open', file: bigBlob })  // 序列化卡住

// ✅
const url = URL.createObjectURL(bigBlob)   // 用 blob URL
await Webos.message.send('viewer', { type: 'open', url })
```

但 blob URL 跨 origin 也不能用。终极方案：上传到后端拿个共享 URL。

### iframe 启动慢？

webos 启动应用 = 加载 iframe = 加载完整 HTML / JS / CSS。如果应用本身慢，webos 也救不了。

优化：
- 应用用 Vite 等现代构建（code splitting）
- 关键路径懒加载
- 看 <https://web.dev/lcp/> 等性能指南

---

## 调试

### 打开 RPC debug 日志

```ts
Webos.configure({ debug: true })
```

控制台打出每个请求和响应。**生产环境关闭**。

### iframe 独立调试

直接打开应用 URL（不在 webos 里），SDK 调用全部 timeout（30s 后 reject）—— 用 try/catch 包，弹自家 toast 兜底：

```ts
function bootstrap() {
  try {
    return runInWebos()
  } catch {
    return runStandalone()  // 模拟模式：fake user / fake notify
  }
}
```

### 无父窗口检测

```ts
const isInWebos = window.parent !== window
if (!isInWebos) {
  // 走独立模式
}
```

---

## 不要做的事

- ❌ 监听 `parent.postMessage` 自己解析 webos 协议（用 SDK，别绕过）
- ❌ 在应用里改 iframe 父级 DOM（跨 origin 拿不到，同 origin 也别这么干）
- ❌ 假设 webos shell 永远在某个端口（用 `window.parent.origin` 探测）
- ❌ 在 React `useEffect(() => Webos.xxx.on(...))` 不 return off → 内存泄漏
- ❌ 在 tab 模式应用里调 SDK（永远超时）
- ❌ 把 SDK 实例做成自家全局单例并自定义 `target` —— 99% 场景不用配置；用默认即可
- ❌ 同步调用 SDK（async 就乖乖 await，别 Promise.race / fire-and-forget 关键操作）

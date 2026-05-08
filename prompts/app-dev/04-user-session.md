# 04 · 用户身份 / token / 登录页

webos 跨应用共享用户会话。**登录页写一次，所有应用立即都能读。**

---

## 三种调用上下文（关键概念）

```
同一个域名 + 端口（同 origin → localStorage 共享）

┌──────────────────┐     跳转     ┌─────────────────────────────┐
│  /login.html     │ ─────────→  │  /  (webos shell 主程序)     │
│  独立页面         │             │                             │
│  没有父窗口       │             │  ┌──────────────┐ ┌────────┐│
│                  │             │  │ UserSession  │ │UserMenu││
│  SDK 走 RPC      │             │  │ singleton    │ │右上角  ││
│  连不上 webos     │             │  │ 启动从 LS 恢复│←─直接调 ││
│                  │             │  └──────┬───────┘ └────────┘│
│  ↓ 直接写 LS      │             │         │ broadcast         │
└──────────────────┘             │         ↓                   │
       │                         │  ┌─────────────────────┐    │
       ↓ localStorage:           │  │ iframe 应用（任意栈）│    │
  'webos:user.session'           │  │ Webos.user.* RPC    │    │
       ↓                         │  └─────────────────────┘    │
  webos 启动时读                   └─────────────────────────────┘
```

| 你在哪 | 用什么 API |
|--------|-----------|
| **iframe 业务应用** | `Webos.user.*` 走 SDK postMessage |
| **同 origin 登录页**（独立页面，没有父窗口） | `writeWebosSession` 等纯函数直接写 localStorage |
| **webos shell 内部**（如果你二开 shell） | `UserSession.instance.*` 直接调单例 |

**三条路径走同一个 localStorage key + 同一份 JSON 格式** —— 单一真实来源。

---

## 数据结构

```ts
interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  permissions?: string[]
  [key: string]: unknown   // 业务方扩展字段
}

interface TokenInfo {
  accessToken: string                  // 必填
  refreshToken?: string
  tokenType?: string                   // 'Bearer'
  expiresAt?: number                   // epoch ms 时间戳
  scope?: string
  idToken?: string                     // OIDC
  [key: string]: unknown
}
```

---

## 场景 1 · 独立登录页（同 origin）

最常见：你的 webos 部署在 `app.acme.com/`，登录页是同 origin 的 `app.acme.com/login.html`。

```html
<!-- /login.html -->
<form id="login">
  <input name="username">
  <input name="password" type="password">
  <button>登录</button>
</form>

<script type="module">
import { writeWebosSession, hasWebosSession } from '@webos/host-sdk'

// 已登录就直接进 webos
if (hasWebosSession()) location.href = '/'

document.querySelector('#login').onsubmit = async (e) => {
  e.preventDefault()
  const data = new FormData(e.target)

  // 调你自家 SSO / OAuth 接口
  const r = await fetch('/api/login', {
    method: 'POST',
    body: data,
  }).then(r => r.json())
  // r: { user: {...}, access_token, refresh_token, expires_in, ... }

  // 写到 localStorage（同 origin 与 webos shell 共享）
  writeWebosSession({
    user: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      permissions: r.user.permissions,
    },
    token: {
      accessToken: r.access_token,
      refreshToken: r.refresh_token,
      tokenType: r.token_type ?? 'Bearer',
      expiresAt: Date.now() + r.expires_in * 1000,   // expires_in（秒）→ epoch ms
      scope: r.scope,
    },
  })

  location.href = '/'    // 跳到 webos 桌面
}
</script>
```

webos 启动时，`UserSession` 自动从 LS 读出，所有应用都能立即拿到。

---

## 场景 2 · iframe 应用读 / 写

```ts
import { Webos } from '@webos/host-sdk'

// 启动时检查
const user = await Webos.user.current()
if (!user) {
  location.href = '/login.html'
  return
}

// 调 API 时带 token
const accessToken = await Webos.user.accessToken()
fetch('/api/x', {
  headers: { Authorization: `Bearer ${accessToken}` },
})

// 监听被登出（其他应用 / shell 触发）
const off = Webos.user.on('change', ({ user }) => {
  if (!user) location.href = '/login.html'
})
```

某些应用（如个人资料页）可以**修改 user**：

```ts
const cur = await Webos.user.current()
if (!cur) return
await Webos.user.setUser({
  ...cur,
  name: '新名字',
  avatar: 'https://...',
})
// → broadcast user.changed → 所有应用同步显示新名字
```

---

## 场景 3 · refresh token 流程

应用发现 token 过期 → 用 refresh_token 换新 token → 写回 webos。

```ts
import { Webos } from '@webos/host-sdk'

async function ensureFreshToken() {
  if (!(await Webos.user.isTokenExpired())) return
  const cur = await Webos.user.token()
  if (!cur?.refreshToken) {
    // 没 refresh token 只能重新登录
    location.href = '/login.html'
    return
  }

  const r = await fetch('/api/sso/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: cur.refreshToken }),
  }).then(r => r.json())

  await Webos.user.setToken({
    ...cur,
    accessToken: r.access_token,
    expiresAt: Date.now() + r.expires_in * 1000,
    // refresh-token-rotation：服务端可能给新的 refreshToken
    refreshToken: r.refresh_token ?? cur.refreshToken,
  })
}

// 拦截每个 API 请求
async function api(path: string, init?: RequestInit) {
  await ensureFreshToken()
  const accessToken = await Webos.user.accessToken()
  return fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
```

更稳：用 axios interceptor / fetch wrapper 集中处理 401 + refresh。

---

## 场景 4 · 登出

iframe 应用主动登出：

```ts
await Webos.user.clear()
location.href = '/login.html'
```

webos 主程序的 UserMenu（右上角 👤）已经接好"退出登录"，点击会调 `UserSession.instance.clear()` → broadcast `user.changed (null)` → 所有 iframe 应用收到。

---

## 安全注意

### 没做权限校验

`Webos.user.set/setToken/clear` **任何应用都能调**。生产环境如果担心被某个流氓应用篡改身份：

- 让 webos shell 集成方覆盖 `user.set` 等 handler，校验 `source.appId` 是否在白名单（如只允许 `'login'` / `'sso-callback'` 应用）
- 详见 `prompts/osweb-dev/05-extending-the-sdk.md` 的 "安全 / 信任" 段

### Token 持久化

webos shell 集成方启动时可关掉 LS 持久化：

```ts
// webos shell 启动代码
import { UserSession } from '@webos/shell'
UserSession.instance.setPersist(false)
```

关掉后 token 只在内存，刷新页面就要重新登录。**生产环境的高敏感场景推荐**。

### Token 不要塞进 localStorage 长期保存

跨 origin iframe 应用如果**怕 webos 主域 LS 泄漏**，可以：

- 不用 webos 共享 token，自己应用用 cookie + httpOnly
- 但这样失去"登录一次全应用通用"的好处

平衡选择，看场景。

---

## API 速查（与 02-sdk-cheatsheet 重复，方便快查）

```ts
// 读
Webos.user.current()           // User | null
Webos.user.accessToken()       // string | null
Webos.user.token()             // TokenInfo | null
Webos.user.isTokenExpired()    // boolean
Webos.user.permissions()       // string[]

// 写
Webos.user.set({ user, token })
Webos.user.setUser(user)
Webos.user.setToken(token)
Webos.user.clear()

// 订阅
Webos.user.on('change', ({ user, token }) => { ... })

// 同 origin 登录页（不走 RPC，纯函数）
writeWebosSession({ user, token })
writeWebosUser(user)
writeWebosToken(token)
readWebosSession()       // { user, token }
clearWebosSession()
hasWebosSession()        // boolean
```

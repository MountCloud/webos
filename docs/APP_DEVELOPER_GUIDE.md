# webos 应用开发者指南

把任意 Web 应用接入 webos 桌面壳，让它在 webos 里像桌面应用一样运行。

---

## 1. 心智模型

webos 是一个 **桌面壳 + iframe 容器**：

- 桌面壳（webos shell）：管窗口、任务栏、桌面、通知、对话框、主题
- 你的应用：跑在 iframe 里的任意 Web 应用，**完全不用改业务代码**就能在 webos 里渲染
- 桥梁：`@webos/host-sdk` —— 通过 postMessage 让你的应用调桌面壳的能力

**关键：你的应用代码 95% 都和 webos 无关。** 只在需要弹通知 / 对话框 / 控制窗口时调一下 SDK。

---

## 2. 三步接入

### Step 1：写一个 Web 应用

任何技术栈都行。你已经有的应用直接拿来就能用。

### Step 2：加一行 SDK

```html
<script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
```

或者：

```bash
pnpm add @webos/host-sdk
```

```js
import { Webos } from '@webos/host-sdk'
```

### Step 3：写一个 manifest.json，注册到 webos

```json
{
  "appId": "my-app",
  "name": "我的应用",
  "icon": "/path/to/icon.svg",
  "entries": [
    {
      "id": "main",
      "name": "我的应用",
      "icon": "/path/to/icon.svg",
      "uri": "https://my-app.example.com/",
      "defaultWindow": { "width": 800, "height": 600 }
    }
  ]
}
```

顶层放应用元信息；启动相关字段（`uri` / `launchMode` / `defaultWindow` / 等）写在 `entries[i]` 里。一个应用可以注册多个 entry。详见 [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md)。

把它通过 `AppRegistry.instance.addSource(new JsonAppSource(url))` 注册进 webos shell 即可。详见 [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md)。

---

## 3. 五种栈接入示例

> 仓库 [`examples/`](../examples/) 目录下提供了完整可运行示例。下面只贴关键代码。

### 3.1 纯 HTML（零构建）

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
</head>
<body>
  <button onclick="window.Webos.notify({ title: 'Hi' })">Click</button>
</body>
</html>
```

完整示例：[examples/01-vanilla-html](../examples/01-vanilla-html/)

### 3.2 Vanilla JS + Vite

```js
// src/main.js
import { Webos } from '@webos/host-sdk'

document.querySelector('#btn').addEventListener('click', () => {
  Webos.notify({ title: '保存成功', level: 'success' })
})
```

完整示例：[examples/02-vanilla-js-vite](../examples/02-vanilla-js-vite/)

### 3.3 Vue 3（JS）

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { Webos } from '@webos/host-sdk'

let off
onMounted(() => {
  off = Webos.theme.on('change', (t) => console.log('theme:', t))
})
onBeforeUnmount(() => off?.())

const greet = async () => {
  const name = await Webos.dialog.prompt('你叫啥?', 'World')
  if (name) Webos.notify({ title: `你好 ${name}` })
}
</script>

<template>
  <button @click="greet">打招呼</button>
</template>
```

完整示例：[examples/03-vue-js](../examples/03-vue-js/)

### 3.4 React + TypeScript

```tsx
import { useEffect } from 'react'
import { Webos, type SystemInfo } from '@webos/host-sdk'

export function App() {
  useEffect(() => {
    return Webos.theme.on('change', (t) => console.log('theme:', t))
  }, [])

  return <button onClick={() => Webos.notify({ title: 'Hi' })}>Click</button>
}
```

完整示例：[examples/04-react-ts](../examples/04-react-ts/)

### 3.5 jQuery + UMD（老项目）

```html
<script src="jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
<script>
  $(function () {
    $('#btn').on('click', function () {
      window.Webos.notify({ title: 'Hi from jQuery' });
    });
  });
</script>
```

完整示例：[examples/05-jquery-legacy](../examples/05-jquery-legacy/)

### 3.6 React + MUI（**生产推荐**）

```tsx
import { WebosThemeProvider } from '@webos/mui-theme'
import { Webos } from '@webos/host-sdk'
import { Button } from '@mui/material'

function App() {
  return (
    <Button variant="contained" onClick={() =>
      Webos.notify({ title: '保存成功', level: 'success' })
    }>
      保存
    </Button>
  )
}

createRoot(root).render(
  <WebosThemeProvider>
    <App />
  </WebosThemeProvider>,
)
```

`@webos/mui-theme` 的 `<WebosThemeProvider>` 自动把 webos 设计 token 翻译成 MUI Theme 并跟随桌面主题切换。**MUI 应用的颜色 / 圆角 / 字体 / 深浅模式都和 webos 一致**。详见 [MUI_INTEGRATION.md](./MUI_INTEGRATION.md)。

完整示例：[examples/06-react-mui](../examples/06-react-mui/)

---

## 4. 常见接入模式

### 把应用关键操作绑到 webos 上下文菜单

```js
document.addEventListener('contextmenu', async (e) => {
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
  if (action === 'export') await exportDoc()
  if (action === 'delete') await del()
})
```

### 跟随主题变化

```js
// 应用启动时同步当前主题
Webos.theme.current().then(applyTheme)

// 之后跟随推送
Webos.theme.on('change', applyTheme)

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
}
```

### 处理"未保存离开"

```js
let dirty = false

// 用户点窗口关闭按钮时，桌面壳会先发 beforeClose 事件
Webos.events.on('window.beforeClose', async (e) => {
  if (!dirty) return
  const ok = await Webos.dialog.confirm('有未保存的修改，仍要关闭吗？')
  if (!ok) e.cancel = true   // V1.5：当前版本无法阻止，仅作示意
})
```

### 跨应用消息

让你的"邮件"应用接到"日历"应用的"打开会议"指令：

```js
// 日历应用
await Webos.message.send('mail', {
  type: 'compose',
  to: 'someone@example.com',
  subject: '会议邀请',
})

// 邮件应用
Webos.message.on((msg, from) => {
  if (from === 'calendar' && msg.type === 'compose') {
    openCompose(msg)
  }
})
```

### 注册子功能让搜索能直达

manifest 在 `entries[i].features` 下声明，让全局搜索（Cmd/Ctrl+K）能直接进应用内具体页面：

```json
{
  "appId": "com.acme.crm",
  "name": "CRM",
  "entries": [
    {
      "id": "main",
      "name": "CRM",
      "icon": "...",
      "uri": "https://crm.acme.com/",
      "features": [
        {
          "id": "new-customer", "name": "新建客户", "uri": "/customers/new",
          "keywords": ["新建", "客户"]
        },
        { "id": "reports", "name": "销售报表", "uri": "/reports", "category": "报表" }
      ]
    }
  ]
}
```

应用代码处理"已运行时被深链"：

```ts
import { Webos } from '@webos/host-sdk'

// 启动时拿首次进入的 feature
const info = await Webos.app.bootInfo()
if (info.feature === 'reports') router.push('/reports')

// 已运行时被点搜索结果跳转
Webos.app.onNavigate(({ feature, uri }) => {
  router.push(uri ?? '/')
})
```

详见 [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md)。

### 应用控制自己的窗口大小

```ts
// 改尺寸
await Webos.window.setSize(800, 600)
await Webos.window.center()    // 重新居中

// 自适应内容
const content = document.querySelector('main')
const bounds = await Webos.window.getBounds()
await Webos.window.setSize(bounds.width, content.scrollHeight + 80)
```

manifest 的 `entries[i].defaultWindow` 只是**首次启动的默认值**，应用任何时候都可以自己调。

### 用户身份 / token 共享

`Webos.user` 是跨应用的会话单例：登录页 / 任意应用写一次，**所有应用立即都能读**。

```ts
// 应用启动时检查
const user = await Webos.user.current()
if (!user) location.href = '/login.html'

// 调 API 时带 token
const accessToken = await Webos.user.accessToken()
fetch('/api/x', { headers: { Authorization: `Bearer ${accessToken}` } })

// 监听被登出
Webos.user.on('change', ({ user }) => {
  if (!user) location.href = '/login.html'
})

// refresh token 流程
if (await Webos.user.isTokenExpired()) {
  const cur = await Webos.user.token()
  const r = await refresh(cur!.refreshToken!)
  await Webos.user.setToken({
    ...cur!,
    accessToken: r.access_token,
    expiresAt: Date.now() + r.expires_in * 1000,
  })
}
```

**同 origin 登录页**（与 webos 同协议 + 同域 + 同端口）—— 不需要 iframe 上下文，直接用纯函数：

```ts
import { writeWebosSession } from '@webos/host-sdk'

const r = await fetch('/api/login', ...).then(r => r.json())
writeWebosSession({
  user: { id: r.id, name: r.name, ... },
  token: { accessToken: r.access_token, refreshToken: r.refresh_token,
           expiresAt: Date.now() + r.expires_in * 1000 },
})
location.href = '/'
```

完整 API 见 [HOST_SDK_API.md - Webos.user](./HOST_SDK_API.md#webosuser)。

### 长任务 + 忙碌指示

```js
async function importBigFile(file) {
  await Webos.window.setBusy(true)
  try {
    await heavyParse(file)
    Webos.notify({ title: '导入完成', level: 'success' })
  } catch (err) {
    Webos.notify({ title: '导入失败', message: err.message, level: 'critical' })
  } finally {
    await Webos.window.setBusy(false)
  }
}
```

---

## 5. 调试技巧

### 打开 RPC debug 日志

```js
Webos.configure({ debug: true })
```

控制台会打出每个请求和响应。

### 调用未包装的方法

```js
// 直接走底层 client（绕过 SDK 封装）
const r = await Webos.client.call('myModule', 'doSomething', { foo: 1 })
```

### 在 webos shell 里加自定义 handler

```ts
import { AppMessageBus } from '@webos/shell'

AppMessageBus.instance.registerHandler('myModule', 'doSomething', async (req) => {
  return { echo: req.args }
})
```

---

## 6. 常见坑

| 坑 | 解决 |
|----|------|
| `RPC timeout` | 应用没在 iframe 里跑（脱离了桌面壳）；或 handler 没注册 |
| `appId` 推断错误 | 显式调 `Webos.configure({ appId: 'my-app' })` |
| 主题切换后样式没变 | 你的应用没订阅 `Webos.theme.on('change')` |
| 跨域 iframe 无法读取 cookie | 这是浏览器限制，不是 webos 限制；用 `Webos.user.token()` 拿 token 自己带 |
| postMessage 被 CSP 拦 | 桌面壳的页面需要 `frame-src` 允许你的 entry 域名 |

---

## 7. 进阶

- 想内嵌 webos 到自己的产品里：见 [`apps/webos-shell/src/main.ts`](../apps/webos-shell/src/main.ts) 的 `bootstrap()` 入口
- 想发布自己的应用商店：实现一个自定义 `AppSource`，从你后端拉 manifest 列表
- 想加企业 SSO：覆盖 `user.current` / `user.token` 这两个 handler

详见 [架构文档](./ARCHITECTURE.md)。

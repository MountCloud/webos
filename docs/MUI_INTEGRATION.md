# React + MUI 应用开发指南（推荐生产用法）

把一个 React + MUI 应用接进 webos —— 三步走：装包、套 Provider、调 SDK。

> 这是用 MUI 时的**官方推荐**集成方式。你的应用看上去就像 webos 桌面的原生应用：主题、圆角、字体、深色模式都自动同步。

---

## 1. 装包

```bash
pnpm add @webos/host-sdk @webos/mui-theme @mui/material @emotion/react @emotion/styled
# 可选：图标
pnpm add @mui/icons-material
```

依赖关系：

| 包 | 角色 |
|----|------|
| `@webos/host-sdk` | 与 webos 桌面壳通信（通知 / 对话框 / 窗口控制 / 跨应用消息 ...） |
| `@webos/mui-theme` | 把 webos 设计 token 翻译成 MUI Theme，并自动同步主题切换 |
| `@mui/material` + emotion | MUI 本身 |

`@webos/mui-theme` 的 peer 是 React 18+ / 19、MUI 5/6。Vue / 纯 JS 应用不要用这个包。

---

## 2. 套 Provider

```tsx
// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WebosThemeProvider } from '@webos/mui-theme'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebosThemeProvider>
      <App />
    </WebosThemeProvider>
  </React.StrictMode>,
)
```

`WebosThemeProvider` 内部做的事：

1. 启动时调 `Webos.theme.current()` 拿当前主题（深 / 浅）
2. 订阅 `Webos.theme.on('change')`，shell 切主题 → MUI 跟着切
3. 在 MUI 的 `ThemeProvider` 里注入 `createWebosTheme(mode)` 编译出来的主题
4. 默认带 MUI 的 `<CssBaseline />`（不要可以关：`<WebosThemeProvider cssBaseline={false}>`）
5. 不在 webos 里运行（独立打开调试）时，fallback 到 `prefers-color-scheme`

业务代码里**直接**用 MUI，没有任何额外 API：

```tsx
import { Button, Card, TextField } from '@mui/material'
import { Webos } from '@webos/host-sdk'

export default function App() {
  return (
    <Card>
      <TextField label="姓名" />
      <Button variant="contained" onClick={() => Webos.notify({ title: '保存成功' })}>
        保存
      </Button>
    </Card>
  )
}
```

按钮颜色是 webos 的主色，圆角是 webos 的 `--webos-radius-md`，字体是 webos 的字体栈 —— 跟桌面壳完全一致。

---

## 3. 调 SDK 完成与桌面壳的交互

### 3.1 通知（Webos.notify）

```ts
Webos.notify({ title: '保存成功', level: 'success' })
Webos.notify({
  title: '高危事件',
  message: '检测到 U 盘插入',
  level: 'critical',
  duration: 0, // 0 = 不自动关闭
})
```

四种 level：`info` / `success` / `warning` / `critical`，对应不同左边色条。同屏最多堆 5 条，超出会把最旧的关掉。

### 3.2 对话框（Webos.dialog）

**简单 alert / confirm / prompt**：

```ts
await Webos.dialog.alert('文件已保存')
const ok = await Webos.dialog.confirm('确认删除？')
const name = await Webos.dialog.prompt('请输入名字', 'Alice')
```

**自定义按钮文字 + 图标 + 危险样式**：

```ts
const ok = await Webos.dialog.confirm({
  title: '永久删除',
  message: '即将永久删除 12 个文件，此操作不可撤销。',
  icon: 'warning', // info / warning / danger / success / question / 任意 URL
  confirmText: '永久删除',
  cancelText: '保留',
  danger: true,
})
```

**完全自定义按钮列表**：

```ts
const action = await Webos.dialog.show<'save' | 'discard' | 'cancel'>({
  title: '保存修改？',
  message: '当前页面有未保存的修改。',
  icon: 'question',
  buttons: [
    { label: '不保存', value: 'discard', type: 'danger' },
    { label: '取消', value: 'cancel', type: 'secondary', cancel: true }, // Esc
    { label: '保存', value: 'save', type: 'primary', autoFocus: true },   // Enter
  ],
})
if (action === 'save') save()
```

`cancel: true` 的按钮会接管 Esc 键 + 窗口右上 ×；`autoFocus: true` 的接管 Enter 键。

**带校验的 prompt**：

```ts
import { Webos } from '@webos/host-sdk'

const r = await Webos.dialog.promptEx({
  message: '邮箱',
  defaultValue: 'me@example.com',
  validate: (v) => /^[^@]+@[^@]+$/.test(v) || '邮箱格式不正确',
})
// r = { button: '__confirm__', value: 'me@example.com' } | { value: null }
```

完整 dialog 选项见 [HOST_SDK_API.md - dialog](./HOST_SDK_API.md#webosdialog)。

### 3.3 窗口控制（Webos.window）

应用控制**自己**的窗口：

```ts
await Webos.window.setTitle(`未保存 - ${docName}`) // 改标题栏文字
await Webos.window.setBusy(true)                    // 显示忙碌遮罩
try {
  await heavyJob()
} finally {
  await Webos.window.setBusy(false)
}

await Webos.window.minimize()
await Webos.window.maximize()
await Webos.window.restore()
await Webos.window.close()
```

### 3.4 主题（除了自动同步外的高级用法）

`WebosThemeProvider` 已自动同步主题。如果你想**主动切**：

```tsx
import { Switch } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Webos } from '@webos/host-sdk'

function ThemeToggle() {
  const t = useTheme()
  return (
    <Switch
      checked={t.palette.mode === 'dark'}
      onChange={async () => {
        const cur = await Webos.theme.current()
        await Webos.theme.set(cur === 'dark' ? 'light' : 'dark')
      }}
    />
  )
}
```

切换效果：webos shell + 你的应用 + 同时打开的所有应用，**全部一起变色**。

### 3.5 上下文菜单（右键菜单）

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
      { actionId: 'delete', label: '删除', danger: true },
    ],
  })
  if (action === 'copy') doCopy()
})
```

### 3.6 跨应用消息

```ts
// 应用 A
await Webos.message.send('mail', { type: 'compose', to: 'a@example.com' })

// 应用 B
useEffect(() => {
  const off = Webos.message.on((msg, fromAppId) => {
    if (fromAppId === 'A' && msg.type === 'compose') openCompose(msg)
  })
  return off
}, [])
```

### 3.7 全局事件广播

```ts
// 触发
await Webos.events.emit('config.changed', { key: 'locale', value: 'en' })

// 订阅（任意应用）
useEffect(() => {
  const off = Webos.events.on('config.changed', (payload: any) => {
    if (payload.key === 'locale') location.reload()
  })
  return off
}, [])
```

webos 内置的事件：`theme.changed` —— 主题切换时广播，payload `{ theme: 'light' | 'dark' }`。

### 3.8 应用维度的 KV 存储

```ts
await Webos.storage.set('settings', { autoSave: true, theme: 'auto' })
const settings = await Webos.storage.get<{ autoSave: boolean; theme: string }>('settings')
await Webos.storage.remove('settings')
```

按 `appId` 隔离：你的应用读不到别人的 storage。

### 3.9 系统信息

```ts
const info = await Webos.system.info()
// { version, platform, locale, theme, userAgent }
```

---

## 4. React 里的最佳实践

### 4.1 把订阅放进 `useEffect`，return 解绑

```tsx
useEffect(() => {
  const off = Webos.theme.on('change', (t) => console.log(t))
  return off
}, [])
```

`Webos.theme.on` / `Webos.events.on` / `Webos.message.on` 返回的都是 unsubscribe 函数 —— 直接 return 就好。

### 4.2 用 React Query / SWR 包 SDK 调用

```tsx
import { useQuery } from '@tanstack/react-query'

function AppList() {
  const { data } = useQuery({
    queryKey: ['apps'],
    queryFn: () => Webos.apps.list(),
  })
  return <List>{data?.map((a) => <ListItem key={a.appId}>{a.name}</ListItem>)}</List>
}
```

### 4.3 错误处理

```ts
try {
  await Webos.dialog.openFile()
} catch (err: any) {
  if (err.code === 'NOT_IMPLEMENTED') {
    Webos.notify({ title: '功能即将上线', level: 'info' })
  } else {
    Webos.notify({ title: '出错了', message: err.message, level: 'critical' })
  }
}
```

错误对象带 `code` 字段：`NOT_FOUND` / `NOT_IMPLEMENTED` / `INVALID_ARGS` / `PERMISSION_DENIED` / `TIMEOUT` / `HANDLER_ERROR`。

### 4.4 在 `<WebosThemeProvider>` 之外覆盖主题

少数场景想在某子树用浅色（比如打印预览）：

```tsx
import { ThemeProvider } from '@mui/material/styles'
import { createWebosTheme } from '@webos/mui-theme'

const printTheme = createWebosTheme({ mode: 'light' })

<ThemeProvider theme={printTheme}>
  <PrintArea />
</ThemeProvider>
```

`createWebosTheme({ mode, overrides })` 的 `overrides` 走 MUI 的 `createTheme(base, overrides)`，可以覆盖任意字段。

---

## 5. 注册到 webos

写个 `manifest.json`：

```json
{
  "appId": "com.acme.crm",
  "name": "CRM",
  "icon": "https://cdn.acme.com/icons/crm.svg",
  "entries": [
    {
      "id": "main",
      "name": "CRM",
      "icon": "https://cdn.acme.com/icons/crm.svg",
      "uri": "https://crm.acme.com/",
      "defaultWindow": { "width": 1200, "height": 800 },
      "permissions": ["notify", "dialog", "window", "storage", "user.read"],
      "showIn": ["desktop", "start-menu"]
    }
  ]
}
```

然后让 webos shell 拉到这份 manifest（两种方式见 [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md)）。

---

## 6. 调试技巧

### 在 webos 里跑

```bash
pnpm --filter @webos/shell dev          # webos shell at :5173
pnpm --filter your-app dev              # 你的应用 at :5xxx
```

把 manifest 的 `entry` 指向 `http://localhost:5xxx/`，刷 webos 页面即可。

### 独立调试（脱离 webos shell）

直接 `pnpm dev` 打开。`@webos/mui-theme` 会自动 fallback 到系统深浅模式，所有 SDK 调用因为 `window.parent === window` 会**超时 reject**。把它包进 try/catch 或者按"模拟模式"开发。

### 打开 RPC 调试日志

```ts
Webos.configure({ debug: true })
```

控制台会打出每条 RPC 请求和响应。

---

## 7. 完整示例

仓库 [examples/06-react-mui](../examples/06-react-mui/) 是一个**完整可运行**的 React + MUI 接入示例，演示：

- `WebosThemeProvider` 主题同步
- 4 种 level 通知
- alert / confirm / prompt / show（自定义按钮）
- 窗口标题修改、最小化、关闭
- 跨应用消息广播
- AppBar / Card / Table / Chip / Switch / TextField 等 MUI 组件用 webos 主题

跑起来：

```bash
pnpm install
pnpm --filter example-react-mui dev
```

或者用 `pnpm dev:all` 一键起 shell + 全部示例。

---

## 8. 体积参考

| 包 | gzip 体积 |
|-----|-----------|
| `@webos/host-sdk` | ~5 KB |
| `@webos/mui-theme` | ~3 KB（不含 MUI） |
| `@mui/material` + emotion | ~110 KB |
| React 18 | ~45 KB |

总：~163 KB gzip 起步，跟主流 React 后台模板（如 ant-design-pro）持平 —— 但你拿到的是**与桌面壳深度集成**的应用。

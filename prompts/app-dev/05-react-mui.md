# 05 · React + MUI 推荐用法

如果你的应用是 React + MUI，**这是生产推荐组合**。`@webos/mui-theme` 一行 Provider 让 MUI 主题跟 webos 桌面联动。

---

## 装包

```bash
pnpm add @webos/host-sdk @webos/mui-theme @mui/material @emotion/react @emotion/styled
# 可选：图标
pnpm add @mui/icons-material
```

| 包 | 作用 |
|----|------|
| `@webos/host-sdk` | 与 webos 通信的核心 SDK |
| `@webos/mui-theme` | webos 设计 token → MUI Theme 的桥梁 + 自动主题同步 hook |
| `@mui/material` + emotion | MUI 本体 |

`@webos/mui-theme` peer：React 18+/19、MUI v5/v6。Vue / 纯 JS 应用别装这个。

---

## 套 Provider（一次接入）

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
1. 调 `Webos.theme.current()` 拿当前主题
2. 订阅 `Webos.theme.on('change')` 跟随切换
3. 在 MUI `ThemeProvider` 里注入 `createWebosTheme(mode)` 编译的主题
4. 默认带 `<CssBaseline />`（不要可关：`<WebosThemeProvider cssBaseline={false}>`）
5. 不在 webos 里运行（独立调试）时 fallback 到 `prefers-color-scheme`

业务代码**直接用 MUI**，没有任何额外 API：

```tsx
import { Button, TextField, Card } from '@mui/material'
import { Webos } from '@webos/host-sdk'

export function App() {
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

按钮颜色 / 圆角 / 字体 / 深浅模式都跟 webos 一致 —— **无额外代码**。

---

## React useEffect 必备模式

### 订阅 webos 事件，return 反订阅

```tsx
useEffect(() => {
  const off = Webos.user.on('change', ({ user }) => {
    if (!user) navigate('/login')
  })
  return off       // ← 直接 return SDK 给的 unsubscribe 函数
}, [])
```

`Webos.xxx.on()` 返回的就是 `() => void` unsubscribe，不用包 cleanup 函数。

### 异步初始化用 effect + flag

```tsx
useEffect(() => {
  let cancelled = false
  Webos.app.bootInfo().then((info) => {
    if (cancelled) return
    if (info.feature === 'reports') navigate('/reports')
  })
  return () => { cancelled = true }
}, [])
```

防 effect 已 cleanup 后 promise 才 resolve 触发 setState。

### 用 React Query / SWR 包 SDK 调用

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

---

## 主题手动切换（业务场景）

应用内某处放个 Switch 让用户切 webos 主题（影响整个桌面 + 所有应用）：

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

切换效果：webos shell + 你的应用 + 其他应用，**全部一起变色**。

---

## 子树覆盖主题（少数场景）

某子树想用浅色（如打印预览）：

```tsx
import { ThemeProvider } from '@mui/material/styles'
import { createWebosTheme } from '@webos/mui-theme'

const printTheme = createWebosTheme({ mode: 'light' })

<ThemeProvider theme={printTheme}>
  <PrintArea />
</ThemeProvider>
```

`createWebosTheme({ mode, overrides })` 的 `overrides` 走 MUI 的 `createTheme(base, overrides)`，覆盖任意字段：

```tsx
const theme = createWebosTheme({
  mode: 'light',
  overrides: {
    palette: {
      primary: { main: '#ff0066' },   // 自家品牌色
    },
  },
})
```

---

## 完整骨架（生产用）

```tsx
// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WebosThemeProvider } from '@webos/mui-theme'
import App from './App'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebosThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </WebosThemeProvider>
  </React.StrictMode>,
)
```

```tsx
// App.tsx
import { useEffect } from 'react'
import { useNavigate, Routes, Route } from 'react-router-dom'
import { Webos } from '@webos/host-sdk'
import { AppShell } from './AppShell'
import { Dashboard } from './pages/Dashboard'
import { Reports } from './pages/Reports'

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    // 启动信息：是不是被某 feature 唤起
    Webos.app.bootInfo().then((info) => {
      if (info.feature === 'reports') navigate('/reports')
    })

    // 已运行被深链调起
    const off = Webos.events.on('app.navigate', (payload) => {
      const p = payload as { uri?: string }
      navigate(p.uri ?? '/')
    })

    // 被登出
    const offUser = Webos.user.on('change', ({ user }) => {
      if (!user) location.href = '/login.html'
    })

    return () => { off(); offUser() }
  }, [])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </AppShell>
  )
}
```

---

## 体积参考

| | gzip 体积 |
|--|-----------|
| `@webos/host-sdk` | ~5 KB |
| `@webos/mui-theme` | ~3 KB（不含 MUI） |
| `@mui/material` + emotion | ~110 KB |
| React 18 | ~45 KB |

**总：~163 KB gzip 起步**，跟主流 React 后台模板（如 ant-design-pro）持平 —— 但你拿到的是**与桌面壳深度集成**的应用。

---

## 完整可运行示例

仓库的 [`examples/06-react-mui/`](../../examples/06-react-mui/) 是开箱即用的样板。直接抄。

跑：

```bash
pnpm --filter example-react-mui dev      # http://localhost:5504
```

或在 webos 里看（已注册）：访问 <http://localhost:5173>，桌面双击"🎨 React + MUI 示例"。

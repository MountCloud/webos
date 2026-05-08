# 示例 06 - React + MUI（推荐生产用法）

React 18 + TypeScript + Vite + **MUI v5** + `@webos/mui-theme` —— 一行 Provider 让 MUI 跟 webos 主题联动。

## 怎么跑

```bash
pnpm install
pnpm dev   # http://localhost:5504
```

## 关键代码

### 1. main.tsx —— 一个 Provider 解决主题同步

```tsx
import { WebosThemeProvider } from '@webos/mui-theme'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WebosThemeProvider>
    <App />
  </WebosThemeProvider>,
)
```

底层做的事：
- 调 `Webos.theme.current()` 拿当前主题
- 订阅 `Webos.theme.on('change')` 跟着切换
- 把 webos 的设计 token（颜色 / 圆角 / 字体）映射成 MUI Theme
- 不在 webos 里时 fallback 到 `prefers-color-scheme`

### 2. 业务组件直接用 MUI

```tsx
import { Button, TextField, Card } from '@mui/material'
import { Webos } from '@webos/host-sdk'

<Button variant="contained" onClick={() => Webos.notify({ title: 'Hi' })}>
  按钮
</Button>
```

MUI 组件自动用 webos 主题色，深色 / 浅色切换零代码。

### 3. SDK 高级用法

```tsx
// 自定义按钮的对话框
const action = await Webos.dialog.show<'save' | 'discard' | 'cancel'>({
  title: '保存修改？',
  icon: 'question',
  buttons: [
    { label: '不保存', value: 'discard', type: 'danger' },
    { label: '取消', value: 'cancel', cancel: true },
    { label: '保存', value: 'save', type: 'primary', autoFocus: true },
  ],
})
```

完整 SDK API 见 [docs/HOST_SDK_API.md](../../docs/HOST_SDK_API.md)。
完整 MUI 集成指南见 [docs/MUI_INTEGRATION.md](../../docs/MUI_INTEGRATION.md)。

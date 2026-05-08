# __DISPLAY_NAME__

由 [`create-webos-app`](https://www.npmjs.com/package/create-webos-app) 生成的 webos 应用 · **React + MUI · TypeScript**

## 启动

```bash
pnpm install
pnpm dev       # http://localhost:5173
```

## 注册到 webos

把 `manifest.json` 注册到 webos shell（详见 webos 文档）。

## 关键代码

`src/main.tsx` 用 `<WebosThemeProvider>` 让 MUI 主题跟随 webos 桌面切换：

```tsx
import { WebosThemeProvider } from '@webos/mui-theme'

<WebosThemeProvider>
  <App />
</WebosThemeProvider>
```

`src/App.tsx` 用 `Webos.*` 调桌面壳能力（带 TypeScript 类型）：

```tsx
import { Webos, type User } from '@webos/host-sdk'

const [user, setUser] = useState<User | null>(null)
useEffect(() => Webos.user.on('change', ({ user }) => setUser(user)), [])
```

## 文档

- [webos 应用开发者指南](https://github.com/MountCloud/webos/blob/main/docs/APP_DEVELOPER_GUIDE.md)
- [SDK API 参考](https://github.com/MountCloud/webos/blob/main/docs/HOST_SDK_API.md)
- [MUI 集成](https://github.com/MountCloud/webos/blob/main/docs/MUI_INTEGRATION.md)

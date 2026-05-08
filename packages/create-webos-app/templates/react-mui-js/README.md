# __DISPLAY_NAME__

由 [`create-webos-app`](https://www.npmjs.com/package/create-webos-app) 生成的 webos 应用 · **React + MUI · JavaScript**

## 启动

```bash
pnpm install   # 或 npm install / yarn
pnpm dev       # http://localhost:5173
```

## 注册到 webos

把 `manifest.json` 注册到 webos shell：

```ts
// webos shell 启动代码
import { AppRegistry, JsonAppSource } from '@webos/shell'

AppRegistry.instance.addSource(new JsonAppSource('/api/apps.json'))
// 或静态注册
import myManifest from './my-app/manifest.json'
AppRegistry.instance.addSource(new StaticAppSource([myManifest]))
```

详见 [webos APP_MANIFEST_SPEC.md](https://github.com/MountCloud/webos/blob/main/docs/APP_MANIFEST_SPEC.md)。

## 关键代码

`src/main.jsx` 用 `<WebosThemeProvider>` 让 MUI 主题跟随 webos 桌面切换：

```jsx
import { WebosThemeProvider } from '@webos/mui-theme'

<WebosThemeProvider>
  <App />
</WebosThemeProvider>
```

`src/App.jsx` 用 `Webos.*` 调桌面壳能力：

```jsx
import { Webos } from '@webos/host-sdk'

Webos.notify({ title: '保存成功', level: 'success' })
const ok = await Webos.dialog.confirm('确认删除？')
const user = await Webos.user.current()
```

## 文档

- [webos 应用开发者指南](https://github.com/MountCloud/webos/blob/main/docs/APP_DEVELOPER_GUIDE.md)
- [SDK API 参考](https://github.com/MountCloud/webos/blob/main/docs/HOST_SDK_API.md)
- [MUI 集成](https://github.com/MountCloud/webos/blob/main/docs/MUI_INTEGRATION.md)

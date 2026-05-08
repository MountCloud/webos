# 01 · 三步接入

写应用 → 装 SDK → 写 manifest 注册到 webos shell。

---

## Step 1 · 你已经有应用了

webos 不强求技术栈：React / Vue / Svelte / Angular / 纯 HTML / jQuery / WASM 都能跑。**99% 的代码不用改。**

如果还没应用，挑你最熟的栈搭一个 SPA 即可。webos 仓库里 `examples/` 下有 6 个示例可直接抄：

| 示例 | 适合 |
|------|------|
| [examples/01-vanilla-html](../../examples/01-vanilla-html/) | 纯 HTML + CDN，零构建（最简） |
| [examples/02-vanilla-js-vite](../../examples/02-vanilla-js-vite/) | Vanilla JS + Vite ESM |
| [examples/03-vue-js](../../examples/03-vue-js/) | Vue 3 + JS |
| [examples/04-react-ts](../../examples/04-react-ts/) | React 18 + TypeScript |
| [examples/05-jquery-legacy](../../examples/05-jquery-legacy/) | jQuery + UMD（老项目无痛接入） |
| [examples/06-react-mui](../../examples/06-react-mui/) | ⭐ React + MUI（**生产推荐**） |

## Step 2 · 装 SDK

### 用 npm（推荐）

```bash
pnpm add @webos/host-sdk
# React + MUI 场景再加（强烈推荐）
pnpm add @webos/mui-theme @mui/material @emotion/react @emotion/styled
```

### 用 CDN UMD（零构建场景）

```html
<script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
<script>
  window.Webos.notify({ title: 'Hi' })
</script>
```

UMD 把 SDK 暴露在 `window.Webos`，与 ESM 的 `import { Webos }` 是同一个对象。

### SDK 自动 install

第一次调用 `Webos.xxx.foo()` 时 SDK 会自动 `install()`（监听父窗口 message）。**不需要手动 init**。

如要调试 RPC：

```ts
Webos.configure({ debug: true })
```

控制台打出每条请求和响应。

## Step 3 · 写 manifest 注册到 webos

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
      "showIn": ["desktop", "start-menu"],
      "permissions": ["notify", "dialog", "user.read", "user.token"]
    }
  ]
}
```

顶层放应用元信息（`appId` / `name` / `icon` 等），启动相关字段全在 `entries[i]` 里。一个应用可以注册多个 entry，每个 entry = 一个独立的桌面图标 / 启动方式。

webos 集成方那侧（不一定是你）通过 `AppRegistry` 把 manifest 加进去：

```ts
// webos shell 启动代码
import { AppRegistry, JsonAppSource } from '@webos/shell'

AppRegistry.instance.addSource(new JsonAppSource('/api/apps.json'))
```

`/api/apps.json` 返回 `[manifest1, manifest2, ...]`。后端按用户权限过滤即可。

完整字段说明：[03-manifest.md](./03-manifest.md)

---

## 最小 demo

跑通 "应用接入 webos" 三件套的最小代码：

```html
<!-- my-app/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
</head>
<body>
  <button id="btn">弹通知</button>
  <script>
    document.querySelector('#btn').onclick = () => {
      window.Webos.notify({ title: 'Hello', message: '我是来自 my-app 的通知', level: 'success' })
    }
  </script>
</body>
</html>
```

```json
// my-app/manifest.json
{
  "appId": "my-app",
  "name": "我的应用",
  "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%232c5282'/><text x='32' y='44' font-size='32' text-anchor='middle' fill='%23fff'>📦</text></svg>",
  "entries": [
    {
      "id": "main",
      "name": "我的应用",
      "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%232c5282'/><text x='32' y='44' font-size='32' text-anchor='middle' fill='%23fff'>📦</text></svg>",
      "uri": "http://localhost:5500/index.html",
      "defaultWindow": { "width": 600, "height": 400 }
    }
  ]
}
```

把 manifest 灌给 webos shell（让集成方加），双击桌面图标就能看到。

---

## 怎么选栈？

| 你的情况 | 推荐 |
|----------|------|
| 已经有 React + MUI 应用 | **保留 MUI，加 `@webos/mui-theme`**（拿主题联动）。看 [05](./05-react-mui.md) |
| React + 自家组件库 / Tailwind | 装 `@webos/host-sdk` 即可，主题不联动也能跑 |
| Vue 应用 | 装 `@webos/host-sdk`；Vue 主题适配还没出，目前可手动订阅 `Webos.theme.on('change')` 切自家主题 |
| 老 jQuery 项目 | UMD 一行 script 就接入，零改造（看 examples/05） |
| 全新项目 | React + MUI + `@webos/mui-theme`（生产推荐组合） |

---

## 应用启动后的"自检"

应用第一次跑起来，建议三件事：

```ts
import { Webos } from '@webos/host-sdk'

async function bootstrap() {
  // 1. 拿启动信息（自己是谁、是哪个 entry、是不是被某个 feature 唤起的）
  const info = await Webos.app.bootInfo()
  console.log('我是', info.appId, '/', info.entryId, 'feature:', info.feature)

  // 2. 检查是否已登录
  const user = await Webos.user.current()
  if (!user) {
    location.href = '/login.html'
    return
  }

  // 3. 跟随主题
  const theme = await Webos.theme.current()
  document.documentElement.dataset.theme = theme
  Webos.theme.on('change', (t) => document.documentElement.dataset.theme = t)

  // 4. 启动业务
  startApp()
}

bootstrap()
```

完整 SDK API 速查：[02-sdk-cheatsheet.md](./02-sdk-cheatsheet.md)

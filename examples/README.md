# webos 示例应用

五个示例展示如何把不同技术栈的应用接入 webos 桌面壳。

| 示例 | 技术栈 | 构建 | 端口 | 适用场景 |
|------|--------|------|------|----------|
| [01-vanilla-html](./01-vanilla-html/) | 纯 HTML + UMD | ❌ 无 | - | 最简接入，零依赖 |
| [02-vanilla-js-vite](./02-vanilla-js-vite/) | Vanilla JS + Vite | ✅ | 5501 | 不想要框架但要打包 |
| [03-vue-js](./03-vue-js/) | Vue 3 + JS | ✅ | 5502 | Vue 团队 |
| [04-react-ts](./04-react-ts/) | React 18 + TS | ✅ | 5503 | React + 类型安全 |
| [05-jquery-legacy](./05-jquery-legacy/) | jQuery + UMD | ❌ 无 | - | 老项目渐进式迁移 |

## 快速试

```bash
# 在 webos 仓库根目录
pnpm install

# 启动 webos shell
pnpm --filter @webos/shell dev

# 在另一个终端起任意一个示例（以 React 为例）
pnpm --filter example-react-ts dev
```

然后在 webos 内打开"开始 → SDK 演示"或在 `apps/webos-shell/src/main.ts` 里把对应示例的 `manifest.json` 添加到 `getDemoApps()`。

## 共同点

每个示例都演示了至少这些 SDK 能力：

- `Webos.notify()` —— 桌面通知（4 种 level）
- `Webos.dialog.alert/confirm/prompt()` —— 对话框
- `Webos.window.setTitle/minimize/close()` —— 窗口控制
- `Webos.system.info()` —— 系统信息
- `Webos.apps.list()` —— 已注册应用
- `Webos.theme.current/set/on()` —— 主题
- `Webos.message.send/on()` —— 跨应用消息（部分示例）

## 接入 webos

### 2. ESM（推荐）

```bash
pnpm add @webos/host-sdk
```

```js
import { Webos } from '@webos/host-sdk'
Webos.notify({ title: 'Hi' })
```

## 文档

- [SDK API 参考](../docs/HOST_SDK_API.md)
- [应用开发者指南](../docs/APP_DEVELOPER_GUIDE.md)
- [Manifest 规范](../docs/APP_MANIFEST_SPEC.md)

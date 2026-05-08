# prompts/app-dev/ — 基于 webos 的应用开发知识库

**适合谁**：要把自己的 Web 应用接入 webos 桌面运行的开发者。不管你的应用是 React / Vue / jQuery / 纯 HTML，原则一样。

**不适合谁**：要修改 webos 自身的人（shell / SDK 内核 / 主题包）—— 你应该读 [`prompts/osweb-dev/`](../osweb-dev/)。

## 索引

| # | 文件 | 关键问题 |
|---|------|---------|
| 00 | [what-is-webos](./00-what-is-webos.md) | webos 是什么、能给应用什么、和 PWA / Electron / 微前端的区别 |
| 01 | [quick-start](./01-quick-start.md) | 三步接入：写应用 → 装 SDK → 写 manifest |
| 02 | [sdk-cheatsheet](./02-sdk-cheatsheet.md) | SDK 全模块方法速查（notify / dialog / window / theme / events / message / storage / system / ...） |
| 03 | [manifest](./03-manifest.md) | manifest 字段详解（重点 `launchMode` / `features`） |
| 04 | [user-session](./04-user-session.md) | 跨应用用户身份 / OAuth token / 登录页接入 / refresh token 流程 |
| 05 | [react-mui](./05-react-mui.md) | React + MUI 推荐用法 + `@webos/mui-theme` 集成 |
| 06 | [best-practices](./06-best-practices.md) | 应用层最佳实践（事件订阅 / 错误处理 / API 鉴权 / 性能） |
| 07 | [pitfalls](./07-pitfalls.md) | 应用层常见踩坑（fetch 跨域 / cookie 丢失 / iframe 沙箱 / launchMode 选错） |
| 08 | [checklists](./08-checklists.md) | 接入前 / 上线前 checklist |

## 按场景挑读

| 我要... | 读哪些 |
|---------|--------|
| 第一次了解 webos | 00 + 01 |
| 快速接入一个新应用 | 01 + 03 + 02 |
| 接入登录页 / SSO | 04 |
| 用 React + MUI 写应用 | 05 + 02 |
| 我的应用集成后有问题 | 07 + 08 |
| 优化应用质量 | 06 |

## 三个核心原则

1. **应用栈无关**：webos 不强求任何技术栈。装 `@webos/host-sdk` 就完事
2. **iframe 物理隔离**：你的应用是 iframe，与 webos shell **跨 origin**。所有调用走 `Webos.xxx.*` postMessage RPC
3. **不要绕过 SDK**：自己写 postMessage 协议会绕开 host 端的安全 / 路由逻辑。一律用 SDK

## 完整产品文档

- 给开发者读的: [docs/APP_DEVELOPER_GUIDE.md](../../docs/APP_DEVELOPER_GUIDE.md)
- SDK 完整 API: [docs/HOST_SDK_API.md](../../docs/HOST_SDK_API.md)
- manifest 完整规范: [docs/APP_MANIFEST_SPEC.md](../../docs/APP_MANIFEST_SPEC.md)
- React+MUI 集成: [docs/MUI_INTEGRATION.md](../../docs/MUI_INTEGRATION.md)

prompts 是 AI 协作时的精简约束；docs 是给真人读的完整产品手册。

# 文档索引

| 文档 | 内容 | 适合谁读 |
|------|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 整体架构 + 模块分层 + SDK 包结构 | 想了解 webos 内部设计的人 |
| [APP_DEVELOPER_GUIDE.md](./APP_DEVELOPER_GUIDE.md) | 应用开发完整指南，含 6 种栈接入示例 | **应用开发者**（最常读） |
| [HOST_SDK_API.md](./HOST_SDK_API.md) | `@webos/host-sdk` 完整 API 参考 | 对照查 SDK 调用方法 |
| [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md) | manifest 字段规范（entries 多入口 + contributes 扩展点） | 写 manifest.json 时查 |
| [MUI_INTEGRATION.md](./MUI_INTEGRATION.md) | React + MUI + `@webos/mui-theme` 接入指南 | 用 MUI 的应用开发者 |
| [THEME_DEVELOPER_GUIDE.md](./THEME_DEVELOPER_GUIDE.md) | 自定义主题（CSS 变量 + 设计 token） | 想做品牌主题包的人 |
| [DESIGN.md](./DESIGN.md) | 模块详细设计（早期 Phase 1 设计稿） | 对实现细节感兴趣的人 |
| [TECH_STACK.md](./TECH_STACK.md) | 技术栈选型 + 打包配置 | 评估技术方案的人 |
| [LEARNING_NOTES.md](./LEARNING_NOTES.md) | 从 Puter 学到什么 + 实操后的复盘 | 想了解为什么这样设计的人 |

## 推荐阅读路径

**我是应用开发者，想接入 webos** →
[APP_DEVELOPER_GUIDE.md](./APP_DEVELOPER_GUIDE.md) → [HOST_SDK_API.md](./HOST_SDK_API.md) → [APP_MANIFEST_SPEC.md](./APP_MANIFEST_SPEC.md)

**我用 React + MUI 做应用** →
[MUI_INTEGRATION.md](./MUI_INTEGRATION.md) → 看 [`examples/06-react-mui`](../examples/06-react-mui/)

**我想了解 webos 是怎么实现的** →
[ARCHITECTURE.md](./ARCHITECTURE.md) → [TECH_STACK.md](./TECH_STACK.md) → [DESIGN.md](./DESIGN.md)

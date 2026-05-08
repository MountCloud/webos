# prompts/osweb-dev/ — 二开 webos 知识库

**适合谁**：要修改 webos shell（`apps/webos-shell/`）/ SDK（`packages/host-sdk/`）/ MUI 主题包（`packages/mui-theme/`）/ 添加新内置能力的人。

**不适合谁**：只是基于 webos 写 iframe 应用的开发者 —— 你应该读 [`prompts/app-dev/`](../app-dev/)。

## 索引

| # | 文件 | 关键问题 |
|---|------|---------|
| 00 | [project-overview](./00-project-overview.md) | webos 是什么 / 不是什么 / 现在做到哪 |
| 01 | [monorepo-structure](./01-monorepo-structure.md) | 目录布局、各包职责、跨包引用规则 |
| 02 | [architecture-patterns](./02-architecture-patterns.md) | singleton / UIElement / EventEmitter / RPC / AppSource / UserSession 标准模式 |
| 03 | [coding-conventions](./03-coding-conventions.md) | TS 风格、注释、命名、文件组织、错误处理 |
| 04 | [extending-the-shell](./04-extending-the-shell.md) | 加 shell 模块 / dialog / 顶栏按钮 / 单例服务 |
| 05 | [extending-the-sdk](./05-extending-the-sdk.md) | 加 SDK 方法的"三件套对齐"流程 + 持久化共用底层 |
| 06 | [css-and-theming](./06-css-and-theming.md) | CSS 变量 / 设计 token / 主题切换 / 桌面布局 |
| 07 | [pitfalls-and-bug-history](./07-pitfalls-and-bug-history.md) | **必读** —— 实操中踩过的坑 + 根因 + 怎么避免 |
| 08 | [design-decisions](./08-design-decisions.md) | 关键设计为什么这样（singleton 而非 DI、iframe 而非 WC、etc.） |
| 09 | [checklists](./09-checklists.md) | 任务级 checklist（加 SDK / 加 shell / 修 bug / PR 前自检） |

## 按任务挑读

| 任务 | 读哪些 |
|------|--------|
| 完全不了解 webos 内部 | 00 + 01 + 08 |
| 给 shell 加功能 | 02 + 03 + 04 + 06 + 07 + 09 |
| 给 SDK 加 API | 02 + 03 + 05 + 07 + 09 |
| 修 bug | 02 + 03 + **07（先看，可能是已知坑）** |
| 改架构 / 重构 | 08 + 02 + 00 |
| 改 CSS / 主题 | 06 + 07 |

## 五条最高规则

1. **不破坏已建立的模式**：UIElement / EventEmitter / singleton 是固定结构，不发明新的
2. **看 07 再动手**：踩坑文件归档了真实问题，避免重复犯错
3. **三件套对齐**（SDK 改动）：SDK API + host handler + 持久化层 同时改
4. **改前 read，再 edit**：grid + flex + line-clamp 这类容易 intrinsic-size 出问题的组合，先看现状
5. **注释中文，不写 AI 风格的赘述**

最后：发现新模式 / 新坑 / 旧文档过时，**主动更新对应的 prompts 文件**。

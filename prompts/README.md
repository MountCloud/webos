# prompts/ — AI 协作知识库

webos 项目的 AI 助手（Claude / Cursor / Copilot Chat 等）协作约束。
不是给真人读的产品文档（那是 [`docs/`](../docs/)），是给 AI **执行任务时遵循的规则 + 已知坑**。

---

## 两类读者，两个子目录

| 你要做的事 | 去哪 |
|------------|------|
| **二开 webos 自身**：改 webos shell、改 SDK 内核、加新内置能力、修架构问题 | [`osweb-dev/`](./osweb-dev/) |
| **基于 webos 写应用**：把自家应用接入 webos 桌面，用 SDK 调能力 | [`app-dev/`](./app-dev/) |

两个子目录的文档完全独立，**互不重复**。AI 接到任务时按上面分类挑一个目录读全部文件即可。

---

## 一句话定位

- **osweb-dev** = "我修改 osweb"
- **app-dev** = "我使用 osweb"

举例：

| 任务描述 | 属于 |
|----------|------|
| "给 webos 顶栏加一个音量按钮" | osweb-dev |
| "给 SDK 加 `Webos.print` 能力" | osweb-dev |
| "修 dock 的 hover bug" | osweb-dev |
| "给 webos 的 dialog 加新样式" | osweb-dev |
| "把我的 Vue 应用接入 webos" | app-dev |
| "我的应用想监听 user.changed 事件" | app-dev |
| "我应用接入了 SSO 怎么写登录页" | app-dev |
| "我用 React + MUI 怎么联动 webos 主题" | app-dev |

---

## 共同原则（两边都遵守）

1. **看现有 prompts 再开搞**：知识库里很可能已经记了你要做的事 / 你要避的坑
2. **改前 read，再 edit**：不要凭印象改代码
3. **注释中文 + 解释 WHY**：不要 AI 风格"任务编号 / step 我们..."
4. **完成任务对照对应 README 的 checklist 自检**
5. **发现新坑 / 新模式 → 更新对应 prompts**：别让知识库腐化

---

## 与 docs/ 的边界

| 目录 | 读者 | 内容性质 |
|------|------|---------|
| `docs/` | 真人开发者 | 完整产品文档（参考手册式）|
| `prompts/osweb-dev/` | AI 助手 | 改 webos 的内部约束 + 踩坑 |
| `prompts/app-dev/` | AI 助手 | 用 webos 写应用的精简指南 + 踩坑 |

**关键差异**：docs 是参考手册，把所有 API / 字段说清楚。prompts 是行动指南，告诉 AI **该 / 不该做什么 + 怎么做对**。重叠最小化。

---

## 索引

### osweb-dev/
README · 00 项目本质 · 01 monorepo · 02 架构模式 · 03 编码风格 · 04 扩展 shell · 05 扩展 SDK · 06 CSS 主题 · 07 踩坑历史 · 08 设计决策 · 09 checklist

### app-dev/
README · 00 webos 是什么 · 01 三步接入 · 02 SDK 速查 · 03 manifest 字段 · 04 用户会话 · 05 React+MUI · 06 最佳实践 · 07 踩坑 · 08 checklist

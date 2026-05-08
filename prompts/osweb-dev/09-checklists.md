# 10 · Checklists

各类任务的提交前检查清单。AI 完成任务后**对照逐项验**，避免漏。

---

## ✅ 通用提交前 checklist（任何改动都过一遍）

- [ ] `tsc --noEmit` 通过：
  ```bash
  "E:/project/html/osweb/apps/webos-shell/node_modules/.bin/tsc" --noEmit -p apps/webos-shell/tsconfig.json
  ```
- [ ] `vite build` 通过（如果改了 shell）：
  ```bash
  "E:/project/html/osweb/apps/webos-shell/node_modules/.bin/vite" build apps/webos-shell
  ```
- [ ] 改了 SDK 源码 → `pnpm --filter @webos/host-sdk build`
- [ ] 改了 mui-theme 源码 → `pnpm --filter @webos/mui-theme build`
- [ ] dev server 起来手动验证受影响功能
- [ ] 没引入新的 `node_modules` / `dist` / `.env` 进 git（看 `.gitignore`）
- [ ] 没在生产代码里留 `console.log` / `debugger`（debug 日志可以 `Webos.configure({ debug: true })` 开关）
- [ ] 注释是中文 + 解释 WHY，没有 AI 风格赘述（"任务 5.3 我们..." 之类）
- [ ] 文件头有 `@author MountCloud <mountcloud@outlook.com>`（如果是新文件）
- [ ] 触发的 prompts 文件有更新（如果发现新坑或新模式）

---

## ➕ 加 SDK 方法 checklist

参考 `05-extending-the-sdk.md`。

- [ ] **三件套对齐**：
  - [ ] SDK 方法在 `packages/host-sdk/src/modules/xxx.ts`
  - [ ] host handler 在 `apps/webos-shell/src/apps/builtinHandlers.ts`
  - [ ] shell 内部实现（singleton 方法 / 工具函数 / 直接 inline）
- [ ] 类型放 `core/types.ts`（如果跨模块用）
- [ ] 在 SDK `index.ts` 导出新类型
- [ ] **rebuild SDK**：`pnpm --filter @webos/host-sdk build`
- [ ] 更新 `docs/HOST_SDK_API.md` 加新方法说明
- [ ] 错误码遵循 [05](./05-extending-the-sdk.md#错误码约定)
- [ ] 涉及持久化 → 走 `session.ts` 模式（共享底层）
- [ ] 涉及状态变化 → broadcast `xxx.changed` 事件让应用能订阅

---

## ➕ 加 shell 模块 checklist

参考 `04-extending-the-shell.md`。

- [ ] 决定是 UIElement 子类（有 DOM）还是 singleton（无 DOM）
- [ ] 类继承 `UIElement<MyEvents>` 或 `EventEmitter<MyEvents>`
- [ ] DOM 副作用用 `addDomListener / addDisposer`，destroy 自动清
- [ ] 如果是 popover 类（开 / 关）→ 抄 `SettingsPanel.ts` 的 `_removeTimer` 防赛跑
- [ ] outsideClick / Escape 监听用 capture 阶段（`true`）+ contains 判断
- [ ] CSS 单独一份（`styles/my-thing.scss`）+ `index.scss` `@use`
- [ ] 颜色 / 间距全走 token，不硬编码
- [ ] z-index 用 `var(--webos-z-*)` 选合适层
- [ ] 在 `main.ts` bootstrap 里接线（不要在组件内部硬编码"我连哪个事件"）
- [ ] 如果有持久化 → 用 `helpers/persist.ts`（per-shell）或 `host-sdk/session.ts`（共享）
- [ ] 如果是常用 popover → 加 hotkey（仿 `Cmd+K`）

---

## ➕ 加 manifest 字段 checklist

- [ ] `apps/webos-shell/src/apps/AppManifest.ts` 接口加字段
- [ ] `validateManifest` 加校验（如果字段有约束）
- [ ] `apps/webos-shell/src/apps/AppLoader.ts` 处理字段（如果影响 launch 行为）
- [ ] 全局搜索 / 桌面图标 / StartMenu 三处的渲染（如果字段影响 UI 显示，比如 `launchMode='tab'` 加 ↗ 角标）
- [ ] `docs/APP_MANIFEST_SPEC.md` 加字段说明
- [ ] `prompts/06-app-integration.md` 同步
- [ ] 至少一个 example app 的 manifest 加该字段做演示

---

## ➕ 加新主题 / 改 CSS 变量 checklist

参考 `07-css-and-theming.md`。

- [ ] 只在 `tokens.scss` 改变量定义，不要在组件 SCSS 里硬编码新颜色
- [ ] 浅色 / 深色都覆盖（如果是颜色类变量）
- [ ] 检查所有用到该变量的地方仍然合理
- [ ] iframe 应用如果依赖 `Webos.theme.getTokens()` 拿 CSS 变量，改完发 `theme.changed` 事件
- [ ] `@webos/mui-theme/src/tokens.ts` 也同步（如果是核心颜色 / 间距 token）

---

## ➕ 加新示例应用 checklist

- [ ] 在 `examples/` 下建 `0X-name/` 目录
- [ ] 写 `package.json`（依赖 `@webos/host-sdk: workspace:*`）
- [ ] 写 `vite.config.js`（端口选个不冲突的，5505+）
- [ ] 写 `manifest.json`（`appId / name / icon / entry`）
- [ ] 在 `apps/webos-shell/src/main.ts` 的 `getExampleApps()` 里注册
- [ ] 在根 `package.json` 的 `dev:all` 脚本里加 `--filter=example-name`
- [ ] 写 `README.md`（怎么跑、关键代码片段）
- [ ] `pnpm install` 让 workspace 链接生效
- [ ] 在 `examples/README.md` 索引表里加一行

---

## 🔧 修 bug checklist

- [ ] **先看 `08-pitfalls-and-bug-history.md`**（很多 bug 是已知历史问题）
- [ ] 复现 bug 在浏览器
- [ ] 找到根因（不是 patch 表象，是 root cause）
- [ ] 写代码前 read 相关文件全文
- [ ] 最小修改（不顺手 refactor 不相关代码）
- [ ] 修完手动验证修复 + 验证没回归
- [ ] 修完更新 `08-pitfalls-and-bug-history.md` 加这条新坑（如果不在已有列表）

---

## 📦 同步到 GitHub 前 checklist

- [ ] `git status` 看待提交文件，确认没有 dist / node_modules / .env
- [ ] `git diff` 过一遍代码（哪怕只看摘要）
- [ ] commit message 简洁中文 + 主语动作（如"修复 dock 顶部 hover 高亮异常"）
- [ ] 大改动拆 commit（一个 commit 一件事）
- [ ] 推之前确认远程 origin 是对的（公司项目 vs 个人项目）
- [ ] 如果是改 SDK / mui-theme 公开包 → 考虑 `version` bump（项目还没正式做语义化版本，但要提）

---

## 📝 写 / 改文档 checklist

- [ ] `docs/` 是给应用开发者读的产品文档
- [ ] `prompts/` 是给 AI 助手读的协作约束
- [ ] `README.md` 根是一键启动 + 概览
- [ ] 新增 docs 文件 → 在 `docs/README.md` 索引加一行
- [ ] 文档相互链接（用相对路径）
- [ ] 代码示例可执行（不写伪代码）
- [ ] 中文为主，技术名词保留英文

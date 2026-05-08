# 00 · 项目本质

## 一句话

**webos** 是一个**通用 Web 桌面运行时**：给任何 Web 应用一个"窗口 + dock + 通知 + 对话框 + 主题"的桌面体验，用 `@webos/host-sdk` 把桌面壳的能力暴露给 iframe 应用。

## 目标用户

- **集成方**：拿 webos 做企业内部"应用门户"的人 —— 把自家若干 Web 应用塞进 webos 桌面里，统一观感和入口
- **应用开发者**：想让自己的 Web 应用以"桌面应用"形式被使用的人 —— 装 SDK 即可

## 不是什么

- **不是 OS / 虚拟机**：没有文件系统、进程模型、自己的存储池。底下还是浏览器
- **不是应用商店**：webos 不内置任何业务应用、不内置用户系统、不内置后端
- **不是 UI 组件库**：webos 的 SDK 只暴露"桌面壳能力"，不提供 Button / Table / Form 这类业务组件 —— 应用自己用 MUI / Ant Design / 任意东西
- **不是 PWA 框架**：可以打包成 PWA 但不是 webos 的关注点
- **不是 SSR**：纯客户端 SPA，部署成静态资源即可

## 是什么

- **桌面壳**（webos shell）：浏览器里跑的 SPA，提供窗口管理、桌面、dock、顶栏、对话框等
- **iframe 容器**：每个应用是一个 iframe，跑在 webos shell 提供的窗口里，**完全不需要改业务代码**就能跑在 webos 里
- **SDK**：`@webos/host-sdk` 通过 postMessage 让 iframe 应用调桌面壳能力（通知、对话框、窗口控制、跨应用消息、用户身份、主题等）
- **可选**：`@webos/mui-theme` 让 React + MUI 应用跟 webos 桌面主题深度联动

## 现在做到哪

✅ **shell**：多窗口管理 / 顶栏胶囊（左：显示桌面 + 主菜单；右：消息/用户/设置/搜索）/ 顶部居中 dock / 全屏 launcher / 全局搜索 Cmd+K / 通知中心 / 对话框（含自定义按钮 dialog.show）/ 上下文菜单 / 主题（浅深自动）/ 桌面图标大小可调 / 中英文 i18n
✅ **SDK**：15 模块（notify / dialog / window / contextMenu / theme / storage / apps / app / contributes / message / events / system / user / requestPermission / configure）
✅ **用户会话**：UserSession singleton + `Webos.user.set/setUser/setToken/clear` + 同 origin 登录页 helper
✅ **应用注册**：manifest entries 多入口（一个应用 N 个独立桌面图标）+ 每 entry 独立 launchMode（window / tab）+ 每 entry 独立 features 子功能 + contributes 扩展点（跨应用 UI 嵌入）
✅ **示例**：6 个示例应用（Vanilla HTML / Vanilla JS / Vue / React+TS / jQuery / **React+MUI 推荐**）+ 2 个 contributes 扩展点 demo（host / plugin）

## 不做的事 / 后续才做

- 文件系统 API（应用要存文件自己用浏览器 File API / IndexedDB）
- 多用户切换 UI（UserSession 支持单用户切换，多用户分账户管理还没做）
- Snap layouts / 多桌面 / 虚拟桌面
- 主题市场 / 应用商店 UI
- 移动端响应式（未来可能补）
- 服务端 / 后端组件

## 设计哲学（关键）

1. **应用栈无关**：shell 不绑任何前端框架；shell 自己用 vanilla TS + interact.js；应用是 iframe 想用什么用什么
2. **能力隔离 vs UI 集成**：SDK 只暴露**能力**（行为），不暴露**组件**（UI）。UI 一致由 `@webos/mui-theme` 这样的薄主题包负责
3. **iframe 物理隔离**：跨 origin iframe 是物理沙箱，应用崩溃不影响 shell；postMessage 是唯一通信通道
4. **配置化优于代码化**：应用清单走 manifest（声明式），SettingsPanel 走 CSS 变量（声明式），尽量避免硬编码
5. **shell 永远轻**：shell 启动时间是用户感知的"地基速度"，不能加 React/Vue 当依赖

## 当 AI 接到 webos 相关需求时

- 优先问"这个属于 shell 能力 还是 应用业务"。两者**永远分开**
- 不要把业务组件（DataTable / Form）往 SDK 里塞。SDK 只增长"桌面行为"
- 改 shell 时记得 shell 是被所有应用共享的"地基"，破坏性改动慎重

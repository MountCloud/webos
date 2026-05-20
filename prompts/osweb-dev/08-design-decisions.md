# 09 · 关键设计决策

webos 实现过程中做的"为什么这样不那样"的决定，附理由。**新设计要改这些之前先看为什么。**

---

## 1. Singleton 而不是 ServiceContainer / DI

**决策**：所有全局服务（WindowManager / AppLoader / AppRegistry / ThemeRegistry / UserSession ...）用 `class.instance` singleton 模式。

**为什么不 DI**：
- webos 是单实例 SPA，永远只有一个桌面。DI 解决的"多实例 + 不同配置"问题不存在
- TS 严格模式 + 静态 import 已经给了"显式依赖"信号
- `WindowManager.instance.register(win)` 比 `container.get(WindowManagerToken).register(win)` 短得多
- 没有运行时配置注入需求

**何时该考虑 DI**：如果未来要在一个页面里跑多个 webos 实例（比如插件系统嵌入子 webos），那时再上。现在不上。

---

## 2. iframe 而不是 Web Components

**决策**：应用是 iframe，不是 web component。SDK 走 postMessage。

**为什么 iframe**：
- **完全隔离**：跨 origin iframe 是物理沙箱，应用崩溃 / 内存泄漏不影响 shell
- **栈无关**：iframe 内可以是任何技术（jQuery / WASM / TS / 老 JSP 渲染的页面）。WC 限制了必须能挂 custom element
- **第三方页面友好**：直接 iframe 别人的网站（OA / SSO / BI）就能集成，不用对方改代码
- **沙箱属性**：`sandbox` 属性可控（加权限模型时用）

**代价**：跨 origin iframe 没法共享 cookie / DOM；通信只能 postMessage。这个代价对企业门户场景是可接受的。

**也考虑过的方案 + 否决理由**：
- Web Components：栈锁 + 跨 origin 不行
- 路由式（每个应用一条 SPA 路由）：所有应用必须同代码库 / 同栈
- micro-frontend（single-spa）：栈耦合高，不适合"任意第三方应用"

---

## 3. RPC 走 postMessage 而不是 SharedWorker / BroadcastChannel

**决策**：所有 iframe ↔ shell 通信走 postMessage（每个 iframe 一对一）。

**为什么**：
- postMessage 是跨 origin iframe **唯一可靠**的通道
- SharedWorker 不支持跨 origin
- BroadcastChannel 跨 origin 不行
- 简单：每个 RpcRequest 对应一个 RpcResponse，不需要消息排队 / 重试

**协议固定**（不能随便改）：
```
{ type: 'webos.request', id, appId, module, method, args }
{ type: 'webos.response', id, ok, data?, error? }
{ type: 'webos.event', event, payload }
```

未来可能在协议里加 `version` 字段做版本协商，目前没有。

---

## 4. UIElement 基类强制生命周期

**决策**：所有 UI 组件继承 UIElement，必须实现 `render()`，必须用 `addDomListener`/`addDisposer`。

**为什么**：
- 强制统一的 mount / unmount / destroy 流程
- 副作用清理自动化（destroy 时 dispose 所有 listener / interval）→ 避免内存泄漏
- 给所有 UI 一个统一的 EventEmitter（很多 UI 要 emit 自己的事件）

**代价**：写组件多一层 boilerplate（继承 + 实现 render）。可接受。

---

## 5. CSS 变量驱动主题（不是 CSS-in-JS / styled-components）

**决策**：颜色 / 间距 / 字号全部 `var(--webos-*)`，深色主题改 `[data-webos-theme="dark"]`。

**为什么**：
- 主题切换零运行时（浏览器自动重绘）
- 自定义主题门槛低（写一组 CSS 变量就行）
- 不依赖任何 JS 框架
- iframe 应用也能读这些变量（通过 `Webos.theme.getTokens()` 或自家 CSS 变量）

**否决的方案**：CSS-in-JS（绑 React） / styled-components（重）/ Tailwind（不能动态切换）。

---

## 6. SCSS 而不是纯 CSS / PostCSS

**决策**：用 SCSS（modules + nested + variables）。

**为什么**：
- nested + `&` 修饰符让 BEM 更易读
- `@use` 模块化
- 业内最稳定的预处理器
- Vite 内置支持

**没用 CSS Modules / scoped CSS**：因为 BEM 命名 + `webos-` 前缀已经够避免冲突；scoped CSS 让样式难以从外部覆盖（影响主题包）。

---

## 7. 不内置任何业务（用户系统 / 文件系统 / 应用商店）

**决策**：webos shell 不内置任何业务。

**为什么**：
- 内置 = 锁定 = 不通用。webos 想适配各种企业场景，不能假设大家都有 Puter 那样的中心化用户系统
- 业务上交：用户走 `Webos.user.set()` 由集成方注入；文件系统走应用自己的 IndexedDB；应用商店走 `JsonAppSource` URL
- 留出"插件 / 钩子"位（如 UserSession 的 `setPersist(false)`），让集成方覆写默认行为

**反例**：Puter 内置用户 + 文件系统 + 应用商店 → 强绑 puter.com 后端。webos 拒绝这条路。

---

## 8. AppSource 抽象（不直接读应用列表）

**决策**：webos 不知道应用列表从哪来，使用方实现 AppSource 接口。

**为什么**：
- 静态、远端 JSON、Nacos、自家应用商店 API ... 都能接
- 多源合并（CompositeAppSource）支持"内置 demo + 客户应用"两层
- 热更新（subscribe）扩展位预留

---

## 9. launchMode 区分 window / tab

**决策**：manifest `entries[i].launchMode: 'window' | 'tab'` 字段，每个 entry 独立选择启动模式。

**为什么**：
- 'window' 是默认，应用进 iframe 窗口，能用 SDK
- 'tab' 是逃生口：应用拒绝 X-Frame-Embed / 大屏 BI / SSO 跳转入口 这种**就该新开标签**的情况
- 不强求所有应用都进 iframe

**代价**：tab 模式失去 SDK 能力（独立浏览器上下文）。文档明说，开发者自己权衡。

---

## 10. features 子功能由 manifest 声明，不由应用 runtime 注册

**决策**：manifest `entries[i].features: AppFeature[]`，写死。features 归属 entry，每个 entry 自己的子功能命名空间。

**为什么**：
- 全局搜索要在**应用没启动时**就能搜到子功能。runtime 注册做不到（应用没起）
- 配置化优于代码化
- features 是相对稳定的应用级元信息，不是"动态生成的"

**代价**：应用变更（如新增功能页）要改 manifest。可接受 —— manifest 本来就和应用版本绑定的。

---

## 11. UserSession + 共享 session 模块（同一份持久化底层）

**决策**：UserSession singleton 在 shell；持久化层抽到 `@webos/host-sdk/session` 让登录页 / shell / RPC 处理器三方共用。

**为什么**：
- 登录页是同 origin 独立页面，没有 parent window，**走不通 postMessage RPC** → 必须能直接写存储
- 如果三个地方各自实现持久化，**格式 / key 不一致** → 登录页写的 webos 读不出来 → 调试地狱
- 抽到 SDK 让 "登录页能 import" + "shell 端的 UserSession 也能 import"，**自然约束**了同一份格式

**实现细节**：`session.ts` 是纯函数，没有状态（不是 singleton），不依赖任何 webos shell 内部 API。

---

## 12. 顶部栏不是满条，是两个胶囊 + 中间 dock

**决策**：顶部三件套（左上 / 中间 dock / 右上）三个独立浮动元素，不是一整条。

**为什么**：
- 用户明确要求"群晖那样的"分散式顶栏
- 满条会浪费桌面空间（特别是中间区）
- 浮动胶囊视觉更轻、玻璃质感更突出

**代价**：dock 居中要算 max-width 避免撞两侧胶囊；顶栏 + dock 同高便于视觉对齐。

---

## 13. 全屏 launcher 而不是下拉 StartMenu

**决策**：主菜单是 Ubuntu / Synology 风格全屏遮罩 + 应用网格，不是 Windows 风格下拉。

**为什么**：
- 用户要求
- 全屏让搜索框和应用列表都更宽敞
- 搜索字段大、命中率高

---

## 14. 桌面图标左侧竖排（列优先）

**决策**：`grid-auto-flow: column` 让图标先填满第一列再换列。

**为什么**：
- 用户要求"群晖那样左侧竖排"
- 顶栏占了顶部空间，图标从左上角开始竖向更自然
- 桌面右侧空着方便摆窗口

---

## 15. 不做 ServiceContainer / 也不做运行时插件系统

**决策**：不引入 shell 内部的运行时插件 / 模块注入机制。
**例外**：`contributes` 扩展点 —— 但那是**应用之间通过 manifest 声明 + iframe 隔离**实现的跨应用 UI 嵌入，不是 shell 进程内的脚本注入。

**为什么**：
- 运行时插件系统增加复杂度（生命周期、依赖管理、版本协商）
- shell 内部能力直接 import 即可，没有运行时动态加载需求
- 跨应用扩展走 contributes — manifest 静态声明 + iframe 隔离，安全边界清楚（应用之间不能互相注入代码）
- 如果将来要做 shell 自身的插件（如"主题包"、"自定义 dialog"），那时再加，不要预设

---

## 16. UserMenu / UserSession 不强 type "TOken 是字符串"

**决策**：`Webos.user.token()` 返回 `TokenInfo` 对象（含 accessToken / refreshToken / expiresAt 等 OAuth 标准字段），不是 string。

**为什么**：
- OAuth / OIDC 流程需要多个字段
- 业务方扩展字段任意（`[key: string]: unknown`）
- `accessToken()` / `isTokenExpired()` 提供便利访问

**代价**：API 略复杂；好处是覆盖标准 OAuth 全场景，应用不用自己拼装。

---

## 17. 不发明自己的 i18n 框架

**决策**：i18n 是简单字典 + locale 切换。不引入 i18next / react-intl。

**为什么**：
- shell 字符串少（< 100 条）
- iframe 应用各自有 i18n 方案（用什么都行）
- 不增加 shell 依赖

---

## 18. 主题色不允许应用方独立切换

**决策**：`Webos.theme.set(mode)` 是**全局**切换，影响 shell + 所有 iframe 应用。

**为什么**：
- 主题是用户偏好，应该跨应用一致
- 如果 A 应用切深色，B 应用还是浅色 → 视觉割裂
- 应用要自己有"反相主题"可在 app 级覆盖（用 CSS 变量），但不影响其他应用

---

## 19. iframe 加载遮罩由 host 渲染，不依赖应用方

**决策**：AppWindow 创建 iframe 时同时**在 host 一侧渲染一个全覆盖的 loading mask**（spinner + 文案），iframe `load` 事件触发后再淡出移除。**应用方不需要也不应该自己实现"加载中"画面**。

**为什么**：
- 跨 origin iframe 在 `load` 之前 DOM 是黑的——浏览器不会主动渲染任何 placeholder，**用户体验是窗口先空白几百毫秒到几秒**，看起来像点了没反应
- 跨 origin → host 无法注入 DOM 到 iframe 内 → 不能在应用代码里做 placeholder
- 即便能注入，要求每个应用自己写一遍"加载中"画面**违反 §2 iframe 隔离原则**——应用应该不知道自己跑在 webos 里
- 由 host 统一渲染 → 视觉一致，所有应用首屏体验相同
- iframe `load` 事件是浏览器原生信号，比应用方 emit 的"我好了"消息更可靠（不依赖应用方 SDK 已加载）

**实现要点**：
- mask 用绝对定位盖在 iframe 之上，z-index 比 iframe 大
- iframe `load` 触发后等一个 RAF 再淡出（避免 load 早于首帧渲染的边缘情况）
- 不监听 `error` —— 加载失败应用方自己有 error 页面，host 不接管
- reload 时（`AppWindow.reload()`）要**重新挂上 mask**——iframe 被替换或 src 重置都算"再次加载"

**代价**：
- mask 文案没法本地化到应用语言（用 shell 当前 locale）—— 可接受，加载只持续几秒
- 如果应用首屏 `load` 已触发但还在拉 API 数据，mask 已经消失了 → **应用自己在内容区放骨架屏 / 二级 loading**（这部分应用方可见）

**也考虑过**：
- 应用方 ready 信号（postMessage `app.ready`）替代 `load`：可靠性更高但**要求 SDK 已加载**，应用方忘了 emit 就永远不消失，**风险更大**
- 不做遮罩，依赖应用自己渲染：开放第三方应用时**无法保证**

---

## 何时该违反这些决策

如果你（或将来的 AI）发现某个决策**明显错了**，请：

1. **不要直接改**，先在 `prompts/09-design-decisions.md` 这个文件里加个"修订"段
2. 列出"为什么之前这样不对了 / 新场景是什么 / 替换方案 + tradeoff"
3. 让人类决定要不要切

避免"AI 一时觉得不好就重写"导致的反复 churn。

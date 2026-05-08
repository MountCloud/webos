# 08 · 踩坑记录（必读）

webos 实操中遇到的真实 bug + 根因 + 修法。**改代码前先看这个文件，避免重复犯错。**

---

## 🔴 P0 类（彻底坏 / 必须避免）

### #1 `-webkit-box` + `align-self: start` 在 grid cell 里 → 元素高度 = 0

**症状**：桌面图标的 label 完全不显示。

**根因**：`display: -webkit-box`（多行 ellipsis 的老式 hack）在 CSS Grid item 上 + `align-self: start`（item 不 stretch）→ grid 让 item 用 intrinsic block size，但 webkit-box 的 intrinsic-size 计算依赖 `-webkit-line-clamp`，组合下来某些浏览器算成 0 → height 0 → 不显示。

**修法**：去掉 `align-self: start`，让默认 `stretch` 把 label 撑到 grid 行高。或者保留 align-self 但去掉 `-webkit-line-clamp` 改成 `max-height: 2.6em`。

```scss
// ❌
.webos-icon-item-label {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  align-self: start;        // ← 元凶
  max-height: 2.6em;        // ← 叠加更糟
}

// ✅
.webos-icon-item-label {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  // 不加 align-self
}
```

---

### #2 跨 origin iframe 吞鼠标事件 → resize 触发不了

**症状**：用户反馈"窗口边缘 / 角必须很精确才能 resize"。

**根因**：webos shell（5173）跑应用 iframe（5501-5504）是**跨 origin** 的。跨 origin iframe 把鼠标事件**全部吞掉**，父 document 收不到任何 mousedown。interact.js 默认靠 mouse position 检测边缘热区（`margin: 16`），但事件根本不到父 document。**只剩窗口最外那 1px 边框**能触发。

**修法**：在 iframe 之上盖 8 个透明 resize handle div（z-index 10 > iframe stacking context），handle 抢先吃事件，触发 interact.js。interact.js `edges` 改成 CSS selector 形式：

```ts
edges: {
  top: '.webos-window-resize-handle--n, .--nw, .--ne',
  bottom: '.--s, .--sw, .--se',
  left: '.--w, .--nw, .--sw',
  right: '.--e, .--ne, .--se',
}
```

8 个 handle 由 `Window.render()` 动态创建，SCSS 给定位 + cursor 样式。详见当前 `WindowResize.ts` + `Window.ts` + `window.scss`。

**同样的根因带出的另一个 bug**：拖窗时鼠标移过 iframe，mouseup 被 iframe 吞，松开后窗口仍跟着鼠标走。修法：start 时给 `<body>` 加 `webos-window-interacting` class，CSS `body.webos-window-interacting .webos-app-iframe { pointer-events: none }`，让交互期间所有 iframe 透明，事件直接落到父 document。end 时摘掉 class。

---

### #3 close 用 setTimeout 延迟 removeEl，期间 reopen 被反向干掉

**症状**：NotificationCenter / StartMenu / GlobalSearch 快速开 → 关 → 开 时，最后一次 open 显示一下就消失。

**根因**：close 写法 `setTimeout(() => removeEl(this.el), 150)` 延后等动画。期间用户 reopen，新的 open 把 el 重新 append 到 body（实际是 detach + reattach），150ms 后老 setTimeout 触发 → 移除！新 open 的 el 直接没了。

**修法**：用 `_removeTimer` 字段记录待执行 timer，open 时先 clearTimeout 它：

```ts
private _removeTimer: ReturnType<typeof setTimeout> | null = null

open() {
  if (this._removeTimer) {
    clearTimeout(this._removeTimer)
    this._removeTimer = null
  }
  document.body.appendChild(this.el)
  // ...
}

close() {
  // ...
  if (this._removeTimer) clearTimeout(this._removeTimer)
  this._removeTimer = setTimeout(() => {
    this._removeTimer = null
    if (!this._isOpen) removeEl(this.el)   // 二次保险
  }, 150)
}
```

**所有 popover 类组件**都要这么做（`SettingsPanel` / `UserMenu` / `NotificationCenter` / `StartMenu` / `GlobalSearch`）。

---

### #4 ContextMenu 第二次右键弹不出来

**症状**：右键桌面 / 任务栏 → 菜单弹出。再右键别处 → 菜单不出。

**根因**：`showContextMenu` 用 `{ once: true }` 在 document 上挂 contextmenu 监听做 outsideClick。第二次右键事件**先**触发该监听（执行 closeActive 把刚弹的新菜单关了），**再**触发外层组件的 contextmenu handler（开新菜单 → 一次后又被另一个 once 监听关掉）。结果"新菜单永远不见"。

**修法**：document 监听用 capture 阶段（`{ capture: true }`）+ 永久挂载（菜单存在时挂、关闭时摘），不要用 once。capture 让 document 监听**先**于 desktop / taskbar 的 bubble 监听 → 先关旧菜单 → 再让 desktop 开新菜单。

详见 `core/dialog/ContextMenu.ts` 当前实现。

---

### #5 WindowManager z-index 单调 ++ → 窗口盖到 taskbar 上面

**症状**：用了一段时间后，窗口盖住底部 taskbar（taskbar z-index 1000）。

**根因**：`WindowManager` 的 `nextZIndex = ++this.nextZIndex` 永不回收。一天 focus 切 ~900 次窗口就把 nextZIndex 顶到 1000+。

**修法**：删 `nextZIndex` 字段，改成"按 stack 顺序重排"：

```ts
private _reflowZIndex(): void {
  let normal = Z_INDEX_BASE
  let topmost = Z_INDEX_TOP
  for (const id of this.stack) {
    const w = this.windows.get(id)
    if (!w) continue
    if (w.options.alwaysOnTop) w.zIndex = topmost++
    else w.zIndex = normal++
  }
}
```

每次 focus / register 调一次。z-index 永远 = `BASE + N`（N 是窗口数量），不会无限增长。

---

## 🟠 P1 类（行为不对 / 容易掉坑）

### #6 GlobalSearch 鼠标悬停 / 键盘 ↑↓ 高亮的项 ≠ 实际指向的项

**症状**：搜索结果里鼠标悬停在 result B 上，但高亮在 result A 上。

**根因**：`_updateActive` 用 `this._list.children` 索引 `_selectedIndex`，但 children 包含**分组标题 + result 项混合**，而 selectedIndex 是只算 result 项的索引。错位。

**修法**：单独维护 `_itemNodes: HTMLElement[]` 数组，只记 result item 节点（不含分组标题），`_updateActive` 遍历它而不是 `list.children`。

---

### #7 Vite HMR 把旧 CSS 留在内存

**症状**：CSS 改完 dev server 自动热更新，但浏览器看到的还是老样式。

**根因**：HMR 给 SCSS 的更新用 inject 新 `<style>` + 删旧的，偶尔有竞态。

**修法**：硬刷（Ctrl+Shift+R / Cmd+Shift+R）。改大改动时 kill dev server 重启更稳。

---

### #8 nested calc 渲染 1-2px 误差 → 最大化窗口底部空白

**症状**：`height: calc(100vh - calc(var(--top-bar-height) + var(--top-bar-margin) * 2))` 有时底部留 1-2px 空白。

**根因**：嵌套 calc + CSS 变量 + viewport unit，浏览器渲染管线偶有舍入误差。

**修法**：完全约束法 —— `top + left + right + bottom = 0` + `width: auto / height: auto`，让浏览器自己算。

```ts
// ✅
setStyle(this._el, {
  left: '0', top: topReserve, right: '0', bottom: '0',
  width: 'auto', height: 'auto',
})

// ❌ 别用
height: `calc(100vh - ${topReserve})`
```

restore 时记得清掉 `right` / `bottom`，否则 setBounds 设 width/height 后会被 right:0 / bottom:0 拉满。

---

### #9 `_updateActive` 在键盘 ↑↓ 后选中项跑出可视区

**症状**：搜索结果多于面板高度时，键盘 ↑↓ 把选中跑到下面，但 list 没自动滚。

**修法**：`_updateActive` 末尾加：

```ts
this._itemNodes[this._selectedIndex]?.scrollIntoView({ block: 'nearest' })
```

---

### #10 NotificationCenter / StartMenu / TaskbarItem 的 `mousedown` 无脑 stopPropagation

**症状**：通知中心面板里没法拖动选中文字。

**根因**：之前给面板加 `mousedown.stopPropagation()` 防 outsideClick 关掉，**但** _onOutsideClick 已经检查 `contains` 自己排除，stopPropagation 多余且阻塞文字选择。

**修法**：去掉 `mousedown stopPropagation`。outsideClick 监听用 capture 阶段 + contains 判断就够。

---

### #11 launcher（StartMenu 全屏）下半部分点击不关闭

**症状**：launcher 下方空白区域点击不关闭，只有上面能关。

**根因**：`grid` 用 `flex: 1` 占满 searchWrap 下面所有空间，点击 target 是 grid（不是 overlay 本身）。原代码 `if (e.target === overlay) close()` 排除了 grid。

**修法**：改成 "target 不在 search wrap / item 内 → 关"：

```ts
overlay.addEventListener('mousedown', (e) => {
  const target = e.target as HTMLElement | null
  if (!target) return
  if (target.closest('.webos-launcher-search-wrap, .webos-launcher-item')) return
  this.close()
})
```

---

### #12 dock 顶部 / 下拉面板 anchor 跟着按钮走 → 视觉位置参差

**症状**：右上角 4 个按钮（消息 / 用户 / 设置 / 搜索）点出的下拉，每个 x 不一样。

**根因**：anchor = 按钮 right 边缘，每个按钮 right 不同。

**修法**：anchor = **整个胶囊 right 边缘**（`this.el.getBoundingClientRect().right`），所有下拉都对齐到一个 x。

---

### #13 GlobalSearch.installShortcut 不幂等

**症状**：调两次 → Cmd+K 触发两次 toggle → 打开后立即关闭。

**修法**：加 `_shortcutInstalled` 标记防重复挂监听。

---

### #14 NotificationCenter.clear 只清 history 不清 badge

**症状**：清空通知后任务栏 / 顶栏徽章还在。

**修法**：clear() 同步重置 `_unreadCount = 0` + 调 `_badgeCallback?.(0)`。

---

## 🟡 P2 类（边角 / UX）

### #15 时钟 setInterval(30_000) 最长滞后 30 秒

**修法**：先 setTimeout 到下一分钟边界，再切 setInterval(60_000)。

```ts
private _scheduleClockUpdate(): void {
  this._updateClock()
  const now = new Date()
  const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
  this._clockTimer = setTimeout(() => {
    this._updateClock()
    this._clockTimer = setInterval(() => this._updateClock(), 60_000)
  }, Math.max(50, ms))
}
```

### #16 任务栏（dock）溢出无法滚

**修法**：`overflow-x: auto`，再用 wheel 监听把 deltaY 转 scrollLeft（垂直滚轮 → 水平滚动）。注意 `passive: false` 才能 preventDefault。

### #17 应用 manifest.entry 拼 params 时 `?` 重复

**修法**：

```ts
const sep = url.includes('?') ? '&' : '?'
url = `${url}${sep}${qs.toString()}`
```

但要小心：`url` 里 `?` 也可能在 hash 后（`#x?y=1`），稳妥做法是先解析 URL 再 set。

### #18 UserMenu 不广播 user.changed → iframe 应用收不到

**修法**：UserSession.set/clear/setToken 内一定要 emit('change')，AppMessageBus 订阅 emit 后 broadcast 到所有 iframe。这条已经在当前代码里实现了，新加方法不要漏。

### #19 双击图标"打开后立刻最小化"

**症状**：dock 上点 minimized 应用 → focus 变 normal → 第二次 click 被解读为"已 active 再点 = minimize" → 闪一下消失。

**修法**：dock click 加 400ms 防抖。

```ts
const lastFocusAt = new Map<string, number>()
const DEBOUNCE_MS = 400

dock.on('itemClick', ({ item }) => {
  const since = Date.now() - (lastFocusAt.get(item.options.windowId) ?? 0)
  if (since < DEBOUNCE_MS) return
  // ... 正常逻辑
  lastFocusAt.set(item.options.windowId, Date.now())
})
```

---

## 🟢 通用经验

1. **改 SCSS 后必须硬刷浏览器**（HMR 不可靠）
2. **改 SDK 后必须 `pnpm --filter @webos/host-sdk build`** —— 否则 shell / examples 用不到新代码
3. **改之前 `git status`**：避免误以为某文件没人改过；linter 可能改过
4. **`tsc --noEmit` + `vite build` 每次必跑**
5. **加 popover 类组件**（任何浮层）一律先看 SettingsPanel 当模板抄
6. **加 SDK 方法**一律先看现有 user 模块的"三件套对齐"
7. **改 Window / WindowManager 任何状态字段**都先想清楚 destroy 时怎么清

---

## 历史教训（AI 给我犯过的错）

- 看到"label 显示有问题"立刻加更多 CSS（max-height、align-self、overflow:hidden 多层叠加），结果**层层 hack 互相干扰**，最后整个 label 不显示。**正确做法**：先**读完整当前 CSS 再改**，理解每条规则的作用，最后做最小修改。
- 大胆 refactor 已经能跑的东西（如 flex → grid 切换 layout），结果引入新 bug。**正确做法**：最小可逆修改 + 一次只改一个变量 + 改完手动验证。

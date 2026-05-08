# 07 · CSS 与主题

webos shell 的 CSS 体系。**写新组件 / 改样式必须按这个走**，否则破坏主题切换、桌面布局。

---

## 设计 token（CSS 变量）

全部定义在 `apps/webos-shell/src/styles/tokens.scss` 的 `:root`，深色主题在 `[data-webos-theme="dark"]` 里覆盖部分颜色。

### 颜色

| 变量 | 用途 |
|------|------|
| `--webos-color-primary` / `--primary-hover` | 主色（按钮 / 链接） |
| `--webos-color-bg-base` | 桌面背景 fallback |
| `--webos-color-bg-window` | 窗口主体背景 |
| `--webos-color-bg-glass` / `--bg-glass-strong` | 玻璃面板背景（半透明，带 backdrop-blur） |
| `--webos-color-bg-overlay` | 遮罩层 |
| `--webos-color-text` / `--text-muted` / `--text-inverse` | 文字 |
| `--webos-color-border` / `--border-strong` | 边框 |
| `--webos-color-shadow` | 阴影色 |
| `--webos-color-danger` / `--warning` / `--success` / `--info` | 状态色 |
| `--webos-color-hover` / `--active` | 悬停 / 激活半透明 overlay |

### 间距

```
--webos-spacing-xs:  4px
--webos-spacing-sm:  8px
--webos-spacing-md:  12px
--webos-spacing-lg:  16px
--webos-spacing-xl:  24px
--webos-spacing-2xl: 32px
```

### 圆角

```
--webos-radius-sm: 4px
--webos-radius-md: 6px
--webos-radius-lg: 8px
--webos-radius-xl: 12px
```

### 字号

```
--webos-font-size-xs:   11px
--webos-font-size-sm:   12px
--webos-font-size-base: 13px
--webos-font-size-md:   14px
--webos-font-size-lg:   16px
--webos-font-size-xl:   20px
```

### 玻璃质感

```
--webos-blur:        12px
--webos-blur-strong: 24px

# 配合
backdrop-filter: blur(var(--webos-blur-strong));
-webkit-backdrop-filter: blur(var(--webos-blur-strong));
```

### 动效

```
--webos-transition-fast:   150ms ease
--webos-transition-normal: 250ms ease
--webos-transition-slow:   400ms ease
```

### 桌面 / 顶栏 / dock 关键尺寸

```
--webos-icon-size:        96px (中)；运行时由 SettingsPanel 切到 72/96/120
--webos-icon-image-size:  calc(var(--webos-icon-size) * 0.58)
--webos-top-bar-height:   40px       # 左右胶囊 + dock 同高
--webos-top-bar-margin:   12px
--webos-window-head-height: 36px
--webos-taskbar-height:   48px       # 老变量，保留兼容（实际值改走 top-bar-height）
--webos-dock-height:      48px       # 同上
```

### z-index 层级

```
--webos-z-desktop:      1
--webos-z-icons:        10
--webos-z-windows:      100      # 起步；WindowManager 用 stack-based reflow，不会无限增长
--webos-z-taskbar:      1000     # 顶栏 + dock
--webos-z-popover:      10000    # 下拉面板（StartMenu 旧 dropdown / NotificationCenter / SettingsPanel）
--webos-z-notification: 100000   # 通知 toast
--webos-z-modal:        1000000  # 全屏遮罩（GlobalSearch overlay / launcher）
```

---

## 主题切换

`ThemeRegistry.instance.mode = 'dark'` → 给 `<html>` 加 `data-webos-theme="dark"` → CSS 变量级联生效。

**切换零运行时开销**：浏览器自动重绘所有 `var(--webos-*)`。

### 应用方跟随主题

iframe 应用要跟着切，订阅 `Webos.theme.on('change')` 后改自己的 CSS 变量。React + MUI 应用用 `<WebosThemeProvider>` 自动同步。

---

## 命名规则（BEM-ish）

```
.webos-{block}                      # 组件根
.webos-{block}-{element}            # 组件子元素
.webos-{block}--{modifier}          # 组件状态
.webos-{block}-{element}--{mod}     # 子元素状态
```

例：

```
.webos-window
.webos-window-head
.webos-window-head-title
.webos-window-action-btn
.webos-window-action-btn--close
.webos-window--active
.webos-window--dragging
.webos-window-resize-handle--nw
```

---

## SCSS 文件组织

```
styles/
├── index.scss          # @use 入口
├── tokens.scss         # CSS 变量定义（含浅 / 深主题）
├── reset.scss          # 全局 reset + .webos-btn / .webos-input 基础样式
├── desktop.scss        # 桌面 + 图标
├── window.scss         # 窗口 + resize handle
├── top-bar.scss        # 左 / 右上角胶囊
├── dock.scss           # 顶部居中 dock
├── dialog.scss         # alert / prompt / contextMenu / notification toast
└── shell.scss          # StartMenu / NotificationCenter / GlobalSearch / SettingsPanel / UserMenu
```

**新增组件 SCSS**：建独立文件，在 `index.scss` 里 `@use` 一行。

---

## 写组件 SCSS 的硬规则

### 1. 颜色 / 间距 / 圆角 / 阴影 / 字号 全走变量

```scss
// ✅
.my-thing {
  padding: var(--webos-spacing-md);
  background: var(--webos-color-bg-window);
  border-radius: var(--webos-radius-md);
}

// ❌
.my-thing {
  padding: 12px;
  background: #ffffff;
  border-radius: 6px;
}
```

### 2. 玻璃面板必带 backdrop-filter + 半透明背景

```scss
.my-panel {
  background: var(--webos-color-bg-glass-strong);
  backdrop-filter: blur(var(--webos-blur-strong));
  -webkit-backdrop-filter: blur(var(--webos-blur-strong));
  border: 1px solid var(--webos-color-border);
  border-radius: var(--webos-radius-lg);
  box-shadow: var(--webos-shadow-window);
}
```

### 3. 用 `&--shown` 控制开 / 关，配合 transition

```scss
.my-panel {
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity var(--webos-transition-fast),
              transform var(--webos-transition-fast);

  &--shown {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 4. SVG 图标用 `currentColor` + width/height 写在 SVG 属性

```html
<svg viewBox="0 0 24 24" width="18" height="18">
  <path stroke="currentColor" .../>
</svg>
```

容器 `.foo { color: var(--webos-color-text-muted) }`，hover 时 `color: var(--webos-color-text)`，SVG 自动跟。

### 5. 1px stroke 用 `shape-rendering: geometricPrecision`

```scss
> svg {
  shape-rendering: geometricPrecision;   // 防 1px 描边发糊
}
```

---

## 桌面图标布局 ⚠️ 易踩坑

`.webos-desktop-icons` 是 grid 容器，列优先（`grid-auto-flow: column`），行高 = `var(--webos-icon-size)`。

`.webos-icon-item` 内部 grid `1fr 32px`：图片自适应剩余 + label 固定 32px。

**禁忌**：
- ❌ 给 `.webos-icon-item-label` 加 `align-self: start` —— 在 grid + `display: -webkit-box` 上下文里会让 intrinsic size 算成 0 → 文字消失
- ❌ 给 `.webos-icon-item` 加 `overflow: visible` —— 长名字 label 会越界遮下一行
- ❌ 把 label 的 `display: -webkit-box` 换成别的 → 多行省略号失效

详见 [07-pitfalls-and-bug-history.md](./07-pitfalls-and-bug-history.md) "桌面 label 不显示" 那段。

---

## 窗口 / dock / 顶栏布局口径

- **窗口最大化**：`top: var(--top-bar-height) + 2*margin` / `right: 0 / bottom: 0 / left: 0`，让浏览器自己算尺寸（**不要用 calc(100vh - X) 嵌套**，会有 1-2px 渲染误差）
- **窗口拖动 bound**：上界 = top-bar 占位；下界 = `innerHeight - 40`（标题栏至少留 40 可见）
- **resize 热区**：8 个透明 div 盖在 iframe 上面（z-index 10 > iframe），看 [07 踩坑](./07-pitfalls-and-bug-history.md) 跨 origin iframe 那段

---

## 想加新主题？

不要改 tokens.scss 的 `:root` 默认值。新增主题：

```scss
[data-webos-theme="solarized"] {
  --webos-color-primary: #268bd2;
  --webos-color-bg-base: #fdf6e3;
  // ... 覆盖你想改的颜色
}
```

然后 ThemeRegistry 加注册逻辑。详见 `docs/THEME_DEVELOPER_GUIDE.md`。

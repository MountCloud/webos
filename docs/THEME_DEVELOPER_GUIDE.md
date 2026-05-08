# 主题开发指南

webos 主题系统基于 **CSS 变量**，浅色/深色切换零运行时开销，支持自定义主题。

---

## 1. 心智模型

webos 在 `<html data-theme="light|dark">` 上切换 `data-theme` 属性，**所有 UI 都通过 `var(--webos-*)` CSS 变量取色**。这意味着：

- 切换主题就是改一个 attribute——浏览器自动重绘
- 自定义主题 = 写一组 CSS 变量
- 你的应用想跟随主题：订阅 `Webos.theme.on('change')` + 在自己的 CSS 里也用 webos 变量

---

## 2. 内置变量（Design Tokens）

> 完整列表见 `apps/webos-shell/src/styles/_tokens.scss`。下面是最常用的一组。

### 颜色 - 背景层

| 变量 | light | dark | 用途 |
|------|-------|------|------|
| `--webos-bg-base` | `#f5f7fa` | `#1a202c` | 桌面背景 |
| `--webos-bg-window` | `#ffffff` | `#2d3748` | 窗口主体 |
| `--webos-bg-elevated` | `#ffffff` | `#374151` | 弹层、对话框 |
| `--webos-bg-hover` | `#edf2f7` | `#4a5568` | 悬停态 |
| `--webos-bg-active` | `#e2e8f0` | `#525f72` | 激活态 |

### 颜色 - 文字

| 变量 | light | dark |
|------|-------|------|
| `--webos-fg-primary` | `#1a202c` | `#f7fafc` |
| `--webos-fg-secondary` | `#4a5568` | `#cbd5e0` |
| `--webos-fg-muted` | `#718096` | `#a0aec0` |
| `--webos-fg-inverse` | `#ffffff` | `#1a202c` |

### 颜色 - 强调

| 变量 | 含义 |
|------|------|
| `--webos-accent` | 主色（默认蓝） |
| `--webos-accent-hover` | 主色悬停 |
| `--webos-success` | 成功（绿） |
| `--webos-warning` | 警告（黄/橙） |
| `--webos-danger` | 危险（红） |

### 边框 / 阴影

| 变量 | 含义 |
|------|------|
| `--webos-border` | 通用边框色 |
| `--webos-border-strong` | 强边框 |
| `--webos-shadow-sm` | 小阴影 |
| `--webos-shadow-md` | 中阴影（卡片） |
| `--webos-shadow-lg` | 大阴影（弹层） |

### 圆角 / 间距

| 变量 | 值 |
|------|-----|
| `--webos-radius-sm` | 4px |
| `--webos-radius-md` | 6px |
| `--webos-radius-lg` | 10px |
| `--webos-space-1` | 4px |
| `--webos-space-2` | 8px |
| `--webos-space-3` | 12px |
| `--webos-space-4` | 16px |

---

## 3. 在自己的应用里用变量

### 直接读 CSS 变量

```css
.my-button {
  background: var(--webos-accent);
  color: var(--webos-fg-inverse);
  padding: var(--webos-space-2) var(--webos-space-4);
  border-radius: var(--webos-radius-md);
  box-shadow: var(--webos-shadow-sm);
}

.my-button:hover {
  background: var(--webos-accent-hover);
}
```

应用主题切换时**完全不用改代码**——浏览器会自动应用新值。

### 跟随主题切换

iframe 内并不会自动同步父窗口的 `data-theme`。需要订阅推送：

```js
import { Webos } from '@webos/host-sdk'

// 启动时同步
Webos.theme.current().then((theme) => {
  document.documentElement.dataset.theme = theme
})

// 之后跟随
Webos.theme.on('change', (theme) => {
  document.documentElement.dataset.theme = theme
})
```

然后你的 CSS 用 `[data-theme="dark"]` 选择器：

```css
:root {
  --my-bg: #fff;
  --my-fg: #000;
}
[data-theme="dark"] {
  --my-bg: #1a202c;
  --my-fg: #f7fafc;
}
```

或者**直接读 webos 的变量**——不需要自己定义：

```js
const tokens = await Webos.theme.getTokens()
console.log(tokens['--webos-accent'])   // 当前主题下的真实值
```

---

## 4. 自定义主题

webos 默认提供 `light` / `dark`。要加新主题：

### 4.1 写主题样式

新建 `apps/webos-shell/src/styles/themes/_solarized.scss`：

```scss
[data-theme="solarized"] {
  --webos-bg-base: #fdf6e3;
  --webos-bg-window: #eee8d5;
  --webos-bg-elevated: #ffffff;
  --webos-bg-hover: #e8e2cc;
  --webos-bg-active: #d8d2bb;

  --webos-fg-primary: #073642;
  --webos-fg-secondary: #586e75;
  --webos-fg-muted: #93a1a1;
  --webos-fg-inverse: #fdf6e3;

  --webos-accent: #268bd2;
  --webos-accent-hover: #1f6fa8;
  --webos-success: #859900;
  --webos-warning: #b58900;
  --webos-danger: #dc322f;

  --webos-border: #d8d2bb;
  --webos-border-strong: #93a1a1;
}
```

把它加到 `apps/webos-shell/src/styles/index.scss`：

```scss
@use './themes/solarized';
```

### 4.2 注册到 ThemeRegistry

```ts
import { ThemeRegistry } from '@webos/shell'

ThemeRegistry.instance.register({
  id: 'solarized',
  name: 'Solarized',
  base: 'light',     // 算 light 还是 dark：影响系统状态颜色推断
})
```

### 4.3 切换

```ts
ThemeRegistry.instance.mode = 'solarized'
```

或者用户通过设置面板 / 命令面板切（V1.5）。

---

## 5. 主题事件

`ThemeRegistry` 是 EventEmitter：

```ts
import { ThemeRegistry } from '@webos/shell'

ThemeRegistry.instance.on('modeChanged', (mode) => {
  console.log('用户选了：', mode)   // 'light' | 'dark' | 'auto' | 自定义 id
})

ThemeRegistry.instance.on('effectiveThemeChanged', (theme) => {
  console.log('实际生效的：', theme) // 'light' | 'dark'（auto 模式被解析后）
})
```

`auto` 模式会跟随 `prefers-color-scheme` 并随系统切换实时变化。

---

## 6. 测试主题的 checklist

- [ ] 浅色 / 深色 / auto 三种 mode 切换流畅
- [ ] 任务栏、桌面图标、窗口标题栏在两种主题下都清晰
- [ ] 对话框、通知卡片、上下文菜单的对比度足够
- [ ] iframe 应用收到 `theme.changed` 事件
- [ ] 浏览器系统主题切换时（auto 模式）实时反应
- [ ] 颜色对比度 ≥ AA 级别（前景/背景对比度 ≥ 4.5:1）

可以用 Chrome DevTools 的 Rendering 面板模拟 `prefers-color-scheme`。

---

## 7. 常见问题

**Q：能不能给单个窗口指定独立主题？**
A：V1 没有。所有窗口共享同一个 `data-theme`。

**Q：iframe 应用不跟随主题怎么办？**
A：检查应用是否订阅了 `Webos.theme.on('change')`，并在收到事件时改自己的样式。

**Q：变量太多记不住？**
A：直接看 `apps/webos-shell/src/styles/_tokens.scss`——它就是 single source of truth。或者运行时 `await Webos.theme.getTokens()` 拿到完整列表。

**Q：能不能用 Tailwind？**
A：可以。把 webos 的 CSS 变量作为 Tailwind 的 color 配置即可：

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'webos-bg': 'var(--webos-bg-base)',
        'webos-fg': 'var(--webos-fg-primary)',
        'webos-accent': 'var(--webos-accent)',
      },
    },
  },
}
```

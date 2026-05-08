# 示例 02 - Vanilla JS + Vite

不用任何前端框架，但通过 Vite 走标准的 ESM + 打包流程。

## 结构

```
02-vanilla-js-vite/
├── index.html
├── manifest.json
├── package.json
├── vite.config.js
└── src/
    ├── main.js
    └── style.css
```

## 怎么跑

```bash
pnpm install
pnpm dev   # http://localhost:5501
```

`manifest.json` 里的 `entry` 已经指向 `http://localhost:5501/`，把它注册到 webos 后双击图标即可。

## 关键点

- 直接 `import { Webos } from '@webos/host-sdk'`，类型提示和自动补全都有
- 打包后产出位于 `dist/`，部署任何静态服务器都能跑
- SDK 会在脚本加载时自动 `install()` 监听父窗口消息，无需手动初始化

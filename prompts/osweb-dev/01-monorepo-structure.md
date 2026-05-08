# 01 · monorepo 结构

## 目录布局

```
osweb/
├── apps/
│   └── webos-shell/             # 桌面壳 SPA（@webos/shell，private）
│       ├── src/
│       │   ├── core/            # 内核：UIElement / window / dock / dialog / desktop
│       │   ├── shell/           # 外壳：TopLeftBar / TopRightBar / StartMenu / NotificationCenter / GlobalSearch / SettingsPanel / UserMenu
│       │   ├── apps/            # 应用容器：AppRegistry / AppLoader / AppMessageBus / AppManifest / AppSource / builtinHandlers
│       │   ├── user/            # UserSession singleton
│       │   ├── theme/           # ThemeRegistry singleton
│       │   ├── i18n/            # I18n singleton + zh/en 字典
│       │   ├── helpers/         # dom / contextMenu / download / persist / touch
│       │   ├── util/            # EventEmitter / id / 类型工具
│       │   ├── styles/          # SCSS：tokens / reset / desktop / window / dialog / top-bar / dock / shell
│       │   └── main.ts          # bootstrap
│       ├── public/              # wallpaper-default.jpg / 静态资源
│       ├── vite.config.ts       # Vite + 自定义中间件托管 /examples 和 /packages
│       └── tsconfig.json
├── packages/
│   ├── host-sdk/                # @webos/host-sdk（公开 npm 包）
│   │   ├── src/
│   │   │   ├── core/            # RpcClient + types（User / TokenInfo / RpcRequest）
│   │   │   ├── modules/         # 14 个模块：notify / dialog / window / app / user / ...
│   │   │   ├── session.ts       # 同 origin 登录页 + UserSession 共用的纯函数
│   │   │   └── index.ts         # 总导出
│   │   └── rollup.config.js     # ESM + CJS + UMD + .d.ts
│   └── mui-theme/               # @webos/mui-theme（公开 npm 包；React + MUI 主题适配）
│       └── src/
│           ├── theme.ts         # createWebosTheme(options) → MUI Theme
│           ├── useWebosTheme.ts # React hook，自动同步主题
│           ├── WebosThemeProvider.tsx
│           └── tokens.ts
├── examples/
│   ├── 01-vanilla-html/         # 纯 HTML + UMD CDN
│   ├── 02-vanilla-js-vite/      # Vanilla JS + Vite（5501）
│   ├── 03-vue-js/               # Vue 3 + JS（5502）
│   ├── 04-react-ts/             # React 18 + TS（5503）
│   ├── 05-jquery-legacy/        # jQuery + UMD
│   └── 06-react-mui/            # ⭐ React + MUI（5504，推荐生产用法）
├── docs/                        # 给应用开发者读的产品文档
├── prompts/                     # 给 AI 助手读的协作约束（本目录）
├── package.json                 # 根 monorepo 配置 + dev:all 脚本
├── pnpm-workspace.yaml          # workspace 声明
└── tsconfig.base.json           # 共用 TS 配置
```

## 包之间的依赖规则

```
apps/webos-shell  ──depends on──→  packages/host-sdk
                                         ↑
                                         │
            packages/mui-theme  ──peer──┘ + react + @mui/material

examples/06-react-mui  ──depends on──→  host-sdk + mui-theme + react + @mui/material
examples/02 / 03 / 04   ──depends on──→  host-sdk
examples/01 / 05        ──script src──→  host-sdk UMD（不走 npm）
```

**关键约束**：
- `apps/webos-shell` 引 `@webos/host-sdk` **只为复用 session 模块**（`writeWebosSession` 等纯函数 + `User / TokenInfo` 类型）。**不引 RpcClient**（shell 是 RPC 的接收方，不发起方）
- `packages/host-sdk` **不能反向引** `apps/webos-shell` 的任何东西。SDK 是独立可发布的库
- `packages/mui-theme` 仅依赖 host-sdk 的 types + `Webos.theme` API；不依赖 webos-shell

## 包名速查

| package.json `name` | 实际位置 | 是否 publish |
|---------------------|----------|--------------|
| `@webos/shell` | `apps/webos-shell` | ❌ private（最终是 SPA 部署，不发 npm） |
| `@webos/host-sdk` | `packages/host-sdk` | ✅ npm 公开包（应用方装它） |
| `@webos/mui-theme` | `packages/mui-theme` | ✅ npm 公开包（React + MUI 应用装它） |
| `example-*` | `examples/*` | ❌ private |

## workspace 操作速查

```bash
# 全部装
pnpm install

# 起 webos shell + 4 个 Vite 示例
pnpm dev:all

# 单独起某个
pnpm --filter @webos/shell dev
pnpm --filter example-react-mui dev

# 单独 build 某个
pnpm --filter @webos/host-sdk build      # 改 SDK 后必须 build，shell 才能用到新方法
pnpm --filter @webos/mui-theme build
pnpm --filter @webos/shell build

# 全部 build
pnpm build

# TS check 某包（不构建）
"E:/project/html/osweb/apps/webos-shell/node_modules/.bin/tsc" --noEmit -p apps/webos-shell/tsconfig.json
```

## 修改后必做的依赖刷新

| 改了什么 | 必须做的 |
|----------|---------|
| `packages/host-sdk` 的源码 | `pnpm --filter @webos/host-sdk build` —— 重生成 ESM/CJS/UMD/.d.ts；shell 和示例都依赖 dist |
| `packages/mui-theme` 的源码 | `pnpm --filter @webos/mui-theme build` —— 同上 |
| 新增/删除 workspace 包 | `pnpm install` 重链接 |
| 新增 `examples/0X-...` | 在根 `package.json` 的 `dev:all` 脚本里加 `--filter=example-name`，改 `apps/webos-shell/src/main.ts` 注册到 AppRegistry |

## 文件命名约定

- 类文件：`PascalCase.ts`（Window.ts / AppLoader.ts / UserSession.ts）
- 工具 / 函数模块：`camelCase.ts` 或 `kebab-case.ts`（dom.ts / contextMenu.ts / persist.ts / builtinHandlers.ts）
- 索引：`index.ts` 仅做 re-export，不写实质代码
- SCSS：`kebab-case.scss`（top-bar.scss / dock.scss）
- React TSX：`PascalCase.tsx`（如 `WebosThemeProvider.tsx`）

## 测试 / lint / 工具

- 当前没有写测试（测试目录 `tests/{e2e,integration,unit}` 是占位）
- ESLint 配置在 `apps/webos-shell` 的 `package.json` 里有 `lint` 脚本但没有 .eslintrc
- prettier 在根 devDeps 里，没配置规则文件 —— 按 TS 默认风格

未来可能补单元测试（Vitest）和 e2e（Playwright），目前不做。

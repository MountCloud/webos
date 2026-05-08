# webos 技术栈决策

> **作者**：MountCloud `<mountcloud@outlook.com>`
> **状态**：v1.0 已锁定

---

## 一、核心栈

| 维度 | 选型 | 理由 |
|---|---|---|
| **语言** | TypeScript 5.x | 强类型、维护友好、IDE 支持完善 |
| **运行时目标** | 现代浏览器（Chrome 100+ / Edge / Firefox 100+ / Safari 15+） | ES2020+ 原生支持、不需 polyfill 主流 API |
| **DOM 操作** | 原生 DOM API | 不引入 jQuery，减少依赖、性能更好 |
| **模块系统** | ESM | 标准 |
| **构建工具** | Vite 5.x | 比 webpack 快 10x、ESM 原生、配置简单 |
| **Monorepo** | pnpm workspaces + Turborepo | 国内主流、性能好 |
| **样式** | SCSS + CSS Variables | SCSS 写源码，CSS Variables 支持运行时主题切换 |

---

## 二、第三方库

| 用途 | 库 | License | 备注 |
|---|---|---|---|
| 拖拽 / 缩放 | **interact.js** | MIT | 替代 jQuery UI，现代化 |
| 框选（多选） | **viselect** | MIT | Puter 也用这个，质量好 |
| HTML 转义 | **he** | BSD-2 | 简单可靠 |
| 移动端检测 | **mobile-detect** | MIT | |
| 时间格式化 | **dayjs** | MIT | 比 moment 轻 |
| 路径处理 | **path-browserify** | MIT | 浏览器版 path |
| 颜色选择器 | **@simonwep/pickr** | MIT | 现代颜色选择器 |
| QR 码生成 | **qrcode** | MIT | |
| 事件总线 | **mitt** | MIT | 仅 200 字节 |
| Glob 匹配 | **picomatch** | MIT | |

**禁止引入的库**：
- ❌ jQuery / jQuery UI（用现代 DOM）
- ❌ Vue / React（webos 是底层运行时，不能绑定框架）
- ❌ Angular / Svelte（同上）
- ❌ Lodash 全量（按需用 `lodash-es` 单函数）

---

## 三、TypeScript 配置

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "useDefineForClassFields": true
  }
}
```

---

## 四、SDK 打包

webos 现在提供两个 npm 子包：

### `@webos/host-sdk` —— 应用通用 SDK（任意栈）

| 输出 | 格式 | 用途 |
|---|---|---|
| dist/host-sdk.esm.js | ESM | 现代构建工具（import）|
| dist/host-sdk.cjs.js | CommonJS | Node / 老构建（require）|
| dist/host-sdk.umd.js | UMD | 浏览器 `<script>` 直接引（CDN）|
| dist/host-sdk.d.ts | TypeScript | 类型声明（可选用）|

### `@webos/mui-theme` —— React + MUI 应用专用主题适配

| 输出 | 格式 | 用途 |
|---|---|---|
| dist/mui-theme.esm.js | ESM | React 应用 import |
| dist/mui-theme.cjs.js | CommonJS | Node SSR 等场景 |
| dist/mui-theme.d.ts | TypeScript | 类型声明 |

peer dependencies：`@mui/material`、`react`、`react-dom`、`@webos/host-sdk`（可选，找不到时 fallback `prefers-color-scheme`）。

**打包工具**：Rollup 4.x（更适合库打包，比 Vite 库模式更精细）

---

## 五、测试

| 类型 | 工具 |
|---|---|
| 单元测试 | Vitest（与 Vite 同源、快） |
| E2E 测试 | Playwright（跨浏览器） |
| 视觉回归 | Playwright + screenshot diff |
| 性能测试 | Lighthouse CI |

---

## 六、代码质量

| 工具 | 用途 |
|---|---|
| ESLint | 代码规范 |
| Prettier | 格式化 |
| husky | git hooks |
| lint-staged | commit 前自动 lint |
| commitlint | commit message 规范 |

---

## 七、部署

webos 默认是**纯静态**：

```
build → dist/ 目录（HTML + JS + CSS）
   ↓
托管：任何静态文件服务（nginx / S3 / CDN / Vercel / Spring Boot static/）
```

可选：使用方把 dist 拷贝到自己的 Spring Boot `src/main/resources/static/`，打成 fat jar 一键启动。

---

## 八、版本与兼容性

- **Node.js**：>= 20（开发用）
- **pnpm**：>= 8
- **浏览器**：Chrome 100+ / Edge 100+ / Firefox 100+ / Safari 15+
- 不支持 IE / 老 Edge（< 100）

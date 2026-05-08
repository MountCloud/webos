# create-webos-app

脚手架 CLI：一行命令创建 webos 应用，含 8 种模板（React+MUI / Vue / Vanilla / jQuery 等）。

---

## 安装

`create-*` 系列 CLI **不需要预先安装** —— 直接走 npm/pnpm/yarn 的 `create` 约定即可：

```bash
npm create webos-app my-app
# 或
pnpm create webos-app my-app
# 或
yarn create webos-app my-app
```

等价于 `npx create-webos-app my-app` —— 临时下载并运行，**用完就清理**，不污染全局。

### 在 webos 还没发到 npm 之前（开发期）

webos 仓库本身还没把 `create-webos-app` 发布到 npm。如果你在本地 clone 了 webos 仓库，三种方式可用：

#### 方式 1 · 直接 node 跑（最简）

```bash
node /path/to/osweb/packages/create-webos-app/bin/cli.mjs my-app -t react-mui-js
```

#### 方式 2 · 全局 link（推荐开发期使用）

```bash
cd /path/to/osweb/packages/create-webos-app
pnpm link --global       # 或 npm link
```

之后任意目录都能直接调：

```bash
create-webos-app my-app -t react-mui-js
```

不想用了：

```bash
cd /path/to/osweb/packages/create-webos-app
pnpm unlink --global
```

#### 方式 3 · 一次性 dlx 跑本地路径

```bash
pnpm dlx file:/path/to/osweb/packages/create-webos-app my-app -t react-mui-js
```

---

## 用法

### 交互式（推荐）

```bash
npm create webos-app
```

会依次问：

1. 项目名 / 目录名
2. 选模板（8 选 1）
3. manifest 的 appId（默认从项目名推断）
4. 应用显示名（默认 = 项目名）

### 非交互式（CI 友好）

```bash
npx create-webos-app my-app -t react-mui-js
npx create-webos-app my-app --template vue-js \
  --app-id com.acme.myapp \
  --display-name "我的应用"

# 全部用默认值（不问任何问题）
npx create-webos-app my-app -t react-mui-js -y
```

非 TTY 环境（CI / 管道重定向）会自动跳过交互问题，用默认值。

---

## 模板一览

| ID | 模板 | 适合 |
|----|------|------|
| `react-mui-js` | React + MUI · JavaScript | ⭐ 生产推荐（不用 TS）|
| `react-mui-ts` | React + MUI · TypeScript | 同上但带类型 |
| `react-js` | React · JavaScript | 不用 MUI 的 React 应用 |
| `react-ts` | React · TypeScript | 同上带 TS |
| `vue-js` | Vue 3 · JavaScript | Vue 团队 |
| `vanilla-js` | Vanilla JS · Vite | 无框架但要打包 |
| `vanilla-html` | Vanilla HTML | 零构建（CDN UMD） |
| `jquery` | jQuery · UMD | 老项目无痛接入 |

每个模板都是一个**完整可运行的 webos 应用骨架**，含：

- `package.json` / 构建配置
- `index.html` + 入口源码
- `manifest.json`（webos 应用清单）
- `README.md`（启动 + 注册说明）
- `.gitignore`

---

## 生成后

```bash
cd my-app
pnpm install
pnpm dev          # http://localhost:5173
```

把 `manifest.json` 注册到 webos shell（详见生成项目里的 README.md）。

---

## 全部命令行选项

```
-t, --template <id>     模板 ID（不传走交互式）
    --app-id <id>       manifest.appId（默认从项目名推断）
    --display-name <s>  manifest.name（默认 = 项目名）
-y, --yes               全部用默认值（非交互；CI 友好）
-h, --help              帮助
-v, --version           版本
```

---

## 发布到 npm（维护者用）

如果你是 webos 维护者要把 CLI 发到 npm：

```bash
cd packages/create-webos-app

# 登录（首次）
npm login

# 发布
npm publish --access=public
```

`--access=public` 是因为 `create-` 前缀按 npm 规范默认 public scope，写明确更稳。

发布前确认 `package.json` 里 `version` 字段已经 bump（不能重复发同一个版本号）。

发布后任何人都能：

```bash
npx create-webos-app my-app
```

---

## License

MIT · MountCloud

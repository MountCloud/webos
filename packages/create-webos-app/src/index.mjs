/**
 * create-webos-app CLI 主入口
 *
 * 用法：
 *   npx create-webos-app                    # 全交互
 *   npx create-webos-app my-app             # 指定项目名
 *   npx create-webos-app my-app -t react-mui-js
 *   npx create-webos-app my-app --template vue-js
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, resolve, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import prompts from 'prompts'
import { cyan, green, yellow, red, bold, dim, reset } from 'kolorist'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ===== 模板注册 =====
// 每个模板对应 templates/<id>/ 目录
const TEMPLATES = [
  {
    id: 'react-mui-js',
    name: 'React + MUI · JavaScript',
    color: cyan,
    desc: '生产推荐：React 18 + MUI v5 + WebosThemeProvider（不用 TS）',
  },
  {
    id: 'react-mui-ts',
    name: 'React + MUI · TypeScript',
    color: cyan,
    desc: '同上但带 TS 类型',
  },
  {
    id: 'react-js',
    name: 'React · JavaScript',
    color: cyan,
    desc: 'React 18 + Vite，纯 React 不带 UI 库',
  },
  {
    id: 'react-ts',
    name: 'React · TypeScript',
    color: cyan,
    desc: 'React 18 + Vite + TS',
  },
  {
    id: 'vue-js',
    name: 'Vue 3 · JavaScript',
    color: green,
    desc: 'Vue 3 SFC + Composition API + Vite',
  },
  {
    id: 'vanilla-js',
    name: 'Vanilla JS · Vite',
    color: yellow,
    desc: '无框架 + Vite + ESM',
  },
  {
    id: 'vanilla-html',
    name: 'Vanilla HTML',
    color: yellow,
    desc: '纯 HTML + UMD CDN，零构建（最简）',
  },
  {
    id: 'jquery',
    name: 'jQuery · UMD',
    color: yellow,
    desc: '老项目场景：jQuery + UMD 一行 script 接入',
  },
]

// ===== 入口 =====
export async function run() {
  console.log()
  console.log(bold(cyan('  create-webos-app')) + dim(` v${pkgVersion()}`))
  console.log(dim('  脚手架：创建 webos 应用'))
  console.log()

  const argv = parseArgs(process.argv.slice(2))

  // 1. 项目名
  let projectName = argv._[0]
  if (!projectName) {
    const r = await prompts(
      {
        type: 'text',
        name: 'projectName',
        message: '项目名 / 目录名：',
        initial: 'my-webos-app',
        validate: (v) =>
          /^[a-zA-Z0-9_.-]+$/.test(v) || '只允许字母、数字、_ . -',
      },
      { onCancel },
    )
    projectName = r.projectName
  }
  const targetDir = resolve(process.cwd(), projectName)

  // 2. 目录冲突检查
  if (existsSync(targetDir)) {
    const items = readdirSync(targetDir)
    if (items.length > 0) {
      const r = await prompts(
        {
          type: 'confirm',
          name: 'overwrite',
          message: `目录 ${red(projectName)} 已存在且非空，覆盖？`,
          initial: false,
        },
        { onCancel },
      )
      if (!r.overwrite) {
        console.log(red('✗ 已取消'))
        process.exit(1)
      }
      // 简单清空（不删目录本身）
      for (const it of items) {
        const p = join(targetDir, it)
        if (statSync(p).isDirectory()) rmDirRecursive(p)
        else require('node:fs').unlinkSync(p)
      }
    }
  } else {
    mkdirSync(targetDir, { recursive: true })
  }

  // 3. 模板选择
  let templateId = argv.template || argv.t
  if (templateId && !TEMPLATES.find((t) => t.id === templateId)) {
    console.log(red(`✗ 未知模板：${templateId}`))
    console.log(dim('  可选：' + TEMPLATES.map((t) => t.id).join(', ')))
    process.exit(1)
  }
  if (!templateId) {
    const r = await prompts(
      {
        type: 'select',
        name: 'templateId',
        message: '选择模板：',
        choices: TEMPLATES.map((t) => ({
          title: t.color(t.name),
          description: t.desc,
          value: t.id,
        })),
        initial: 0,
      },
      { onCancel },
    )
    templateId = r.templateId
  }
  const template = TEMPLATES.find((t) => t.id === templateId)

  // 是否非交互（命令行带 -y / 非 TTY / 显式给了 appId 和 displayName）
  const nonInteractive =
    argv.yes || !process.stdin.isTTY || (argv.appId !== undefined && argv.displayName !== undefined)

  const defaultAppId = projectName.toLowerCase().replace(/[^a-z0-9_.-]/g, '-')

  // 4. 应用 ID（manifest.appId）
  let appId = argv.appId
  if (appId === undefined) {
    if (nonInteractive) {
      appId = defaultAppId
    } else {
      const r3 = await prompts(
        {
          type: 'text',
          name: 'appId',
          message: '应用 ID（manifest.appId）：',
          initial: defaultAppId,
          validate: (v) => /^[a-zA-Z0-9_.-]+$/.test(v) || '只允许字母、数字、_ . -',
        },
        { onCancel },
      )
      appId = r3.appId
    }
  }

  // 5. 应用显示名
  let displayName = argv.displayName
  if (displayName === undefined) {
    if (nonInteractive) {
      displayName = projectName
    } else {
      const r4 = await prompts(
        {
          type: 'text',
          name: 'displayName',
          message: '应用显示名（manifest.name）：',
          initial: projectName,
        },
        { onCancel },
      )
      displayName = r4.displayName
    }
  }

  // ===== 复制模板 =====
  console.log()
  console.log(dim(`复制模板 ${template.color(templateId)} → ${targetDir}`))
  const templateDir = join(__dirname, '..', 'templates', templateId)
  if (!existsSync(templateDir)) {
    console.log(red(`✗ 模板目录不存在：${templateDir}`))
    process.exit(1)
  }
  copyDirRecursive(templateDir, targetDir)

  // 重命名 _.gitignore → .gitignore（npm publish 会过滤 .gitignore）
  const gi = join(targetDir, '_.gitignore')
  if (existsSync(gi)) renameSync(gi, join(targetDir, '.gitignore'))

  // 替换变量
  const replaceMap = {
    __PROJECT_NAME__: projectName,
    __APP_ID__: appId,
    __DISPLAY_NAME__: displayName,
  }
  walkAndReplace(targetDir, replaceMap)

  // ===== 完成 =====
  const pm = detectPackageManager()
  const isCDN = templateId === 'vanilla-html' || templateId === 'jquery'
  const usesHostSdk = templateId !== 'vanilla-html'  // 全部都用 host-sdk；vanilla-html / jquery 走 UMD
  const usesMuiTheme = templateId === 'react-mui-js' || templateId === 'react-mui-ts'

  console.log()
  console.log(bold(green('✓ 完成！')) + ` 接下来：`)
  console.log()
  if (basename(targetDir) !== process.cwd()) {
    console.log(`  ${cyan(`cd ${projectName}`)}`)
  }

  if (isCDN) {
    // jquery / vanilla-html 走 UMD CDN：@webos/host-sdk 不在 npm，jsdelivr 也拿不到
    // 用户需要从 webos 拷 dist/host-sdk.umd.js 到本地
    console.log(yellow('  ⚠ 本模板用 UMD 引用 @webos/host-sdk，由于团队不发 npm，'))
    console.log(yellow('    CDN 路径 (https://cdn.jsdelivr.net/npm/@webos/host-sdk/...) 会 404！'))
    console.log(yellow('    解决方法：从 webos/packages/host-sdk/dist/ 拷 host-sdk.umd.js'))
    console.log(yellow('    到本项目，再把 index.html 里的 <script src="..."> 改成相对路径。'))
    console.log()
    console.log(`  ${cyan(`${pm === 'npm' ? 'npx' : pm} serve`)} ${dim('# 或任意静态服务器')}`)
  } else if (usesHostSdk) {
    // 有 package.json 的模板：必须先 npm link 再 npm install
    console.log(dim('  ⚠ 第一次启动前必读 PREREQUISITES.md：'))
    console.log(dim('    @webos/host-sdk 不在 npm registry 上，要先 npm link 接本地 webos。'))
    console.log()
    const linkArgs = usesMuiTheme
      ? '@webos/host-sdk @webos/mui-theme'
      : '@webos/host-sdk'
    console.log(`  ${cyan(`${pm} link ${linkArgs}`)}   ${dim('# 一次性，前提是已在 webos 那边做过 npm link')}`)
    console.log(`  ${cyan(`${pm} install`)}`)
    console.log(`  ${cyan(`${pm} run dev`)}`)
  }

  console.log()
  console.log(dim('  把 manifest.json 注册到 webos shell 才能在桌面看到 ↑'))
  console.log(dim('  详见生成项目里的 README.md / PREREQUISITES.md'))
  console.log()
}

// ===== helpers =====

function pkgVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-t' || a === '--template') {
      out.template = argv[++i]
    } else if (a.startsWith('--template=')) {
      out.template = a.slice('--template='.length)
    } else if (a === '--app-id') {
      out.appId = argv[++i]
    } else if (a.startsWith('--app-id=')) {
      out.appId = a.slice('--app-id='.length)
    } else if (a === '--display-name') {
      out.displayName = argv[++i]
    } else if (a.startsWith('--display-name=')) {
      out.displayName = a.slice('--display-name='.length)
    } else if (a === '-y' || a === '--yes') {
      out.yes = true
    } else if (a === '-h' || a === '--help') {
      printHelp()
      process.exit(0)
    } else if (a === '-v' || a === '--version') {
      console.log(pkgVersion())
      process.exit(0)
    } else if (!a.startsWith('-')) {
      out._.push(a)
    }
  }
  return out
}

function printHelp() {
  console.log(`
${bold('create-webos-app')} - 创建 webos 应用

${bold('用法:')}
  npx create-webos-app [项目名] [选项]

${bold('选项:')}
  -t, --template <id>     模板 ID（不传走交互式）
      --app-id <id>       manifest.appId（默认从项目名推断）
      --display-name <s>  manifest.name（默认 = 项目名）
  -y, --yes               全部用默认值（非交互；CI 友好）
  -h, --help              帮助
  -v, --version           版本

${bold('可用模板:')}
${TEMPLATES.map((t) => `  ${t.color(t.id.padEnd(18))} ${t.desc}`).join('\n')}

${bold('示例:')}
  ${dim('npx create-webos-app my-app')}
  ${dim('npx create-webos-app my-app -t react-mui-js')}
  ${dim('npx create-webos-app my-app --template vue-js')}
`)
}

function onCancel() {
  console.log(red('✗ 已取消'))
  process.exit(1)
}

function copyDirRecursive(src, dst) {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true })
  for (const it of readdirSync(src)) {
    const sp = join(src, it)
    const dp = join(dst, it)
    if (statSync(sp).isDirectory()) copyDirRecursive(sp, dp)
    else copyFileSync(sp, dp)
  }
}

function rmDirRecursive(p) {
  for (const it of readdirSync(p)) {
    const fp = join(p, it)
    if (statSync(fp).isDirectory()) rmDirRecursive(fp)
    else require('node:fs').unlinkSync(fp)
  }
  require('node:fs').rmdirSync(p)
}

function walkAndReplace(dir, map) {
  for (const it of readdirSync(dir)) {
    const fp = join(dir, it)
    if (statSync(fp).isDirectory()) {
      // 跳过 node_modules / dist
      if (it === 'node_modules' || it === 'dist') continue
      walkAndReplace(fp, map)
    } else {
      // 仅文本类才替换
      if (!/\.(json|md|html|css|scss|js|jsx|ts|tsx|vue|mjs|cjs|txt|svg)$/i.test(it)) continue
      let content = readFileSync(fp, 'utf-8')
      let changed = false
      for (const [k, v] of Object.entries(map)) {
        if (content.includes(k)) {
          content = content.split(k).join(v)
          changed = true
        }
      }
      if (changed) writeFileSync(fp, content, 'utf-8')
    }
  }
}

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || ''
  if (ua.startsWith('pnpm')) return 'pnpm'
  if (ua.startsWith('yarn')) return 'yarn'
  if (ua.startsWith('bun')) return 'bun'
  return 'npm'
}

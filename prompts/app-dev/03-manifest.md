# 03 · Manifest 字段

应用清单 = 给 webos 看的"应用身份证 + 启动单元清单"。

顶层放应用元信息；启动相关字段（`uri` / `launchMode` / `defaultWindow` / `showIn` / `singleInstance` / `permissions` / `features`）写在 `entries[i]` 里。一个应用可以有多个 entry，每个 entry = 一个独立的桌面图标 / 启动方式。完整规范见 [docs/APP_MANIFEST_SPEC.md](../../docs/APP_MANIFEST_SPEC.md)。

完整接口：

```ts
interface AppManifest {
  // ===== 必填 =====
  appId: string                         // 唯一 ID，正则 /^[a-zA-Z0-9_.-]+$/
  name: string                          // 应用本身显示名（商店 / 关于 用）
  entries: AppEntry[]                   // 至少一个 entry

  // ===== 可选元信息 =====
  nameI18n?: Record<string, string>
  version?: string
  vendor?: string
  description?: string
  icon?: string                         // 应用图标（商店 / 关于；桌面渲染走 entry.icon）
  category?: string
  tags?: string[]

  // ===== 扩展点（可选）=====
  contributes?: AppContributes
}

interface AppEntry {
  id: string                            // 应用内唯一
  name: string                          // 桌面 / 菜单 / 搜索结果显示名
  icon: string                          // 桌面图标
  uri: string                           // 入口 URL（绝对 URL 或 / 开头根相对路径）

  description?: string

  launchMode?: 'window' | 'tab'         // 默认 'window'
  defaultWindow?: {
    width?: number | string
    height?: number | string
    minWidth?: number
    minHeight?: number
    resizable?: boolean
    maximizable?: boolean
  }

  showIn?: ('desktop' | 'start-menu' | 'app-store')[]
  order?: number
  singleInstance?: boolean              // per-entry，不影响其他 entry
  permissions?: string[]
  features?: AppFeature[]
}

interface AppFeature {
  id: string                            // 该 entry 内唯一
  name: string
  description?: string
  icon?: string                         // 不传则继承 entry.icon
  uri: string                           // 相对 entry.uri 的子路径 / 查询串 / hash
  keywords?: string[]
  category?: string
}
```

---

## 一个最小 manifest（单入口）

```json
{
  "appId": "com.acme.crm",
  "name": "客户管理",
  "icon": "https://cdn.acme.com/crm.svg",
  "entries": [
    {
      "id": "main",
      "name": "客户管理",
      "icon": "https://cdn.acme.com/crm.svg",
      "uri": "https://crm.acme.com/?embed=webos"
    }
  ]
}
```

---

## launchMode（启动模式，每个 entry 自选）

```json
"launchMode": "window"      // 默认；iframe 进 webos 窗口（可用 SDK）
"launchMode": "tab"         // 浏览器新标签页（脱离 webos，无法用 SDK）
```

| 模式 | 行为 | 适用 |
|------|------|------|
| `window`（默认） | iframe 加载到 webos 窗口；可拖拽缩放；SDK 全部能用 | 普通业务应用 |
| `tab` | `window.open(uri, '_blank')`；脱离 webos 上下文 | 大屏 BI / SSO 跳转入口 / 拒绝 X-Frame 嵌入的页面 |

`tab` 模式的代价：不进 dock、不进 WindowManager、**不能用 SDK**；桌面 / 启动菜单 / 搜索结果会显示 ↗ 角标提示。

---

## 多入口

一个 manifest 注册多个 entry 时，每个 entry 在桌面上就是一个独立图标（uTools 风格）。共享 appId / 元信息，启动行为各自独立。

```json
{
  "appId": "com.acme.crm",
  "name": "客户管理套件",
  "icon": "https://cdn.acme.com/crm.svg",
  "entries": [
    {
      "id": "main",
      "name": "客户管理",
      "icon": "https://cdn.acme.com/crm.svg",
      "uri": "https://crm.acme.com/?embed=webos",
      "showIn": ["desktop", "start-menu"]
    },
    {
      "id": "bi-dashboard",
      "name": "销售看板",
      "icon": "https://cdn.acme.com/bi.svg",
      "uri": "https://bi.acme.com/dashboard",
      "launchMode": "tab",
      "showIn": ["desktop"],
      "description": "新标签页打开 BI 大屏"
    }
  ]
}
```

桌面会渲染**两个独立图标**。

---

## features（子功能 / 深链入口，归属 entry）

注册后会出现在 Cmd+K 全局搜索的"子功能"分组里，用户选中可**直接进应用内具体页面**。

```json
{
  "id": "main",
  "name": "客户管理",
  "icon": "...",
  "uri": "https://crm.acme.com/?embed=webos",
  "features": [
    {
      "id": "customers",
      "name": "客户列表",
      "uri": "/customers",
      "keywords": ["客户", "customer"]
    },
    {
      "id": "new-customer",
      "name": "新建客户",
      "uri": "/customers/new",
      "keywords": ["新建", "添加客户"],
      "category": "客户"
    },
    {
      "id": "reports",
      "name": "销售报表",
      "uri": "/reports/sales",
      "category": "报表"
    }
  ]
}
```

### 应用代码处理深链

```ts
import { Webos } from '@webos/host-sdk'

// 1. 启动时拿首次进入的 feature
const info = await Webos.app.bootInfo()
if (info.feature === 'reports') router.push('/reports/sales')

// 2. 已运行时被点搜索结果跳转
Webos.app.onNavigate(({ feature, uri }) => {
  router.push(uri ?? '/')
})
```

### 跳转行为

| 应用状态 | 行为 |
|----------|------|
| **未运行** | iframe 加载 `entry.uri + feature.uri`，应用按 URL 启动到对应页面 |
| **已运行** | **不开新窗口**；webos 推送 `app.navigate` 事件给已存在的 iframe，应用自己 SPA 路由 |

`tab` 模式的 entry 也支持 features —— 选中子功能时浏览器用 `window.open(entry.uri + feature.uri, '_blank')` 打开新标签到深链。

---

## icon 格式

支持两种（顶层 `icon` + 每个 `entries[i].icon`）：

```json
"icon": "https://cdn.acme.com/crm.svg"
"icon": "data:image/svg+xml;utf8,<svg ...>"
```

桌面图标 / dock / 启动菜单 / 搜索结果**用的是 `entries[i].icon`**。顶层 `icon` 给应用商店和关于面板用。

**推荐 SVG**（任意分辨率清晰）+ Data URI（无额外 HTTP 请求）。

---

## permissions（每个 entry 独立声明）

仅声明，不强制。给应用商店审核 / 用户首装授权时看的。

约定的权限名（详见 [docs/APP_MANIFEST_SPEC.md](../../docs/APP_MANIFEST_SPEC.md)）：

| 权限 | 含义 |
|------|------|
| `notify` / `dialog` / `window` | 通知 / 对话框 / 窗口控制 |
| `theme` / `storage` | 主题 / KV 存储 |
| `apps` / `message` / `events` | 应用列表 / 跨应用消息 / 事件广播 |
| `user.read` / `user.token` | 用户信息 / SSO token |
| `download` / `upload` | 下载 / 上传 |

V1.0 计划：handler 强制校验未声明权限的调用。

---

## showIn / order（每个 entry 独立）

```json
"showIn": ["desktop", "start-menu"]
```

| 值 | 含义 |
|----|------|
| `desktop` | 桌面图标 |
| `start-menu` | 全屏 launcher |
| `app-store` | 应用商店（V1.5） |

不传或空数组 = 不显示在任何位置（仍可被 `Webos.apps.open(appId, { entryId })` 调起）。

`order` 数值越小越靠前，同 `showIn` 区域内生效。

---

## 实战示例

### 标准业务应用（单入口 + features）

```json
{
  "appId": "com.acme.crm",
  "name": "客户管理",
  "nameI18n": { "zh": "客户管理", "en": "CRM" },
  "version": "2.4.1",
  "vendor": "ACME Inc.",
  "description": "客户关系管理",
  "icon": "https://cdn.acme.com/crm.svg",
  "category": "productivity",
  "entries": [
    {
      "id": "main",
      "name": "客户管理",
      "icon": "https://cdn.acme.com/crm.svg",
      "uri": "https://crm.acme.com/?embed=webos",
      "defaultWindow": { "width": 1200, "height": 800, "minWidth": 800 },
      "showIn": ["desktop", "start-menu"],
      "order": 10,
      "singleInstance": true,
      "permissions": ["notify", "dialog", "window", "storage", "user.read", "user.token"],
      "features": [
        { "id": "customers", "name": "客户列表", "uri": "/customers" },
        { "id": "new", "name": "新建客户", "uri": "/customers/new" },
        { "id": "reports", "name": "销售报表", "uri": "/reports", "category": "报表" }
      ]
    }
  ]
}
```

### 小工具

```json
{
  "appId": "ipcalc",
  "name": "IP 计算器",
  "icon": "data:image/svg+xml;utf8,...",
  "entries": [
    {
      "id": "main",
      "name": "IP 计算器",
      "icon": "data:image/svg+xml;utf8,...",
      "uri": "/static/tools/ipcalc/index.html",
      "defaultWindow": { "width": 480, "height": 360, "resizable": false },
      "showIn": ["start-menu"],
      "category": "dev"
    }
  ]
}
```

### 多入口（同一应用注册两个图标）

```json
{
  "appId": "grafana-suite",
  "name": "Grafana 监控套件",
  "icon": "https://grafana.com/icon.svg",
  "entries": [
    {
      "id": "main",
      "name": "Grafana 大盘",
      "icon": "https://grafana.com/icon.svg",
      "uri": "https://grafana.acme.com/dashboards/main",
      "launchMode": "tab",
      "showIn": ["desktop"]
    },
    {
      "id": "alerts",
      "name": "Grafana 告警",
      "icon": "https://grafana.com/alert-icon.svg",
      "uri": "https://grafana.acme.com/alerting/list",
      "launchMode": "tab",
      "showIn": ["desktop"]
    }
  ]
}
```

桌面会渲染两个独立图标（都是 ↗ 角标的 tab 模式）。

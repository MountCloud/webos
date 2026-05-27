# 应用清单规范（AppManifest Spec）

webos 通过 `AppManifest` 描述一个应用：给桌面壳看的"应用身份证 + 启动单元清单"。

---

## 1. 总览

manifest 分成两层：

- **应用元信息层（顶层）**：`appId`、`name`、`description`、`icon`、`category`、`tags` 等"是谁"的字段
- **入口层（`entries[i]`）**：`uri`、`launchMode`、`defaultWindow`、`showIn`、`features`、`permissions` 等"怎么启动"的字段

一个应用 = **一个或多个 entries**。每个 entry 在桌面 / 启动菜单 / 搜索结果里就是一个独立图标 / 项，可以有不同的 URL、不同的启动模式、不同的权限、不同的 features。

参考 uTools / Alfred 的"插件多入口"：一个 CRM 应用既可以注册"客户管理"入口（窗口模式），又可以注册"销售看板"入口（tab 模式打开 BI 仪表盘）。两者共享 appId / 元信息，启动行为各自独立。

启动相关字段不能出现在顶层（`entry` / `launchMode` / `defaultWindow` / `showIn` / `singleInstance` / `permissions` / `features`），只能在 `entries[i]` 里写。校验器看到顶层这些字段会直接报错。

---

## 2. 一个最小 manifest

单入口（最常见）：

```json
{
  "appId": "my-app",
  "name": "我的应用",
  "icon": "https://example.com/icon.svg",
  "entries": [
    {
      "id": "main",
      "name": "我的应用",
      "icon": "https://example.com/icon.svg",
      "uri": "https://my-app.example.com/"
    }
  ]
}
```

四个必填字段：顶层 `appId`、`name`，`entries[i]` 的 `id` / `name` / `icon` / `uri`。

---

## 3. 完整字段

```ts
interface AppManifest {
  // ===== 必填 =====
  appId: string
  name: string

  // 至少一个 entry
  entries: AppEntry[]

  // ===== 可选元信息 =====
  nameI18n?: Record<string, string>
  version?: string
  vendor?: string
  description?: string
  // 应用图标（应用商店 / 关于面板用；桌面图标走 entry.icon）
  icon?: string
  category?: string
  tags?: string[]

  // 扩展点（可选；与 entries 解耦）
  contributes?: AppContributes
}

interface AppEntry {
  // 应用内唯一
  id: string
  // 桌面 / dock / 搜索结果显示名
  name: string
  // 桌面图标
  icon: string
  // 必须是绝对 URL（http(s) / data: ...）或以 / 开头的根相对路径
  uri: string

  // 描述（搜索副标题 / hover tooltip）
  description?: string

  // 启动模式
  launchMode?: 'window' | 'tab'

  defaultWindow?: {
    width?: number | string
    height?: number | string
    resizable?: boolean
    minWidth?: number
    minHeight?: number
    maximizable?: boolean
  }

  showIn?: ('desktop' | 'start-menu' | 'app-store')[]
  order?: number
  singleInstance?: boolean
  permissions?: string[]

  // 子功能（深链入口）
  features?: AppFeature[]
}

interface AppFeature {
  id: string                   // entry 内唯一
  name: string
  description?: string
  icon?: string                // 不传则继承 entry.icon
  // 相对所属 entry.uri 的子路径 / 查询串 / hash；也可绝对 URL 覆盖
  uri: string
  keywords?: string[]
  category?: string            // 用于搜索结果分组
}

interface AppContributes {
  extensionPoints?: ExtensionPoint[]
}

interface ExtensionPoint {
  // ===== 固定字段（框架必填）=====
  host: string             // 被扩展的应用 appId
  slot: string             // 槽位名（host / extension 之间约定）
  entryId: string          // 触发时打开本应用哪个 entry（必须存在于 entries[]）
  // ===== 业务字段（框架不强制，list() 原样带回）=====
  uri?: string             // 给了才解析成完整 URL；不给则 list() 不带 uri
  label?: string           // host UI 上显示的文字
  icon?: string
  description?: string
  permissions?: string[]
  [key: string]: unknown   // 任意业务自定义属性，原样透传给 host
}
```

---

## 4. 字段详解

### 4.1 顶层（应用元信息）

#### appId（必填）

应用唯一标识。**只允许字母、数字、`_`、`.`、`-`**，正则 `/^[a-zA-Z0-9_.-]+$/`。

建议反向域名风格：`com.acme.notepad`。

#### name（必填）

应用本身的显示名（应用商店 / 关于 / 调试用）。
桌面图标 / 启动菜单 / 搜索结果**显示的是 `entries[i].name`**，不是顶层 `name`。

#### nameI18n / version / vendor / description / icon / category / tags

均可选，纯元信息。`icon` 是应用商店和关于面板用的图标，桌面渲染读 `entries[i].icon`。

### 4.2 entries（必填，至少 1 个）

数组，每一项是一个**独立的启动单元**。

#### entries[i].id（必填）

应用内唯一。建议简短稳定（`'main'` / `'dashboard'` / `'console'`）。
出现在 `Webos.apps.open(appId, { entryId })` / `Webos.app.bootInfo().entryId` / 桌面图标的 `dataset.entryId` 等多处，改了会破坏外部引用。

#### entries[i].name / icon（必填）

桌面图标 / dock / 启动菜单 / 搜索结果的渲染源。
一个应用注册多个 entry 时，每个 entry 给自己起独立的 name / icon —— 用户看到的就是 N 个独立"应用"。

#### entries[i].uri（必填）

入口 URL。**必须**是：

- 绝对 URL：`https://...` / `http://localhost:5173/`
- Data URI：`data:text/html;charset=utf-8,...`
- 根相对路径：`/static/my-app/index.html`（相对宿主壳同源）

不接受 `./` / `../` 风格的 manifest-相对路径。

#### entries[i].launchMode

| 模式 | 行为 |
|------|------|
| `window`（默认） | iframe 加载到 webos 窗口里，可 dock / 拖拽 / 缩放 / 与 SDK 通信 |
| `tab` | `window.open(uri, '_blank')`，**脱离 webos 上下文**，**不能用 SDK** |

桌面 / 启动菜单 / 搜索结果中，`launchMode: 'tab'` 的 entry 会带 ↗ 角标。

#### entries[i].defaultWindow

仅 `launchMode === 'window'` 时生效。

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `width` | number\|string | 720 | 像素或 `'80%'` |
| `height` | number\|string | 480 | 同上 |
| `resizable` | boolean | true | 是否可调大小 |
| `minWidth` / `minHeight` | number | 320 / 240 | 最小尺寸 |
| `maximizable` | boolean | true | 标题栏是否显示最大化按钮 |

#### entries[i].showIn

控制该 entry 显示在哪。

```json
"showIn": ["desktop", "start-menu"]
```

| 值 | 含义 |
|----|------|
| `desktop` | 桌面图标 |
| `start-menu` | 开始菜单 |
| `app-store` | 应用商店 |

不传或空数组 = 不显示在任何位置（仍可被 `Webos.apps.open(appId, { entryId })` 调起）。

#### entries[i].order

排序权重，**数值越小越靠前**。同 `showIn` 区域内生效。

#### entries[i].singleInstance

`true`：该 entry 只允许一个窗口（**per-entry**，不影响其他 entry）。再次启动会聚焦已有窗口。

#### entries[i].permissions

声明该 entry 可能用到的权限。**仅声明，不强制校验**——给应用商店审核 / 用户授权时看的。

约定的权限名：`notify` · `dialog` · `window` · `theme` · `storage` · `apps` · `message` · `events` · `user.read` · `user.token` · `download` · `upload`。

#### entries[i].features

子功能 / 深链入口，归属该 entry。注册后会出现在**全局搜索（Cmd/Ctrl + K）的"子功能"分组**里。

```json
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
    "keywords": ["新建", "添加", "create"],
    "category": "客户"
  }
]
```

##### feature.uri 解析规则

`feature.uri` 相对所属 `entry.uri` 解析：

| feature.uri 形式 | 结果 |
|------------------|------|
| `?view=foo` / `#hash` | 拼到 `entry.uri` 末尾 |
| `/path` | 替换 `entry.uri` 的 path |
| `relative/path` | 拼到 `entry.uri` 末尾（保留 path） |
| `https://...` | 直接覆盖（绝对 URL）|

##### 跳转行为

- **应用未运行**：iframe 加载 `entry.uri + feature.uri`
- **应用已运行**：**不开新窗口**，桌面壳向已存在 iframe 推送 `app.navigate` 事件：

```ts
Webos.app.onNavigate(({ feature, uri, params }) => {
  router.push(uri ?? '/')
})

const info = await Webos.app.bootInfo()
if (info.feature === 'customers') router.push('/customers')
```

### 4.3 contributes（扩展点，可选）

用于跨应用 UI 嵌入。一个应用可以声明"我能在 host 应用的 slot 上提供一个入口"，host 通过 `Webos.contributes.list({ host, slot })` 拿到所有提供方。

最小用法：

```json
{
  "appId": "example-extension-plugin",
  "name": "示例扩展",
  "entries": [{ "id": "main", "name": "示例扩展", "icon": "...", "uri": "https://..." }],
  "contributes": {
    "extensionPoints": [
      {
        "host": "example-extensible-host",
        "slot": "settings.tabs",
        "entryId": "main",
        "label": "插件设置",
        "uri": "?view=settings"
      }
    ]
  }
}
```

**字段规则**：

- `host` / `slot` / `entryId` 是**固定字段**（框架必填）：host 用来过滤、entryId 用来启动，`entryId` 必须存在于本应用 `entries[]`。
- **其余属性随便放**——`label` / `icon` / `description` 以及任何业务自定义字段（如 `order` / `badge` / `meta`），`Webos.contributes.list()` 会**原样带回**。`label` 不再必填。
- `uri` 给了才解析：host 拼成完整 URL（`entry.uri + ep.uri`）放进返回；**不给就不带 `uri`**（用 `entryId` 启动即可）。
- 输出里 `appId` / `appName` / `uri` 三个名字由框架占用（同名业务属性会被覆盖）；`host` / `slot` / `entryId` 原样保留。

带自定义属性的例子（不写 `uri`，多带 `order` / `badge` / `meta`）：

```json
{
  "host": "example-extensible-host",
  "slot": "settings.tabs",
  "entryId": "main",
  "label": "插件设置面板",
  "order": 20,
  "badge": "beta",
  "meta": { "group": "安全" }
}
```

host 侧 `list()` 拿到的这条会带上 `order` / `badge` / `meta` 原值。

#### Host 怎么打开扩展项

扩展点若声明了 `uri`，`list()` 返回里的 `uri` 就是 host 替你拼好的完整 URL（`entry.uri + ep.uri`）；没声明则不带 `uri`。

**推荐 host 的做法**：用 `Webos.apps.open(ext.appId, { entryId: ext.entryId, params })` 把扩展项当独立 webos 窗口启动；对于带查询串的 `ep.uri`（如 `?view=settings`），从 `ext.uri` 里解析查询参数转成 `params` 对象传过去：

```ts
const exts = await Webos.contributes.list({ host: 'my-host', slot: 'settings.tabs' })
for (const ext of exts) {
  const params = {}
  if (ext.uri) {                       // uri 可能没声明
    const u = new URL(ext.uri, location.origin)
    u.searchParams.forEach((v, k) => { params[k] = v })
  }
  await Webos.apps.open(ext.appId, { entryId: ext.entryId, params })
}
```

提供方应用（plugin）启动后用 `Webos.app.bootInfo()` 或 `URL(location.href).searchParams` 读出 `view` / `params`，切到对应视图。

> 完整 demo：见 `examples/07-extensible-host` + `examples/08-extension-plugin` 两个示例应用。

---

## 5. 校验规则

`validateManifest()` 在注册时执行，命中以下任一项直接抛 `AppManifestError`：

| 规则 | 行为 |
|------|------|
| 缺顶层必填（`appId` / `name` / `entries`） | 抛 |
| 顶层出现启动相关字段（`entry` / `launchMode` / `defaultWindow` / `showIn` / `singleInstance` / `permissions` / `features`） | 抛，提示这些字段属于 `entries[i]` |
| `entries` 不是非空数组 | 抛 |
| `entries[i].id` 在同一应用内重复 | 抛 |
| `entries[i].uri` 非绝对 URL 且非 `/` 开头 | 抛 |
| `entries[i].features[j].id` 在同一 entry 内重复 | 抛 |
| `contributes.extensionPoints[i].entryId` 不存在于 `entries[]` | 抛 |
| `appId` 不匹配 `/^[a-zA-Z0-9_.-]+$/` | 抛 |

---

## 6. 注册到 webos

通过 `AppRegistry` + `AppSource`：

```ts
import { AppRegistry, StaticAppSource } from '@webos/shell'
import myAppManifest from './apps/my-app/manifest.json'

AppRegistry.instance.addSource(new StaticAppSource([myAppManifest]))
await AppRegistry.instance.refresh()
```

或远程拉取：

```ts
import { AppRegistry, JsonAppSource } from '@webos/shell'

AppRegistry.instance.addSource(new JsonAppSource('/api/app-store/manifests.json'))
await AppRegistry.instance.refresh()
```

后注册的源**不会覆盖**已有 `appId`——按"先到先得"。

---

## 7. 实战示例

### 7.1 单入口业务应用

```json
{
  "appId": "com.acme.crm",
  "name": "客户管理",
  "version": "2.4.1",
  "vendor": "ACME Inc.",
  "description": "客户关系管理系统",
  "icon": "https://cdn.acme.com/icons/crm.svg",
  "category": "productivity",
  "tags": ["crm", "sales"],
  "entries": [
    {
      "id": "main",
      "name": "客户管理",
      "icon": "https://cdn.acme.com/icons/crm.svg",
      "uri": "https://crm.acme.com/?embed=webos",
      "defaultWindow": {
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      },
      "showIn": ["desktop", "start-menu"],
      "order": 10,
      "singleInstance": true,
      "permissions": ["notify", "dialog", "window", "storage", "user.read", "user.token"],
      "features": [
        { "id": "customers", "name": "客户列表", "uri": "/customers" },
        { "id": "reports", "name": "销售报表", "uri": "/reports", "keywords": ["报表"] }
      ]
    }
  ]
}
```

### 7.2 多入口（CRM 主应用 + BI 仪表盘 tab 入口）

```json
{
  "appId": "com.acme.crm",
  "name": "客户管理套件",
  "icon": "https://cdn.acme.com/icons/crm.svg",
  "entries": [
    {
      "id": "main",
      "name": "客户管理",
      "icon": "https://cdn.acme.com/icons/crm.svg",
      "uri": "https://crm.acme.com/?embed=webos",
      "showIn": ["desktop", "start-menu"],
      "order": 10
    },
    {
      "id": "bi-dashboard",
      "name": "销售看板",
      "icon": "https://cdn.acme.com/icons/bi.svg",
      "uri": "https://bi.acme.com/dashboard",
      "launchMode": "tab",
      "showIn": ["desktop"],
      "order": 20,
      "description": "新标签页打开大屏 BI 仪表盘"
    }
  ]
}
```

桌面会渲染**两个图标**：「客户管理」（窗口模式）+「销售看板」（tab 模式，带 ↗ 角标）。

### 7.3 简单工具

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

---

## 8. 后续演进

后面计划新增的字段：

- 顶层 `mimeTypes` —— 应用支持打开的文件类型
- 顶层 `protocols` —— 自定义协议处理器（`webos://my-app/...`）
- `entries[i].shortcuts` —— 启动菜单二级快捷入口
- `signature` —— 商店应用签名校验
- `contributes` 扩展点支持更多 slot 类型（菜单 / 状态栏 / 命令）

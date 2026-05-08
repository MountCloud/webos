# 05 · 扩展 `@webos/host-sdk`

给 SDK 加新方法的"三件套对齐"流程。

---

## 三件套（每个新 SDK 方法都涉及）

```
┌────────────────────────────────────────────────────────────┐
│  ① SDK 方法（packages/host-sdk/src/modules/xxx.ts）         │
│     Webos.xxx.foo(args) → rpc.call('xxx', 'foo', args)      │
└──────────────────┬─────────────────────────────────────────┘
                   ↓ postMessage
┌──────────────────────────────────────────────────────────────┐
│  ② host handler（apps/webos-shell/src/apps/builtinHandlers.ts）│
│     bus.registerHandler('xxx', 'foo', async (req, source) => │
│       ...                                                    │
│     })                                                       │
└──────────────────┬───────────────────────────────────────────┘
                   ↓ 调用
┌────────────────────────────────────────────────────────────┐
│  ③ shell 内部实现（singleton / 模块函数 / etc.）             │
│     XxxService.instance.foo() / 直接函数调用                 │
└────────────────────────────────────────────────────────────┘
```

**三件套必须同时改**，否则 SDK 方法会 `NOT_FOUND`。

---

## 完整示例：加 `Webos.system.openExternalLink(url)`

需求：给 iframe 应用一个能力，用 `window.open` 打开外部 URL（不进 webos）。

### 第 1 步：写 shell 内部实现

如果只是简单调用，可以直接在 handler 里实现，不必新建 module。复杂点的话拎出去：

```ts
// apps/webos-shell/src/helpers/external.ts
export function openExternalLink(url: string): void {
  if (!/^https?:/.test(url)) {
    throw Object.assign(new Error('仅允许 http(s) URL'), { code: 'INVALID_ARGS' })
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

### 第 2 步：注册 host handler

```ts
// apps/webos-shell/src/apps/builtinHandlers.ts
import { openExternalLink } from '../helpers/external'

bus.registerHandler('system', 'openExternalLink', async (req) => {
  const { url } = req.args as { url: string }
  openExternalLink(url)
  return null
})
```

### 第 3 步：加 SDK 方法

```ts
// packages/host-sdk/src/modules/system.ts
export function createSystem(rpc: RpcClient) {
  return {
    async info(): Promise<SystemInfo> { ... },
    async openSettings(panel?: string): Promise<void> { ... },

    async openExternalLink(url: string): Promise<void> {
      await rpc.call('system', 'openExternalLink', { url })
    },
  }
}
```

### 第 4 步：导出类型（如果有新类型）

```ts
// packages/host-sdk/src/index.ts
export type { ExternalLinkOptions } from './modules/system'  // 如果有
```

### 第 5 步：rebuild SDK

```bash
pnpm --filter @webos/host-sdk build
```

**必做**！shell + 示例都依赖 dist 目录，不 build 不会用上新方法。

### 第 6 步：tsc + vite build 验证

```bash
"E:/project/html/osweb/apps/webos-shell/node_modules/.bin/tsc" --noEmit -p apps/webos-shell/tsconfig.json
"E:/project/html/osweb/apps/webos-shell/node_modules/.bin/vite" build apps/webos-shell
```

### 第 7 步：更新 docs/HOST_SDK_API.md

加新方法的章节，含签名、参数、用法、可能错误码。

---

## 涉及持久化的方法（如 user / settings / shared 类）

如果新方法要存数据并跨应用共享，**遵循 UserSession 的"四方共用底层"模式**：

```
登录页 / iframe 应用 / shell singleton / RPC handler
        ↓ ↓ ↓ ↓
   全部走 packages/host-sdk/src/session.ts 一份纯函数
        ↓
   localStorage（同一 key 同一 JSON 格式）
```

**步骤**：

1. 在 `packages/host-sdk/src/session.ts`（或类似位置）写纯函数：
   ```ts
   const KEY = 'webos:my.state'
   export function readMyState(): MyState { ... }
   export function writeMyState(s: MyState): void { ... }
   export function clearMyState(): void { ... }
   ```

2. 在 SDK index.ts 导出（让登录页 / 同 origin 工具页能 import）

3. shell 端的 singleton（`MyService`）启动时调 `readMyState()` 恢复，每次写状态时调 `writeMyState()`

4. SDK 模块（`Webos.my.*`）走 RPC，handler 调 `MyService.instance.*`

5. **用 broadcast 通知 iframe 应用**（如果状态变化要推到应用端）：
   ```ts
   MyService.instance.on('change', (payload) => {
     AppMessageBus.instance.broadcast('my.changed', payload)
   })
   ```
   应用端订阅 `Webos.events.on('my.changed', ...)` 或 `Webos.my.on('change', ...)`（若 SDK module 有 `on` 方法）。

完整示例看 `UserSession.ts` + `session.ts` + `builtinHandlers.ts` 里 user 那段。

---

## SDK 模块设计原则

### 1. 一切返回 Promise（除非真的同步触发）

```ts
async show(...): Promise<void>
```

`download` 是少数例外（同步触发浏览器下载，没东西可 await）。

### 2. 重载支持简化签名 + 选项形式

```ts
function alert(message: string, title?: string): Promise<void>
function alert(options: AlertOptions): Promise<void>
function alert(arg1: string | AlertOptions, arg2?: string): Promise<void> {
  const options = typeof arg1 === 'string' ? { message: arg1, title: arg2 } : arg1
  return rpc.call('dialog', 'alert', options)
}
```

简化签名让"快速调用"不用建对象，选项形式让"完整能力"也能用。

### 3. 类型放 `core/types.ts` 共用

`User / TokenInfo / Theme / NotificationLevel / RpcRequest` 这种跨模块用的，统一放 `core/types.ts`。

### 4. 别忘了 `on` 订阅

如果某能力会变化，提供 `on(event, handler)`：

```ts
on(event: 'change', handler: (payload: ChangePayload) => void): () => void {
  void event
  return rpc.on('xxx.changed', (payload) => handler(payload as ChangePayload))
}
```

返回 unsubscribe 函数。

---

## 错误码约定

handler 抛错 → 自动包装为 `{ ok: false, error: { code, message } }`。

固定 code（应用方可能据此判断）：

| code | 含义 | 何时用 |
|------|------|--------|
| `NOT_FOUND` | 资源不存在 | 找不到应用 / 找不到 user / etc. |
| `INVALID_ARGS` | 参数不合法 | 参数校验失败 |
| `PERMISSION_DENIED` | 权限不足 | 应用未声明该权限 / 用户拒绝 |
| `NOT_IMPLEMENTED` | 该方法暂未实现 | placeholder（如 V1.5 才做的 dialog.openFile） |
| `TIMEOUT` | RPC 超时 | SDK 端默认 30s，handler 超时 |
| `HANDLER_ERROR` | handler 内部异常 | catch 默认 fallback |

抛错带 code：

```ts
throw Object.assign(new Error('找不到应用'), { code: 'NOT_FOUND' })
```

handler 没显式 throw，AppMessageBus 自动用 `HANDLER_ERROR`。

---

## 安全 / 信任

- **iframe 自报的 `req.appId` 不可信**：AppMessageBus 已经把它替换成 source-window 反查的 trusted appId
- **handler 拿到的 `source.appId` 是 trusted 的**，可据此做白名单校验：
  ```ts
  bus.registerHandler('user', 'set', async (req, source) => {
    const TRUSTED_LOGIN_APPS = ['login', 'sso-callback']
    if (!TRUSTED_LOGIN_APPS.includes(source.appId)) {
      throw Object.assign(new Error('仅授权应用可设置 user'), { code: 'PERMISSION_DENIED' })
    }
    // ... do it
  })
  ```
- 默认没做（任何应用都能调 user.set）。manifest `entries[i].permissions` 当前仅声明不强制，V1.0 计划加 handler 拦截

---

## 不要做的事

- ❌ 跳过 host handler 直接让 SDK 调浏览器 API（postMessage 是唯一通道；SDK 不持有任何状态）
- ❌ handler 里阻塞线程（`while(true)`）—— 整个 shell 会卡死
- ❌ handler 返回不能 JSON 序列化的东西（Function / DOM Node / circular ref）—— postMessage 会抛 `DataCloneError`
- ❌ 在 SDK 里硬编码 webos shell 的 URL / 端口 —— SDK 是给应用方用的，应用部署在哪它没法预知

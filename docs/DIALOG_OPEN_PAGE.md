# `Webos.dialog.openPage` — 自定义弹窗

## 是什么

苹果 macOS / Windows 都有"模态弹窗"概念：弹一个能装任意内容的浮窗，宿主应用被冻结，
等用户处理完才能继续。webos 1.1 加的 `Webos.dialog.openPage()` 就是这一套：

- **弹窗 body 是任意 URL**（嵌 iframe，跟普通应用一样）
- **footer 由宿主渲染按钮**，按钮点击事件透传给内嵌页
- **内嵌页可阻止关闭**（校验失败时）+ **携带数据回传给调用方**
- **三档模态**：不阻塞 / 阻塞父窗口 / 阻塞整桌面

跟简单 `alert / confirm / show` 的区别：那些只能放文字 + 一组按钮，
openPage 可以把"编辑表单"、"详情面板"这类复杂页面直接当 dialog 内容。

## 一图看懂

```
┌─ 应用 A（调用方） ──────────────┐
│  await Webos.dialog.openPage({  │              用户点保存
│    url: '/edit?id=42',          │                 │
│    buttons: [save, cancel],     │                 ▼
│    modal: 'parent',             │      ┌─ 应用 B（内嵌页） ─┐
│  })                             │ ◀──▶│  onAction('save') │
│  // 等用户操作                  │      │  校验表单         │
│                                 │      │  return data      │
│  // 拿到 { buttonId, data }     │      └───────────────────┘
└─────────────────────────────────┘
```

调用方应用 A 的窗口被模态遮罩**冻住**，直到 dialog 关闭。

## 调用方 API（应用 A）

```ts
const r = await Webos.dialog.openPage<{ name: string; level: string }>({
  // 二选一：URL（相对路径以调用方应用 URL 为 base 解析）
  url: './forms/edit?id=42',
  // 或：webos 应用 entry（更类型安全，复用 manifest 权限检查）
  // app: { appId: 'workorder', entryId: 'edit', params: { id: 42 } },

  // 视觉
  title: '编辑工单 #42',
  width: 720,
  height: 480,

  // 按钮（footer 由宿主渲染。不传则没 footer，全靠内嵌页主动 close）
  buttons: [
    { id: 'save',   label: '保存', type: 'primary', autoFocus: true },
    { id: 'cancel', label: '取消', cancel: true },   // cancel 标记：点了直接关
  ],

  // 模态级别（默认 'parent'）
  modal: 'parent',  // 'none' | 'parent' | 'global'
})

// r: { buttonId: 'save' | 'cancel' | null, data?: T }
if (r.buttonId === 'save' && r.data) {
  applyEdit(r.data.name, r.data.level)
}
```

**模态级别说明**：

| 值 | 行为 |
|---|---|
| `'none'` | 普通独立窗口，不阻塞 |
| `'parent'`（默认）| 调用方应用窗口加 mask 不可点；典型业务用法 |
| `'global'` | 整个桌面除 dialog 自己外都不可点；慎用，仅系统级 |

## 内嵌页 API（应用 B / 弹窗里的页面）

内嵌页通过 `webosDialogId` 查询串自动识别"自己在 dialog 中"。
SDK 提供 3 个方法：

### 1. `onAction(handler)` —— 接管按钮点击

```ts
Webos.dialog.onAction(async (buttonId) => {
  if (buttonId === 'save') {
    if (!form.isValid()) {
      // 阻止关闭，footer 显示红字
      return { close: false, error: '请填完必填项' }
    }
    // 异步操作 OK
    const data = await api.save(form.getValues())
    // 关闭，data 传回调用方
    return { close: true, data }
  }
  // 其他按钮放过（return undefined）
})
```

handler 返回值：

| 返回 | 行为 |
|---|---|
| `undefined` / `null` | 默认关闭，data 为空 |
| `{ close: true, data?: T }` | 关闭，data 传给调用方 |
| `{ close: false, error?: string }` | 阻止关闭；error 在 footer 红字显示 |
| `throw new Error('xxx')` | 等同 `{ close: false, error: 'xxx' }` |

### 2. `close(result?)` —— 主动关闭

```ts
// 不等用户点按钮，立即关闭并传 data
Webos.dialog.close({ buttonId: 'save', data: { ok: true } })

// 调用方拿到 { buttonId: 'save', data: { ok: true } }
```

### 3. `context()` —— 查询自己的 dialog 上下文

```ts
const ctx = await Webos.dialog.context()
// { inDialog: true, dialogId: 'dlg-3-...', buttons: [...], modal: 'parent' }
// 不在 dialog 中时 inDialog: false
```

## 完整示例

见 `examples/06-react-mui/src/App.tsx`：

- 表格里每行一个"编辑"按钮 → `handleOpenEditDialog` → `openPage({ url: './?view=edit&id=N' })`
- 同一个 app 的 `view=edit` 路径渲染 `EditDialogPage`（纯表单，无 AppBar）
- `EditDialogPage` 用 `onAction` 校验 + 保存
- 保存成功调用方更新表格行；失败 footer 显示"名称不能为空"等

## 行为细节 / 边角

- **取消按钮**（`cancel: true`）点了**不触发** `onAction`，宿主直接 settle 关闭。
  如果业务方需要"取消时确认未保存修改"，自己用普通按钮 + onAction 实现。
- **超时**：`onAction` 不响应时 10 秒后默认 `{ close: true }` 兜底，避免卡住。
- **窗口右上角 ×**：找一个 `cancel: true` 的按钮 settle；没有则 footer 显示
  "请选择一个操作" 提示（防止用户被卡住）。
- **嵌套**：在 dialog 里再开 dialog 也支持，父 dialog 也会被模态阻塞。
- **跟登录锁屏的关系**：LoginDialog 是系统级（z-index `--webos-z-modal: 1000000`），
  比 `global` 模态还高一级，登录期间没人能 openPage。

## 故障排查

| 现象 | 检查 |
|---|---|
| 按钮点了没反应 | 内嵌页是否调了 `Webos.dialog.onAction(...)` 注册处理器？没有 → 10s 后兜底关 |
| 父窗口没被冻住 | `modal` 是不是设了 `'none'`？默认 `'parent'` 才阻塞 |
| 相对 URL 解析错位置 | DialogWindow 用 `source.appUrl` 作 base 解析，应该指向调用方 app 不是 shell |
| 关闭按钮 × 卡住 | footer 没有标 `cancel: true` 的按钮；加一个 cancel 按钮或省略 buttons |

@author MountCloud &lt;mountcloud@outlook.com&gt;

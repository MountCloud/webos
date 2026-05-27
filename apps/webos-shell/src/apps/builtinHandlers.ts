/**
 * 内置 SDK 处理器
 * 把桌面壳能力（对话框 / 通知 / 窗口控制）暴露给 iframe 应用
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { AppMessageBus } from './AppMessageBus'
import { AppLoader } from './AppLoader'
import { AppRegistry } from './AppRegistry'
import { resolveEntryUri } from './AppManifest'
import {
  AppWindow,
  DialogWindow,
  WindowManager,
  type DialogButtonDef,
  type DialogModal,
  type DialogResult,
} from '../core/window'
import {
  alert,
  confirm,
  prompt,
  openPrompt,
  showDialog,
  notify,
  showContextMenu,
  type AlertOptions,
  type PromptOptions,
} from '../core/dialog'
import { download } from '../helpers/download'
import { ThemeRegistry } from '../theme'
import { i18n } from '../i18n'
import { NotificationCenter, GlobalSearch } from '../shell'
import { UserSession } from '../user'

export function registerBuiltinHandlers(): void {
  const bus = AppMessageBus.instance

  // ===== Webos.notify =====
  bus.registerHandler('notify', 'show', async (req) => {
    const args = req.args as Parameters<typeof notify>[0]
    notify(args)
    return { ok: true }
  })

  // ===== Webos.dialog =====
  bus.registerHandler('dialog', 'alert', async (req) => {
    // 兼容老 schema：{ message, title }；新 schema：完整 AlertOptions
    const args = req.args as Partial<AlertOptions> & { message: string }
    await alert(args)
    return null
  })

  bus.registerHandler('dialog', 'confirm', async (req) => {
    const args = req.args as Partial<AlertOptions> & { message: string }
    return await confirm({ ...args, showCancel: true })
  })

  bus.registerHandler('dialog', 'prompt', async (req) => {
    // 老接口直接返回 string | null
    const args = req.args as Partial<PromptOptions> & { message: string }
    if (args.buttons || args.placeholder !== undefined || args.confirmText || args.cancelText) {
      const r = await openPrompt(args as PromptOptions)
      return r.value
    }
    // 兼容老路径
    return await prompt(args.message, args.defaultValue, args.title)
  })

  // 自定义按钮版
  bus.registerHandler('dialog', 'show', async (req) => {
    return await showDialog(req.args as AlertOptions)
  })

  // 完整 prompt：返回 { button, value }
  bus.registerHandler('dialog', 'promptEx', async (req) => {
    return await openPrompt(req.args as PromptOptions)
  })

  // ===== 自定义弹窗（嵌入页面 / appId+entryId） =====
  // 见 DialogWindow.ts 完整说明
  bus.registerHandler('dialog', 'openPage', async (req, source) => {
    return await openPageDialog(req.args as OpenPageArgs, source)
  })

  // 内嵌页主动 close()
  bus.registerHandler('dialog', 'closeFromInside', async (req) => {
    const args = req.args as { dialogId: string; buttonId: string | null; data?: unknown }
    const dialog = findDialogById(args.dialogId)
    if (dialog) dialog.closeFromInside(args.buttonId, args.data)
    return null
  })

  // 内嵌页 onAction 回报结果
  bus.registerHandler('dialog', 'actionResult', async (req) => {
    const args = req.args as {
      dialogId: string
      actionId: string
      close: boolean
      data?: unknown
      error?: string
    }
    const dialog = findDialogById(args.dialogId)
    if (dialog) {
      dialog.completeAction(args.actionId, {
        close: args.close,
        data: args.data,
        error: args.error,
      })
    }
    return null
  })

  // 内嵌页查询自己的 dialog 上下文
  bus.registerHandler('dialog', 'context', async (req) => {
    const args = req.args as { dialogId: string }
    const dialog = findDialogById(args.dialogId)
    if (!dialog) {
      return { inDialog: false, dialogId: null, buttons: [], modal: 'none' }
    }
    return dialog.context
  })

  // ===== Webos.window =====
  bus.registerHandler('window', 'minimize', async (_req, source) => {
    source.minimize()
    return null
  })

  bus.registerHandler('window', 'maximize', async (_req, source) => {
    source.maximize()
    return null
  })

  bus.registerHandler('window', 'restore', async (_req, source) => {
    source.restore()
    return null
  })

  bus.registerHandler('window', 'close', async (_req, source) => {
    await source.close()
    return null
  })

  bus.registerHandler('window', 'setTitle', async (req, source) => {
    const { title } = req.args as { title: string }
    source.setTitle(title)
    return null
  })

  bus.registerHandler('window', 'setBusy', async (req, source) => {
    const { busy } = req.args as { busy: boolean }
    source.setBusy(busy)
    return null
  })

  bus.registerHandler('window', 'setSize', async (req, source) => {
    const { width, height } = req.args as { width: number; height: number }
    source.setSize(width, height)
    return null
  })

  bus.registerHandler('window', 'setBounds', async (req, source) => {
    const args = req.args as Partial<{ x: number; y: number; width: number; height: number }>
    source.setBounds(args)
    return null
  })

  bus.registerHandler('window', 'getBounds', async (_req, source) => {
    return source.bounds
  })

  bus.registerHandler('window', 'center', async (_req, source) => {
    source.center()
    return null
  })

  // ===== Webos.contextMenu =====
  bus.registerHandler('contextMenu', 'show', async (req) => {
    const args = req.args as { items: any; x: number; y: number }
    showContextMenu(args)
    return null
  })

  // ===== Webos.download =====
  bus.registerHandler('download', 'trigger', async (req) => {
    const args = req.args as { url?: string; filename: string }
    download(args)
    return null
  })

  // ===== Webos.apps =====
  bus.registerHandler('apps', 'list', async () => {
    // 应用维度：返回扁平的 AppMeta（每个应用一条）
    return AppRegistry.instance.list().map((m) => ({
      appId: m.appId,
      name: m.name,
      icon: m.icon,
      version: m.version,
    }))
  })

  bus.registerHandler('apps', 'listEntries', async (req) => {
    const args = (req.args ?? {}) as {
      showIn?: 'desktop' | 'start-menu' | 'app-store'
    }
    return AppRegistry.instance.listEntries(args)
  })

  bus.registerHandler('apps', 'open', async (req) => {
    const { appId, entryId, feature, params } = req.args as {
      appId: string
      entryId: string
      feature?: string
      params?: Record<string, unknown>
    }
    if (!entryId) {
      throw Object.assign(new Error('apps.open 必须传 entryId'), { code: 'INVALID_ARGS' })
    }
    AppLoader.instance.launch(appId, { entryId, feature, params })
    return null
  })

  bus.registerHandler('apps', 'has', async (req) => {
    const { appId, entryId } = req.args as { appId: string; entryId?: string }
    if (entryId) return AppRegistry.instance.hasEntry(appId, entryId)
    return AppRegistry.instance.has(appId)
  })

  // 应用查自己的 appId（storage 用）
  bus.registerHandler('apps', 'self', async (_req, source) => {
    return { appId: source.appId, entryId: source.entryId }
  })

  // ===== Webos.app.bootInfo =====
  bus.registerHandler('app', 'bootInfo', async (_req, source) => {
    const info = AppLoader.instance.getBootInfo(source)
    return info ?? { appId: source.appId, entryId: source.entryId }
  })

  // ===== Webos.contributes =====
  bus.registerHandler('contributes', 'list', async (req) => {
    const { host, slot } = (req.args ?? {}) as { host?: string; slot?: string }
    const out: Array<{
      appId: string
      appName: string
      entryId: string
      host: string
      slot: string
      uri?: string
      [key: string]: unknown
    }> = []
    for (const m of AppRegistry.instance.list()) {
      const eps = m.contributes?.extensionPoints ?? []
      for (const ep of eps) {
        if (host && ep.host !== host) continue
        if (slot && ep.slot !== slot) continue
        const entry = m.entries.find((e) => e.id === ep.entryId)
        if (!entry) continue
        // uri 声明了才解析成完整 URL（entry.uri + ep.uri 子路径）；没声明 / 非字符串则不带
        const uri =
          typeof ep.uri === 'string' && ep.uri ? resolveEntryUri(entry, ep.uri) : undefined
        // 透传 ep 全部属性（含业务自定义），再用框架字段覆盖保留名
        out.push({ ...ep, appId: m.appId, appName: m.name, uri })
      }
    }
    return out
  })

  // ===== Webos.user =====（读 / 写均走 UserSession singleton；
  // 使用方在 webos 启动时调 UserSession.instance.set({...}) 注入 SSO 拿到的用户）
  bus.registerHandler('user', 'current', async () => {
    return UserSession.instance.user
  })

  bus.registerHandler('user', 'permissions', async () => {
    return UserSession.instance.permissions
  })

  bus.registerHandler('user', 'token', async () => {
    return UserSession.instance.token
  })

  bus.registerHandler('user', 'set', async (req) => {
    const args = req.args as Parameters<typeof UserSession.instance.set>[0]
    UserSession.instance.set(args)
    return null
  })

  bus.registerHandler('user', 'clear', async () => {
    UserSession.instance.clear()
    return null
  })

  bus.registerHandler('user', 'setUser', async (req) => {
    const { user } = req.args as { user: Parameters<typeof UserSession.instance.setUser>[0] }
    UserSession.instance.setUser(user)
    return null
  })

  bus.registerHandler('user', 'setToken', async (req) => {
    const { token } = req.args as { token: Parameters<typeof UserSession.instance.setToken>[0] }
    UserSession.instance.setToken(token)
    return null
  })

  // user 变化广播：payload 同时含 user 与 token，应用可任选订阅
  UserSession.instance.on('change', ({ user, token }) => {
    AppMessageBus.instance.broadcast('user.changed', { user, token })
  })

  // ===== Webos.permission =====
  bus.registerHandler('permission', 'request', async (req) => {
    const { permissions, reason } = req.args as { permissions: string[]; reason?: string }
    const message = `应用申请以下权限：\n${permissions.join('\n')}${reason ? '\n\n说明：' + reason : ''}`
    return await confirm(message, '权限申请')
  })

  // ===== Webos.theme =====
  bus.registerHandler('theme', 'current', async () => {
    return ThemeRegistry.instance.effective
  })

  bus.registerHandler('theme', 'set', async (req) => {
    const { name } = req.args as { name: 'light' | 'dark' | 'auto' }
    ThemeRegistry.instance.mode = name
    return null
  })

  bus.registerHandler('theme', 'getTokens', async () => {
    // 读 :root 的 CSS 变量
    const styles = getComputedStyle(document.documentElement)
    const tokens: Record<string, string> = {}
    for (let i = 0; i < styles.length; i++) {
      const name = styles[i]
      if (name && name.startsWith('--webos-')) {
        tokens[name] = styles.getPropertyValue(name).trim()
      }
    }
    return tokens
  })

  // ===== Webos.system =====
  bus.registerHandler('system', 'info', async () => {
    return {
      version: '0.1.0',
      platform: navigator.platform,
      locale: i18n.locale,
      theme: ThemeRegistry.instance.effective,
      userAgent: navigator.userAgent,
    }
  })

  bus.registerHandler('system', 'openSettings', async () => {
    notify({ title: '设置面板', message: '设置面板将在 V1.5 实现', level: 'info' })
    return null
  })

  bus.registerHandler('system', 'search', async (req) => {
    const { query } = req.args as { query: string }
    GlobalSearch.instance.open()
    void query // V1.5：自动填入搜索词
    return null
  })

  // ===== Webos.message（跨应用消息）=====
  // 消息发到目标应用的所有 entry 的所有窗口
  bus.registerHandler('message', 'send', async (req) => {
    const { targetAppId, message } = req.args as { targetAppId: string; message: unknown }
    const targets = AppLoader.instance.getRunningByApp(targetAppId)
    for (const win of targets) {
      AppMessageBus.instance.pushEvent(win, 'message', {
        message,
        from: req.appId,
      })
    }
    return null
  })

  // ===== Webos.events（全局事件广播）=====
  bus.registerHandler('events', 'emit', async (req) => {
    const { event, payload } = req.args as { event: string; payload?: unknown }
    AppMessageBus.instance.broadcast(event, payload)
    return null
  })

  // ===== Webos.dialog 占位（未实现的对话框，先返回 NOT_IMPLEMENTED）=====
  const notImplemented = (name: string) => async () => {
    throw Object.assign(new Error(`${name} 将在 Phase 5/6 实现`), {
      code: 'NOT_IMPLEMENTED',
    })
  }
  bus.registerHandler('dialog', 'openFile', notImplemented('dialog.openFile'))
  bus.registerHandler('dialog', 'saveFile', notImplemented('dialog.saveFile'))
  bus.registerHandler('dialog', 'pickDirectory', notImplemented('dialog.pickDirectory'))
  bus.registerHandler('dialog', 'progressOpen', notImplemented('dialog.progress'))
  bus.registerHandler('dialog', 'progressUpdate', notImplemented('dialog.progress'))
  bus.registerHandler('dialog', 'progressClose', notImplemented('dialog.progress'))
  bus.registerHandler('dialog', 'properties', notImplemented('dialog.properties'))
  bus.registerHandler('dialog', 'pickColor', notImplemented('dialog.pickColor'))
  bus.registerHandler('dialog', 'pickFont', notImplemented('dialog.pickFont'))
  bus.registerHandler('dialog', 'showQR', notImplemented('dialog.showQR'))

  // 主题变化时主动推送给所有应用
  ThemeRegistry.instance.on('effectiveThemeChanged', (theme) => {
    AppMessageBus.instance.broadcast('theme.changed', { theme })
  })

  // 通知中心同步：每条 notify 都记录一份
  const _origNotify = notify // 这里只是引用，不替换
  void _origNotify
}

// 同步 notify 调用到通知中心（在 main.ts 调用时使用此包装版）
export function notifyAndRecord(opts: Parameters<typeof notify>[0]): ReturnType<typeof notify> {
  NotificationCenter.instance.record({
    title: opts.title,
    message: opts.message,
    level: opts.level ?? 'info',
  })
  return notify(opts)
}

// ============================================================
// dialog.openPage 实现
// ============================================================

interface OpenPageArgs {
  url?: string
  app?: { appId: string; entryId: string; params?: Record<string, unknown> }
  title?: string
  icon?: string
  width?: number
  height?: number
  buttons?: DialogButtonDef[]
  modal?: DialogModal
}

let _nextDialogIdCounter = 0
function generateDialogId(): string {
  return `dlg-${++_nextDialogIdCounter}-${Date.now().toString(36)}`
}

function findDialogById(dialogId: string): DialogWindow | null {
  for (const w of WindowManager.instance.getAll()) {
    if (w instanceof DialogWindow && w.dialogId === dialogId) return w
  }
  return null
}

async function openPageDialog(args: OpenPageArgs, source: AppWindow): Promise<DialogResult> {
  // 解析 URL：优先 args.url；否则用 appId+entryId 解析 manifest 拿 uri
  let url: string
  if (args.url) {
    // 相对路径以调用方 app 的 URL 为 base 解析（不是 shell 的 URL）
    try {
      url = new URL(args.url, source.appUrl).toString()
    } catch {
      url = args.url
    }
  } else if (args.app) {
    const entries = AppRegistry.instance.listEntries()
    const entry = entries.find(
      (e) => e.appId === args.app!.appId && e.id === args.app!.entryId,
    )
    if (!entry) {
      throw Object.assign(new Error(`app ${args.app.appId}/${args.app.entryId} 不存在`), {
        code: 'APP_NOT_FOUND',
      })
    }
    url = resolveEntryUri(entry, '')
    // params 拼成查询串
    if (args.app.params) {
      const u = new URL(url, window.location.href)
      for (const [k, v] of Object.entries(args.app.params)) {
        u.searchParams.set(k, String(v))
      }
      url = u.toString()
    }
  } else {
    throw new Error('dialog.openPage: 必须传 url 或 app')
  }

  const dialogId = generateDialogId()
  const modal: DialogModal = args.modal ?? 'parent'
  const buttons: DialogButtonDef[] = args.buttons ?? []

  // 创建 DialogWindow
  const dialog = new DialogWindow({
    dialogId,
    appId: source.appId,           // 复用调用方 appId 标识，便于内嵌页 RPC 上报
    entryId: source.entryId,
    url,
    title: args.title ?? '对话框',
    icon: args.icon,
    width: args.width ?? 720,
    height: args.height ?? 480,
    buttons,
    modal,
    resizable: false,
    maximizable: false,
    minimizable: false,
    showInTaskbar: false,
    alwaysOnTop: modal !== 'none',
    pushEvent: (event, payload) => {
      AppMessageBus.instance.pushEvent(dialog, event, payload)
    },
  })

  WindowManager.instance.register(dialog)
  // DialogWindow 自己就是个 AppWindow，要注册到 MessageBus 才能收 / 发 iframe RPC
  AppMessageBus.instance.registerWindow(dialog)

  // 应用模态
  if (modal === 'parent') {
    WindowManager.instance.enterParentModal(source)
    dialog.on('close', () => WindowManager.instance.exitParentModal(source))
  } else if (modal === 'global') {
    WindowManager.instance.enterGlobalModal(dialog)
    dialog.on('close', () => WindowManager.instance.exitGlobalModal(dialog))
  }

  // 等待结果
  return new Promise<DialogResult>((resolve) => {
    let settled = false
    dialog.setResultResolver((r) => {
      if (settled) return
      settled = true
      resolve(r)
    })
    // 窗口被强关（点 ×）但没人调 _settle 时兜底
    dialog.on('close', () => {
      if (settled) return
      settled = true
      resolve({ buttonId: null })
    })
  })
}

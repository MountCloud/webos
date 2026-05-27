/// <reference types="vite/client" />
/**
 * webos 入口
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import './styles/index.scss'

import { Desktop } from './core/desktop'
import { WindowDock } from './core/dock'
import { WindowManager, type Window as WebosWindow } from './core/window'
import { alert, confirm, prompt, showDialog, notify } from './core/dialog'
import { installPositionTrackers } from './helpers/touch'
import {
  AppRegistry,
  AppLoader,
  AppMessageBus,
  StaticAppSource,
  registerBuiltinHandlers,
  notifyAndRecord,
  type AppManifest,
} from './apps'
import {
  StartMenu,
  NotificationCenter,
  GlobalSearch,
  TopLeftBar,
  TopRightBar,
} from './shell'
import { SettingsPanel, loadAndApplyIconSize } from './shell/SettingsPanel'
import { UserMenu } from './shell/UserMenu'
import { LoginDialog } from './shell/LoginDialog'
import { UserSession } from './user'
import { ThemeRegistry } from './theme'
import { i18n, t } from './i18n'

async function bootstrap(): Promise<void> {
  // 基础初始化
  installPositionTrackers()
  i18n.init()
  ThemeRegistry.instance.init()
  AppMessageBus.instance.install()
  registerBuiltinHandlers()
  // 应用持久化的桌面图标大小（必须在 Desktop 渲染前完成）
  loadAndApplyIconSize()

  // 安全网：alt-tab 离开 / 父窗口失焦 时强制清掉拖拽 / 缩放交互态
  const clearInteracting = (): void => {
    document.body.classList.remove('webos-window-interacting')
  }
  window.addEventListener('blur', clearInteracting)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInteracting()
  })
  document.addEventListener('pointerup', clearInteracting, true)

  // 屏蔽浏览器原生右键（webos 提供自己的 contextMenu）
  // 但保留 input / textarea / contenteditable —— 方便粘贴 / 拼写检查
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target instanceof HTMLInputElement) {
      const t = target.type
      if (t !== 'button' && t !== 'submit' && t !== 'checkbox' && t !== 'radio') return
    }
    if (target instanceof HTMLTextAreaElement) return
    if (target.isContentEditable) return
    e.preventDefault()
  })

  const root = document.getElementById('webos-root')
  if (!root) {
    console.error('[webos] #webos-root not found')
    return
  }

  // ===== 桌面 =====
  const desktop = new Desktop({
    contextMenu: () => [
      { label: t('refresh'), onClick: () => location.reload() },
      { label: '-' },
      { label: t('switchTheme'), onClick: () => ThemeRegistry.instance.toggle() },
      {
        label: i18n.locale === 'zh' ? 'English' : '中文',
        onClick: () => {
          i18n.locale = i18n.locale === 'zh' ? 'en' : 'zh'
          location.reload()
        },
      },
      { label: '-' },
      {
        label: t('about'),
        onClick: () =>
          alert('webos v1.0.0\n\n通用 Web 桌面平台\n\n作者：MountCloud', t('about')),
      },
    ],
  })
  desktop.mount(root)

  // ===== 顶栏（左 / 右）=====
  const topLeft = new TopLeftBar()
  topLeft.mount(root)
  const topRight = new TopRightBar()
  topRight.mount(root)

  // ===== 底部 Dock（运行中窗口）=====
  const dock = new WindowDock()
  dock.mount(root)

  // ===== 窗口管理器挂到桌面窗口层 =====
  WindowManager.instance.setContainer(desktop.windowLayer)

  // ===== 应用注册（内置演示应用 + 五个 examples） =====
  registerBuiltinApps()
  AppRegistry.instance.addSource(new StaticAppSource(getDemoApps()))
  AppRegistry.instance.addSource(new StaticAppSource(getExampleApps()))

  // 仅开发期：注册"测试程序"本地数据源 + 右上角 + 按钮
  // import.meta.env.DEV 编译时被 Vite 替换成字面量 true/false，prod build 自动 tree-shake
  if (import.meta.env.DEV) {
    const { testAppSource } = await import('./apps/TestAppSource')
    AppRegistry.instance.addSource(testAppSource)
    const { TestAppDialog } = await import('./shell/TestAppDialog')
    topRight.enableTestAppButton()
    topRight.on('plusClick', () => TestAppDialog.instance.open())
  }

  await AppRegistry.instance.refresh()

  // ===== 桌面图标（按 entry 渲染：一个应用 N 个 entry → N 个桌面图标） =====
  function refreshDesktopIcons(): void {
    const entries = AppRegistry.instance.listEntries({ showIn: 'desktop' })
    for (const icon of desktop.getAllIcons()) {
      desktop.removeIcon(icon.id)
    }
    for (const entry of entries) {
      const isTab = entry.launchMode === 'tab'
      const iconId = `${entry.appId}:${entry.id}`
      desktop.addIcon({
        id: iconId,
        name: entry.name,
        icon: entry.icon,
        externalBadge: isTab,
        onClick: () => {
          AppLoader.instance.launch(entry.appId, { entryId: entry.id })
        },
        onDblClick: () => {
          AppLoader.instance.launch(entry.appId, { entryId: entry.id })
        },
        contextMenu: [
          {
            label: isTab ? '在新标签页打开' : t('appLaunch'),
            onClick: () => {
              AppLoader.instance.launch(entry.appId, { entryId: entry.id })
            },
          },
          { label: '-' },
          {
            label: t('appInfo'),
            onClick: () =>
              alert(
                `${entry.appName} · ${entry.name}\n应用 ID：${entry.appId}\nEntry ID：${entry.id}`,
                t('appInfo'),
              ),
          },
        ],
      })
    }
  }
  refreshDesktopIcons()
  AppRegistry.instance.on('appsChanged', refreshDesktopIcons)

  // ===== StartMenu / NotificationCenter / GlobalSearch / 顶栏接线 =====
  const startMenu = new StartMenu()
  topLeft.on('menuClick', (anchor) => startMenu.toggle({ x: anchor.x, y: anchor.y }))

  topLeft.on('showDesktopClick', () => toggleShowDesktop())

  const noteCenter = NotificationCenter.instance
  noteCenter.setBadgeCallback((count) => topRight.setNotificationBadge(count))
  patchNotifyToCenter(noteCenter)
  topRight.on('notificationClick', (anchor) => noteCenter.open({ x: anchor.x, y: anchor.y }))

  const globalSearch = GlobalSearch.instance
  globalSearch.installShortcut()
  globalSearch.registerCommand({
    type: 'command',
    id: 'cmd-toggle-theme',
    title: t('switchTheme'),
    subtitle: 'webos.theme.toggle',
    icon: makeSvgIcon('🎨'),
    action: () => {
      ThemeRegistry.instance.toggle()
      globalSearch.close()
    },
  })
  globalSearch.registerCommand({
    type: 'command',
    id: 'cmd-notifications',
    title: t('notifications'),
    subtitle: 'webos.notifications.open',
    icon: makeSvgIcon('🔔'),
    action: () => {
      const rect = root.getBoundingClientRect()
      noteCenter.open({ x: rect.right - 16, y: 56 })
      globalSearch.close()
    },
  })
  topRight.on('searchClick', () => globalSearch.toggle())

  // 设置 / 用户面板
  const settingsPanel = SettingsPanel.instance
  topRight.on('settingsClick', (anchor) => settingsPanel.toggle({ x: anchor.x, y: anchor.y }))
  const userMenu = UserMenu.instance
  // UserMenu 现在只处理"已登录态下的用户菜单"——登录流程由 LoginDialog 负责。
  userMenu.configure({
    onLogout: () => {
      // UserSession.clear() 已在 UserMenu 内调过；下面的 user.change 监听会自动重弹登录框。
    },
    onAccountSettings: () => {
      notifyAndRecord({ title: '账户设置', message: '应用方可接入', level: 'info' })
    },
  })
  topRight.on('userClick', (anchor) => userMenu.toggle({ x: anchor.x, y: anchor.y }))

  // ===== 登录 / 锁屏流程 =====
  // 苹果风：未登录时整个桌面外壳（图标 / 顶栏 / dock）由 body.webos-locked 类隐藏，
  // 只露出壁纸 + 居中登录卡。登录成功才解锁；登出会再次锁屏并弹回登录框。
  function lockUI(): void {
    document.body.classList.add('webos-locked')
  }
  function unlockUI(): void {
    document.body.classList.remove('webos-locked')
  }

  async function ensureSignedIn(): Promise<void> {
    if (UserSession.instance.authenticated) return
    lockUI()
    try {
      await LoginDialog.instance.show()
    } finally {
      unlockUI()
    }
  }

  // 启动时检查会话；没登录就阻塞在登录框
  await ensureSignedIn()

  // 登出（或 token 过期、外部强制清 session）→ 再次弹登录框
  UserSession.instance.on('change', ({ user }) => {
    if (!user) {
      void ensureSignedIn()
    }
  })

  // ===== Dock 行为 =====
  const lastFocusAt = new Map<string, number>()
  const DEBOUNCE_MS = 400

  dock.on('itemClick', ({ item }) => {
    const winId = item.options.windowId
    const win = WindowManager.instance.get(winId) as WebosWindow | undefined
    if (!win) return
    const now = Date.now()
    const since = now - (lastFocusAt.get(winId) ?? 0)
    if (since < DEBOUNCE_MS) return

    const active = WindowManager.instance.getActive()
    if (win.state === 'minimized') {
      WindowManager.instance.focus(win)
    } else if (active === win) {
      win.minimize()
    } else {
      WindowManager.instance.focus(win)
    }
    lastFocusAt.set(winId, now)
  })

  dock.on('itemCloseRequested', ({ item }) => {
    const win = WindowManager.instance.get(item.options.windowId) as WebosWindow | undefined
    if (win) void win.close()
  })

  dock.on('itemCloseAppRequested', ({ item }) => {
    void AppLoader.instance.closeApp(item.options.appId)
  })

  // ===== Dock 跟随窗口 =====
  WindowManager.instance.on('windowOpen', (win) => {
    const appId = win.el.dataset.appId
    const entryId = win.el.dataset.entryId
    if (!appId || !entryId) return
    const entry = AppRegistry.instance.getEntry(appId, entryId)
    if (!entry) return
    const item = dock.addItem({
      appId,
      windowId: win.id,
      name: win.options.title ?? entry.name,
      icon: entry.icon,
    })
    // 应用调 setTitle / setIcon 时同步到 dock 项
    win.on('titleChange', (newTitle) => item.setName(newTitle))
    win.on('iconChange', (newIcon) => item.setIcon(newIcon))
  })
  WindowManager.instance.on('windowClose', (win) => {
    dock.removeItem(win.id)
  })
  WindowManager.instance.on('activeChange', (win) => {
    dock.setActive(win?.id ?? null)
  })

  // ===== 显示桌面：双向切换 =====
  let lastMinimized: Set<string> | null = null
  function toggleShowDesktop(): void {
    const all = WindowManager.instance.getAll()
    const visible = all.filter((w) => w.state !== 'minimized' && w.state !== 'closed')
    if (visible.length > 0) {
      // 当前有可见窗口 → 全部最小化，记下这次操作影响的窗口
      lastMinimized = new Set(visible.map((w) => w.id))
      for (const w of visible) w.minimize()
    } else if (lastMinimized && lastMinimized.size > 0) {
      // 已经全最小化了 → 恢复上次那批
      for (const id of lastMinimized) {
        const w = WindowManager.instance.get(id)
        if (w && w.state === 'minimized') WindowManager.instance.focus(w)
      }
      lastMinimized = null
    }
  }

  // 启动后弹欢迎窗口
  setTimeout(() => AppLoader.instance.launch('welcome', { entryId: 'main' }), 300)
}

// ===== 内置应用 =====

function getDemoApps(): AppManifest[] {
  return [
    {
      appId: 'welcome',
      name: '欢迎',
      icon: makeSvgIcon('🎉'),
      entries: [
        {
          id: 'main',
          name: '欢迎',
          icon: makeSvgIcon('🎉'),
          uri: makeWelcomePage(),
          defaultWindow: { width: 540, height: 420, resizable: true },
          showIn: ['desktop', 'start-menu'],
          order: 10,
          singleInstance: true,
        },
      ],
    },
    {
      appId: 'demo-dialog',
      name: '对话框演示',
      icon: makeSvgIcon('💬'),
      entries: [
        {
          id: 'main',
          name: '对话框演示',
          icon: makeSvgIcon('💬'),
          uri: 'about:blank',
          showIn: ['desktop', 'start-menu'],
          order: 20,
        },
      ],
    },
    {
      appId: 'demo-notify',
      name: '通知演示',
      icon: makeSvgIcon('🔔'),
      entries: [
        {
          id: 'main',
          name: '通知演示',
          icon: makeSvgIcon('🔔'),
          uri: 'about:blank',
          showIn: ['desktop', 'start-menu'],
          order: 30,
        },
      ],
    },
    {
      appId: 'sdk-demo',
      name: 'SDK 演示',
      icon: makeSvgIcon('🔧'),
      entries: [
        {
          id: 'main',
          name: 'SDK 演示',
          icon: makeSvgIcon('🔧'),
          uri: makeSdkDemoPage(),
          defaultWindow: { width: 720, height: 480 },
          showIn: ['desktop', 'start-menu'],
          order: 40,
        },
      ],
    },
    {
      appId: 'about',
      name: '关于',
      icon: makeSvgIcon('ℹ️'),
      entries: [
        {
          id: 'main',
          name: '关于',
          icon: makeSvgIcon('ℹ️'),
          uri: makeAboutPage(),
          defaultWindow: { width: 480, height: 320, resizable: false },
          showIn: ['start-menu'],
          order: 100,
          singleInstance: true,
        },
      ],
    },
  ]
}

// examples/ 下的五个示例应用
// 静态示例（01 / 05）由 vite.config.ts 的中间件直接托管在 5173 上
// Vite 示例（02 / 03 / 04）需要各自的 dev server（端口已固定）
function getExampleApps(): AppManifest[] {
  return [
    {
      appId: 'example-vanilla-html',
      name: '示例 · Vanilla HTML',
      icon: makeSvgIcon('📄'),
      entries: [
        {
          id: 'main',
          name: '示例 · Vanilla HTML',
          icon: makeSvgIcon('📄'),
          uri: '/examples/01-vanilla-html/index.html',
          defaultWindow: { width: 760, height: 580, resizable: true },
          showIn: ['desktop', 'start-menu'],
          order: 200,
        },
      ],
    },
    {
      appId: 'example-vanilla-js-vite',
      name: '示例 · Vanilla JS',
      icon: makeSvgIcon('📦'),
      entries: [
        {
          id: 'main',
          name: '示例 · Vanilla JS',
          icon: makeSvgIcon('📦'),
          uri: 'http://localhost:5501/',
          defaultWindow: { width: 760, height: 580, resizable: true },
          showIn: ['desktop', 'start-menu'],
          order: 210,
        },
      ],
    },
    {
      appId: 'example-vue-js',
      name: '示例 · Vue 3',
      icon: makeSvgIcon('🟢'),
      entries: [
        {
          id: 'main',
          name: '示例 · Vue 3',
          icon: makeSvgIcon('🟢'),
          uri: 'http://localhost:5502/',
          defaultWindow: { width: 800, height: 620, resizable: true },
          showIn: ['desktop', 'start-menu'],
          order: 220,
        },
      ],
    },
    {
      appId: 'example-react-ts',
      name: '示例 · React + TS',
      icon: makeSvgIcon('⚛️'),
      entries: [
        {
          id: 'main',
          name: '示例 · React + TS',
          icon: makeSvgIcon('⚛️'),
          uri: 'http://localhost:5503/',
          defaultWindow: { width: 820, height: 640, resizable: true },
          showIn: ['desktop', 'start-menu'],
          order: 230,
        },
      ],
    },
    {
      appId: 'example-jquery-legacy',
      name: '示例 · jQuery',
      icon: makeSvgIcon('🦄'),
      entries: [
        {
          id: 'main',
          name: '示例 · jQuery',
          icon: makeSvgIcon('🦄'),
          uri: '/examples/05-jquery-legacy/index.html',
          defaultWindow: { width: 760, height: 580, resizable: true },
          showIn: ['desktop', 'start-menu'],
          order: 240,
        },
      ],
    },
    {
      appId: 'example-react-mui',
      name: '示例 · React + MUI',
      icon: makeSvgIcon('🎨'),
      entries: [
        {
          id: 'main',
          name: '示例 · React + MUI',
          icon: makeSvgIcon('🎨'),
          uri: 'http://localhost:5504/',
          defaultWindow: {
            width: 880,
            height: 700,
            resizable: true,
            minWidth: 600,
            minHeight: 500,
          },
          showIn: ['desktop', 'start-menu'],
          order: 250,
          features: [
            {
              id: 'events',
              name: '事件列表',
              uri: '?view=events',
              icon: makeSvgIcon('📋'),
              keywords: ['事件', 'event', '列表'],
              category: '审计',
            },
            {
              id: 'new-event',
              name: '新建事件',
              uri: '?view=new',
              icon: makeSvgIcon('➕'),
              keywords: ['新建', '添加', 'new', 'create'],
              category: '审计',
            },
            {
              id: 'system-info',
              name: '系统信息',
              uri: '?view=info',
              icon: makeSvgIcon('ℹ️'),
              keywords: ['系统', 'info', '信息'],
              category: '工具',
            },
          ],
        },
      ],
    },
    {
      appId: 'demo-tab-app',
      name: '示例 · 新标签打开',
      icon: makeSvgIcon('🌐'),
      entries: [
        {
          id: 'main',
          name: '示例 · 新标签打开',
          icon: makeSvgIcon('🌐'),
          // 用百度的搜索页演示 tab 模式（可改成你自己的 BI 仪表盘 URL）
          uri: 'https://www.baidu.com/',
          launchMode: 'tab',
          showIn: ['desktop', 'start-menu'],
          order: 260,
          description: '点击会在浏览器新标签页打开（适合大屏 BI / SSO 入口）',
        },
      ],
    },
    {
      appId: 'example-extensible-host',
      name: '扩展点宿主示例',
      icon: makeSvgIcon('🧩'),
      description: '声明 settings.tabs slot · 用 Webos.contributes.list 渲染其他应用注册的扩展项',
      entries: [
        {
          id: 'main',
          name: '扩展点宿主',
          icon: makeSvgIcon('🧩'),
          uri: '/examples/07-extensible-host/index.html',
          defaultWindow: { width: 720, height: 560, resizable: true, minWidth: 520, minHeight: 400 },
          showIn: ['desktop', 'start-menu'],
          order: 300,
          permissions: ['notify', 'dialog', 'window', 'apps', 'events'],
        },
      ],
    },
    {
      appId: 'example-extension-plugin',
      name: '扩展点插件示例',
      icon: makeSvgIcon('🔌'),
      description: '通过 manifest contributes 把自己挂到 example-extensible-host 的 settings.tabs',
      entries: [
        {
          id: 'main',
          name: '扩展点插件',
          icon: makeSvgIcon('🔌'),
          uri: '/examples/08-extension-plugin/index.html',
          defaultWindow: { width: 640, height: 480, resizable: true, minWidth: 480, minHeight: 360 },
          showIn: ['desktop', 'start-menu'],
          order: 310,
          permissions: ['notify', 'dialog', 'window', 'storage'],
        },
      ],
      contributes: {
        // 固定字段只有 host / slot / entryId，其余（order / badge 等）随便放，host 端 contributes.list 原样拿到
        extensionPoints: [
          {
            host: 'example-extensible-host',
            slot: 'settings.tabs',
            entryId: 'main',
            label: '插件设置面板',
            icon: makeSvgIcon('🔌'),
            description: '声明了 uri，点开以 ?view=plugin-settings 启动，进设置视图',
            uri: '?view=plugin-settings',
            // 业务自定义属性，原样透传
            order: 10,
            badge: 'beta',
          },
          {
            host: 'example-extensible-host',
            slot: 'settings.tabs',
            entryId: 'main',
            label: '插件主页（无 uri）',
            icon: makeSvgIcon('🔌'),
            description: '没声明 uri，点开直接启动插件默认页',
            // 业务自定义属性，原样透传
            order: 20,
            badge: 'new',
          },
        ],
      },
    },
  ]
}

// 用桌面壳能力直接弹（绕过 iframe），让两个演示应用直接展示对话框 / 通知
function registerBuiltinApps(): void {
  // 拦截 demo-dialog 与 demo-notify 的启动，绕过 iframe 直接展示能力
  AppLoader.instance.on('appLaunched', () => {
    /* placeholder */
  })

  // hook：launch 之前判断
  const originalLaunch = AppLoader.instance.launch.bind(AppLoader.instance)
  AppLoader.instance.launch = ((appId: string, options: Parameters<typeof AppLoader.instance.launch>[1]) => {
    if (appId === 'demo-dialog') {
      void runDialogDemo()
      return null
    }
    if (appId === 'demo-notify') {
      runNotifyDemo()
      return null
    }
    return originalLaunch(appId, options)
  }) as typeof AppLoader.instance.launch
}

async function runDialogDemo(): Promise<void> {
  // 演示：自定义按钮 + 图标 + 自定义文本
  const action = await showDialog<'save' | 'discard' | 'cancel'>({
    title: '保存修改？',
    message: '文档"未命名 1"有未保存的修改。\n\n关闭前要不要保存？',
    icon: 'question',
    width: 460,
    buttons: [
      { label: '不保存', value: 'discard', type: 'danger' },
      { label: '取消', value: 'cancel', type: 'secondary', cancel: true },
      { label: '保存', value: 'save', type: 'primary', autoFocus: true },
    ],
  })

  if (action === 'cancel') {
    notifyAndRecord({ title: '已取消', level: 'info' })
    return
  }
  if (action === 'discard') {
    notifyAndRecord({ title: '修改已丢弃', level: 'warning' })
    return
  }

  // 演示：自定义按钮文字 + 危险样式
  const ok = await confirm({
    message: '即将永久删除 12 个文件。此操作不可撤销。',
    title: '确认删除',
    icon: 'warning',
    confirmText: '永久删除',
    cancelText: '保留文件',
    danger: true,
  })
  if (!ok) {
    notifyAndRecord({ title: '已保留文件', level: 'success' })
    return
  }

  // 演示：prompt 自定义按钮文字
  const name = await prompt({
    message: '请输入你的名字：',
    defaultValue: 'MountCloud',
    placeholder: '昵称',
    confirmText: '走起',
    cancelText: '算了',
  })
  if (name) {
    notifyAndRecord({
      title: `你好，${name}！`,
      message: 'webos 通知系统正在工作。',
      level: 'success',
    })
  }
}

function runNotifyDemo(): void {
  notifyAndRecord({ title: '信息通知', message: '这是一条普通信息', level: 'info' })
  setTimeout(() => {
    notifyAndRecord({ title: '警告', message: '注意，这是警告级别的通知', level: 'warning' })
  }, 600)
  setTimeout(() => {
    notifyAndRecord({
      title: '高危告警',
      message: '检测到关键事件，需要立即处理',
      level: 'critical',
      actions: [
        { label: '查看详情', onClick: () => alert('详情：演示用') },
        { label: '忽略', onClick: () => {} },
      ],
    })
  }, 1200)
}

// ===== 让 notify() 同步进 NotificationCenter =====
function patchNotifyToCenter(center: NotificationCenter): void {
  // 这里通过包装 dialog 的 notify：在 main 启动时引用过来一次
  // 简化：用 window 全局事件
  const origNotify = notify
  ;(window as unknown as { _webosNotify: typeof notify })._webosNotify = ((opts) => {
    center.record({
      title: opts.title,
      message: opts.message,
      level: opts.level ?? 'info',
    })
    return origNotify(opts)
  }) as typeof notify
  // 注：演示代码通过 import 直接调用 notify，原始引用不会被替换
  // 真正的方式应该是让 dialog/Notification 内部主动 emit 事件，由 NotificationCenter 订阅
  // 目前简化处理：每次桌面壳内部调 notify 时手动同步
  const realNotify = origNotify
  // monkey-patch 不可行（ESM 导出是只读绑定），改为：所有通知发送处主动调用 record
  void realNotify
}

// ===== 内嵌示例页面 =====

function makeWelcomePage(): string {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <title>欢迎使用 webos</title>
      <style>
        body {
          margin: 0;
          padding: 32px;
          font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #e0e7ee 100%);
          color: #1a202c;
          line-height: 1.7;
        }
        h1 { margin: 0 0 12px; font-size: 26px; }
        h2 { margin-top: 24px; font-size: 16px; color: #2c5282; }
        ul { padding-left: 20px; }
        .footer { margin-top: 32px; color: #718096; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>👋 欢迎使用 webos</h1>
      <p>通用 Web 桌面平台。给任何 Web 应用一个"桌面运行时 + 完整 SDK"。</p>

      <h2>试试这些操作</h2>
      <ul>
        <li>拖动这个窗口</li>
        <li>右下角拉伸窗口大小</li>
        <li>双击标题栏最大化</li>
        <li>右键桌面打开菜单</li>
        <li>点左下角"开始"按钮打开应用列表</li>
        <li>按 <strong>Cmd/Ctrl + K</strong> 全局搜索</li>
        <li>双击其他图标打开应用</li>
      </ul>

      <div class="footer">作者：MountCloud · MIT</div>
    </body>
    </html>
  `
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function makeAboutPage(): string {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <title>关于 webos</title>
      <style>
        body {
          margin: 0;
          padding: 32px;
          font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #1a202c;
          background: #fff;
          text-align: center;
        }
        .logo { font-size: 64px; }
        h1 { margin: 12px 0 8px; }
        .ver { color: #718096; }
        .meta { margin-top: 24px; color: #4a5568; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="logo">🌐</div>
      <h1>webos</h1>
      <div class="ver">v1.0.0</div>
      <div class="meta">
        通用 Web 桌面平台<br>
        作者：MountCloud<br>
        MIT License
      </div>
    </body>
    </html>
  `
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function makeSdkDemoPage(): string {
  // 一个简单的应用 iframe 页面，演示通过 postMessage 调 webos 能力
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <title>SDK 演示</title>
      <style>
        body {
          margin: 0;
          padding: 24px;
          font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
          background: #f5f7fa;
          color: #1a202c;
        }
        h2 { margin: 0 0 16px; }
        button {
          padding: 8px 16px;
          margin: 4px 4px 4px 0;
          background: #2c5282;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        button:hover { background: #2a4d75; }
        pre {
          background: #1a202c;
          color: #f7fafc;
          padding: 12px;
          border-radius: 6px;
          font-size: 12px;
          margin-top: 16px;
          max-height: 200px;
          overflow: auto;
        }
      </style>
    </head>
    <body>
      <h2>🔧 SDK 演示</h2>
      <p>这个应用跑在 iframe 里，通过 postMessage 调用 webos 桌面壳的能力。</p>
      <div>
        <button onclick="callWebos('notify','show',{title:'来自应用',message:'这条通知由 iframe 应用通过 SDK 触发',level:'info'})">弹通知</button>
        <button onclick="callWebos('dialog','alert',{message:'iframe 应用调用了 alert',title:'提示'})">弹 Alert</button>
        <button onclick="callWebos('dialog','confirm',{message:'确认操作？',title:'确认'}).then(r=>log('confirm: '+r))">弹 Confirm</button>
        <button onclick="callWebos('dialog','prompt',{message:'输入名字',defaultValue:'World'}).then(r=>log('prompt: '+r))">弹 Prompt</button>
        <button onclick="callWebos('window','close',{})">关闭自己</button>
        <button onclick="callWebos('apps','list',{}).then(r=>log('apps: '+JSON.stringify(r.map(a=>a.appId))))">列出应用</button>
      </div>
      <pre id="log">[等待操作]</pre>
      <script>
        let reqId = 0
        const pending = new Map()

        function callWebos(module, method, args) {
          return new Promise((resolve, reject) => {
            const id = 'req-' + (++reqId)
            pending.set(id, { resolve, reject })
            parent.postMessage({ type: 'webos.request', id, module, method, args, appId: 'sdk-demo' }, '*')
          })
        }

        window.addEventListener('message', (e) => {
          if (e.data?.type === 'webos.response') {
            const p = pending.get(e.data.id)
            if (!p) return
            pending.delete(e.data.id)
            if (e.data.ok) p.resolve(e.data.data)
            else p.reject(e.data.error)
          }
        })

        function log(msg) {
          const el = document.getElementById('log')
          el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\\n' + el.textContent
        }
      </script>
    </body>
    </html>
  `
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

// 用 emoji 当临时图标
function makeSvgIcon(emoji: string): string {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <rect width='64' height='64' rx='12' fill='rgba(255,255,255,0.2)'/>
      <text x='32' y='44' font-size='38' text-anchor='middle' font-family='sans-serif'>${emoji}</text>
    </svg>
  `.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap())
} else {
  void bootstrap()
}

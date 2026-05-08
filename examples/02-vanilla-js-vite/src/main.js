import { Webos } from '@webos/host-sdk'

const log = (msg) => {
  const el = document.getElementById('log')
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + el.textContent
}

const handlers = {
  notify: () => Webos.notify({ title: '来自 Vanilla JS', message: '一切正常', level: 'info' }),
  alert: () => Webos.dialog.alert('Vite + ESM 接入示例', '提示').then(() => log('alert 已关闭')),
  confirm: () => Webos.dialog.confirm('确认操作？').then((r) => log(`confirm: ${r}`)),
  prompt: () =>
    Webos.dialog
      .prompt('请输入名字', 'World')
      .then((r) => log(`prompt: ${r ?? '(已取消)'}`)),
  setTitle: () => {
    const title = `Vanilla JS · ${new Date().toLocaleTimeString()}`
    return Webos.window.setTitle(title).then(() => log(`setTitle: ${title}`))
  },
  info: () => Webos.system.info().then((info) => log(`system.info: ${JSON.stringify(info)}`)),
  apps: () =>
    Webos.apps.list().then((list) => log(`apps: ${list.map((a) => a.appId).join(', ')}`)),
  'toggle-theme': () =>
    Webos.theme
      .current()
      .then((t) => Webos.theme.set(t === 'dark' ? 'light' : 'dark'))
      .then(() => log('主题已切换')),
  close: () => Webos.window.close(),
}

document.querySelectorAll('button[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action
    const fn = handlers[action]
    if (fn) Promise.resolve(fn()).catch((err) => log(`错误: ${err?.message ?? err}`))
  })
})

// 监听主题变化推送
Webos.theme.on('change', (theme) => log(`收到主题变更：${theme}`))

log('SDK 已加载')

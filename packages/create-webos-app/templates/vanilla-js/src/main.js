import { Webos } from '@webos/host-sdk'

const log = (msg) => {
  const el = document.getElementById('log')
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + el.textContent
}

const handlers = {
  notify: () => Webos.notify({ title: 'Hello', level: 'success' }),
  confirm: async () => {
    const ok = await Webos.dialog.confirm('确认操作？')
    log(`confirm: ${ok}`)
  },
  close: () => Webos.window.close(),
}

document.querySelectorAll('button[data-act]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fn = handlers[btn.dataset.act]
    if (fn) Promise.resolve(fn()).catch((err) => log(`错误: ${err?.message ?? err}`))
  })
})

log('SDK 已加载')

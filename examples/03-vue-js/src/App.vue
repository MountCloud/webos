<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Webos } from '@webos/host-sdk'

const logs = ref([])
const sysInfo = ref(null)

const log = (msg) => {
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`)
  if (logs.value.length > 50) logs.value.length = 50
}

const wrap = (fn) => async () => {
  try {
    await fn()
  } catch (err) {
    log(`错误: ${err?.message ?? err}`)
  }
}

const onNotify = wrap(() => {
  Webos.notify({ title: 'Hello', message: '来自 Vue 应用', level: 'info' })
  log('已弹通知')
})

const onAlert = wrap(async () => {
  await Webos.dialog.alert('Vue 3 + Composition API + SDK', '提示')
  log('alert 已关闭')
})

const onConfirm = wrap(async () => {
  const r = await Webos.dialog.confirm('继续？')
  log(`confirm: ${r}`)
})

const onPrompt = wrap(async () => {
  const r = await Webos.dialog.prompt('输入内容', 'Hello')
  log(`prompt: ${r ?? '(取消)'}`)
})

const onSetTitle = wrap(async () => {
  const t = `Vue · ${new Date().toLocaleTimeString()}`
  await Webos.window.setTitle(t)
  log(`setTitle: ${t}`)
})

const onSysInfo = wrap(async () => {
  sysInfo.value = await Webos.system.info()
  log('已读取 system.info')
})

const onListApps = wrap(async () => {
  const list = await Webos.apps.list()
  log(`apps: ${list.map((a) => a.appId).join(', ')}`)
})

const onToggleTheme = wrap(async () => {
  const t = await Webos.theme.current()
  await Webos.theme.set(t === 'dark' ? 'light' : 'dark')
  log('已切换主题')
})

const onClose = () => Webos.window.close()

let unsubTheme
let unsubMessage
onMounted(() => {
  log('组件已挂载，SDK 已就绪')
  unsubTheme = Webos.theme.on('change', (theme) => log(`主题变更: ${theme}`))
  unsubMessage = Webos.message.on((msg, fromAppId) => {
    log(`收到 ${fromAppId} 的消息: ${JSON.stringify(msg)}`)
  })
})

onBeforeUnmount(() => {
  unsubTheme?.()
  unsubMessage?.()
})
</script>

<template>
  <main>
    <h1>🟢 Vue 3 + JS 示例</h1>
    <p class="subtitle">Vue 3 Composition API + ESM 导入 SDK，无 TypeScript。</p>

    <section class="card">
      <h2>常用能力</h2>
      <button @click="onNotify">弹通知</button>
      <button @click="onAlert">Alert</button>
      <button @click="onConfirm">Confirm</button>
      <button @click="onPrompt">Prompt</button>
      <button @click="onSetTitle">改窗口标题</button>
      <button @click="onSysInfo">读 system.info</button>
      <button @click="onListApps">列出应用</button>
      <button @click="onToggleTheme">切换主题</button>
      <button class="danger" @click="onClose">关闭自己</button>
    </section>

    <section v-if="sysInfo" class="card">
      <h2>系统信息</h2>
      <dl>
        <template v-for="(v, k) in sysInfo" :key="k">
          <dt>{{ k }}</dt>
          <dd>{{ v }}</dd>
        </template>
      </dl>
    </section>

    <section class="card">
      <h2>调用日志</h2>
      <pre>{{ logs.join('\n') || '[等待操作]' }}</pre>
    </section>
  </main>
</template>

<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  background: #f5f7fa;
  color: #1a202c;
  line-height: 1.6;
}
main { padding: 24px; }
h1 { margin: 0 0 8px; font-size: 22px; }
.subtitle { color: #718096; font-size: 13px; margin-bottom: 20px; }
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.card h2 { margin: 0 0 12px; font-size: 14px; color: #2c5282; }
button {
  padding: 8px 14px;
  margin: 4px 6px 4px 0;
  background: #38a169;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
button:hover { background: #2f855a; }
button.danger { background: #c53030; }
button.danger:hover { background: #9b2c2c; }
pre {
  background: #1a202c;
  color: #cbd5e0;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  max-height: 220px;
  overflow: auto;
  margin: 0;
  font-family: "Consolas", "Monaco", monospace;
  white-space: pre-wrap;
}
dl {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 4px 16px;
  margin: 0;
  font-size: 13px;
}
dt { color: #4a5568; }
dd { margin: 0; word-break: break-all; }
</style>

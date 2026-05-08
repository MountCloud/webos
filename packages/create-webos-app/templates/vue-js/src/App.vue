<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Webos } from '@webos/host-sdk'

const user = ref(null)
const theme = ref('light')

let unsubUser, unsubTheme
onMounted(async () => {
  user.value = await Webos.user.current()
  theme.value = await Webos.theme.current()
  unsubUser = Webos.user.on('change', ({ user: u }) => (user.value = u))
  unsubTheme = Webos.theme.on('change', (t) => (theme.value = t))
})
onBeforeUnmount(() => { unsubUser?.(); unsubTheme?.() })

const onConfirm = async () => {
  const ok = await Webos.dialog.confirm('确认操作？')
  Webos.notify({ title: ok ? '已确认' : '已取消' })
}
</script>

<template>
  <div :class="['app', `theme-${theme}`]">
    <header>
      <h1>__DISPLAY_NAME__</h1>
      <span class="meta">{{ user ? `已登录：${user.name}` : '未登录' }} · 主题：{{ theme }}</span>
    </header>
    <main>
      <p>这是一个由 <code>create-webos-app</code> 生成的 Vue 3 应用。</p>
      <div class="actions">
        <button @click="Webos.notify({ title: 'Hello', level: 'success' })">弹通知</button>
        <button @click="onConfirm">Confirm</button>
        <button @click="Webos.window.close()">关闭窗口</button>
      </div>
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
.app { min-height: 100vh; padding: 24px; background: var(--bg, #f5f7fa); color: var(--fg, #1a202c); }
.app.theme-dark { --bg: #1a202c; --fg: #f7fafc; }
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
h1 { margin: 0; font-size: 22px; }
.meta { color: #718096; font-size: 13px; }
.actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
button { padding: 8px 16px; background: #42b883; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
button:hover { background: #369873; }
</style>

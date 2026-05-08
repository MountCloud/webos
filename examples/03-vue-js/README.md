# 示例 03 - Vue 3 + JS

Vue 3 SFC + Composition API + Vite，**不用 TypeScript**。

## 怎么跑

```bash
pnpm install
pnpm dev   # http://localhost:5502
```

## 关键点

- 在 `<script setup>` 里直接 `import { Webos } from '@webos/host-sdk'`
- 在 `onMounted` 里订阅 `Webos.theme.on()` / `Webos.message.on()`，在 `onBeforeUnmount` 释放
- 所有 SDK 调用都是 Promise，配合 `async/await` 极顺手

```vue
<script setup>
import { Webos } from '@webos/host-sdk'
const greet = async () => {
  const name = await Webos.dialog.prompt('你叫啥?', 'World')
  if (name) Webos.notify({ title: `你好 ${name}` })
}
</script>
```

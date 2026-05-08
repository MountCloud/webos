# 示例 04 - React + TypeScript

React 18 + TypeScript + Vite，包含完整类型推导。

## 怎么跑

```bash
pnpm install
pnpm dev   # http://localhost:5503
```

## 关键点

- `import { Webos, type SystemInfo } from '@webos/host-sdk'` ——所有 RPC 返回值都有类型
- 在 `useEffect` 里订阅 `Webos.theme.on()`、`Webos.message.on()`，return 里反订阅
- 用 `useCallback` + `useState` 维护日志列表，闭包 + Promise 自然衔接

```tsx
useEffect(() => {
  const off = Webos.theme.on('change', (t) => console.log(t))
  return off
}, [])
```

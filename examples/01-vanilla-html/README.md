# 示例 01 - Vanilla HTML

最简单的接入方式：一个 HTML 文件，加一行 `<script>` 引 SDK 的 UMD 包，零构建。

## 结构

```
01-vanilla-html/
├── index.html      # 应用主页面
├── manifest.json   # 应用清单（注册到 webos 时使用）
└── README.md
```

## 怎么跑

### 方式一：通过 webos 桌面壳加载

1. 启动 webos：

   ```bash
   cd ../../apps/webos-shell
   pnpm dev
   ```

2. 把本目录通过任意静态服务暴露出去（端口随便）：

   ```bash
   cd examples/01-vanilla-html
   npx serve -p 5500
   ```

3. 在 `apps/webos-shell/src/main.ts` 里把 `manifest.json` 添加到 `getDemoApps()`，并把 `entry` 改成 `http://localhost:5500/index.html`。

4. 刷新 webos 页面，桌面上会多出一个图标。

### 方式二：单独打开（脱离桌面壳）

直接双击 `index.html`，能看到界面但所有 SDK 调用会静静失败 / 超时——这是预期，因为 SDK 必须有一个父窗口（webos shell）做对端。

## 关键代码

UMD 把 SDK 暴露到 `window.Webos`：

```html
<script src="https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js"></script>
<script>
  window.Webos.notify({ title: "Hi", message: "Hello", level: "info" });
</script>
```

只要 SDK 能加载，调用风格和 ESM 包完全一致。

## 参考

更多 API 见 [docs/HOST_SDK_API.md](../../docs/HOST_SDK_API.md)。

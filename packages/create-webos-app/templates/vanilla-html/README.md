# __DISPLAY_NAME__

由 `create-webos-app` 生成 · **Vanilla HTML · 零构建**

直接用任何静态服务起：

```bash
npx serve . -p 8080    # 或 python -m http.server 8080 / live-server / 任何
```

或扔到 webos shell 的某个目录里被托管访问。

`manifest.json` 的 `entries[0].uri` 默认填的是 `http://localhost:8080/`（必须是绝对 URL），按你实际部署地址调整即可。

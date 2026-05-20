# 前置条件

本模板用 UMD `<script>` 引 `@webos/host-sdk`。**默认 CDN 路径来自
`cdn.jsdelivr.net/npm/@webos/host-sdk`，但团队规定不发 npm，CDN 会 404**。

需要手动从本地 webos 仓库拿 UMD 文件，并改 `index.html` 的 script 路径。

## 一次性准备

```powershell
# 1) 构建 webos 的 host-sdk
cd <webos 仓库根>
pnpm install
pnpm --filter @webos/host-sdk build
```

## 在本项目里

```powershell
# 2) 把 UMD 文件拷进本项目（或建软链接）
copy "<webos>\packages\host-sdk\dist\host-sdk.umd.js" .\host-sdk.umd.js

# 3) 改 index.html 的 <script src>：
#    从  https://cdn.jsdelivr.net/npm/@webos/host-sdk/dist/host-sdk.umd.js
#    改为 ./host-sdk.umd.js

# 4) 启动任意静态服务器
npx serve .
```

## 升级

webos 的 host-sdk 改了：重跑 build 然后**手动重拷** UMD 文件到本项目，
路径写死的纯静态模板没法自动同步。

如果嫌烦，建议切到 `vanilla-js` 或 `react-*` 模板用 npm link，自动跟随源码。


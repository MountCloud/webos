# 前置条件

本应用依赖两个 webos 内部包：

- `@webos/host-sdk` —— webos 桌面 SDK
- `@webos/mui-theme` —— MUI 主题适配层（仅 React+MUI 模板）

按团队约定，这两个包**不上传任何 registry**（npm 公网 / Nexus / 内网镜像都不传）。
直接 `npm install` 会 404。本地通过 **`npm link`** 把它们接进来。

## 一次性准备（每台开发机做一次）

```powershell
# 1) 拉起 webos 仓库的依赖 + 构建两个包
cd <你的 webos 仓库根>
pnpm install
pnpm --filter @webos/host-sdk build
pnpm --filter @webos/mui-theme build      # 如果你这个模板不用 mui-theme，这条可省

# 2) 注册全局 link（无参数）
cd packages/host-sdk
npm link

cd ../mui-theme
npm link
```

注册之后 `D:\nvm\nodejs\node_modules\@webos\` 下会有两个符号链接（或对应你 npm 的全局根目录，`npm root -g` 查）。

## 在本项目里使用

```powershell
# 必须先 link 再 install——次序反了 npm 会先 404
npm link @webos/host-sdk @webos/mui-theme
npm install

npm run dev
```

## 升级 / 重建

webos 任一包改了源码后**重跑 build** 即可，本项目里的 link 是符号链接自动跟随：

```powershell
cd <webos>
pnpm --filter @webos/host-sdk build
```

不需要重新 `npm link`，也不需要重新 `npm install`。

## 常见问题

**Q: `npm install` 404 `@webos/host-sdk`？**
A: 全局 link 没建。重新做"一次性准备"第 2 步。

**Q: 不想用 link，用本地路径行不行？**
A: 行，package.json 把 `^0.1.0` 改成 `file:` 路径即可：
   ```json
   "@webos/host-sdk": "file:../path/to/webos/packages/host-sdk"
   ```
   但每次 webos 包改了需要 `npm install` 才生效；link 方式自动跟随。

@author MountCloud &lt;mountcloud@outlook.com&gt;

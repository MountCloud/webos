# 示例 05 - jQuery + UMD

老项目场景：业务页面已经在用 jQuery，不想改框架不想搞构建链，**直接加一个 `<script>` 引 SDK** 就完事。

## 结构

```
05-jquery-legacy/
├── index.html
├── manifest.json
└── README.md
```

## 怎么跑

直接静态服务这个目录即可：

```bash
npx serve -p 5504
```

然后把 manifest 里的 `entry` 改成 `http://localhost:5504/index.html`，注册到 webos。

## 关键点

- jQuery 和 webos SDK **互不干扰**——webos 只挂 `window.Webos`，不改原型
- UMD 包对 IE11 等老浏览器友好（前提是有 Promise polyfill）
- 适合**渐进式迁移**：先把老页面塞进 webos 里跑起来，逐步现代化

```html
<script src="jquery.min.js"></script>
<script src="host-sdk.umd.js"></script>
<script>
  $(function () {
    $('#btn').on('click', function () {
      window.Webos.notify({ title: 'Hello' });
    });
  });
</script>
```

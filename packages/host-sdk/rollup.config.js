/*
 * @Author: MountCloud mountcloud@outlook.com
 * @Date: 2026-05-09 01:23:06
 * @LastEditors: MountCloud mountcloud@outlook.com
 * @LastEditTime: 2026-05-09 01:27:12
 * @FilePath: \osweb\packages\host-sdk\rollup.config.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * @webos/host-sdk Rollup 打包
 * 输出 ESM / CJS / UMD + .d.ts
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import dts from 'rollup-plugin-dts'

const banner = `/*! @webos/host-sdk v1.0.0 | (c) MountCloud | MIT */`

export default [
  // ESM + CJS
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/host-sdk.esm.js', format: 'es', sourcemap: true, banner },
      { file: 'dist/host-sdk.cjs.js', format: 'cjs', sourcemap: true, banner, exports: 'named' },
    ],
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },

  // UMD（浏览器 <script> 引用，挂全局 Webos）
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/host-sdk.umd.js',
      format: 'umd',
      name: 'Webos',
      sourcemap: true,
      banner,
      // 把 default 与命名导出都暴露到 window.Webos 上
      footer: 'if (typeof window !== "undefined" && Webos && Webos.default) { window.Webos = Webos.default; }',
      exports: 'named',
    },
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },

  // 类型声明
  {
    input: 'src/index.ts',
    output: { file: 'dist/host-sdk.d.ts', format: 'es' },
    plugins: [dts()],
  },
]

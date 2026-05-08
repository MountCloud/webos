/**
 * @webos/mui-theme Rollup 打包
 * ESM + CJS + .d.ts
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import dts from 'rollup-plugin-dts'

const banner = `/*! @webos/mui-theme v1.0.0 | (c) MountCloud | MIT */`

// peer / 内置依赖：不打进 bundle
const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@mui/material',
  '@mui/material/styles',
  '@mui/material/CssBaseline',
  '@webos/host-sdk',
]

export default [
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/mui-theme.esm.js', format: 'es', sourcemap: true, banner },
      { file: 'dist/mui-theme.cjs.js', format: 'cjs', sourcemap: true, banner, exports: 'named' },
    ],
    external,
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },

  {
    input: 'src/index.ts',
    output: { file: 'dist/mui-theme.d.ts', format: 'es' },
    external,
    plugins: [dts()],
  },
]

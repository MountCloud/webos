import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, readFileSync, statSync } from 'fs'

const repoRoot = resolve(__dirname, '../../')

const mimeMap: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  cjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  map: 'application/json; charset=utf-8',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

// 自定义中间件：让 webos-shell 的 dev server 顺便托管仓库根目录下
// 的 /examples/* 和 /packages/* —— 这样静态 example（01 / 05）和 SDK
// UMD 包都能直接被 iframe 加载。
function mountRepoStatic() {
  return {
    name: 'webos-mount-repo-static',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/examples/') && !url.startsWith('/packages/')) {
          return next()
        }

        const cleanUrl = url.split('?')[0]!.split('#')[0]!
        let filePath = resolve(repoRoot, cleanUrl.slice(1))

        // 安全：禁止越界
        if (!filePath.startsWith(repoRoot)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }

        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
          filePath = resolve(filePath, 'index.html')
        }

        if (!existsSync(filePath)) {
          return next()
        }

        const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
        res.setHeader('Content-Type', mimeMap[ext] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(filePath))
      })
    },
  }
}

export default defineConfig({
  plugins: [mountRepoStatic()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    // 显式绑全 IPv4 接口——避免 Windows 默认 IPv6 优先时只绑 ::1，
    // 导致 127.0.0.1 / 内网 IP 都连不上，只有 localhost 能通的诡异现象。
    // 不想暴露到 LAN 时改成 '127.0.0.1'（仅 IPv4 loopback）。
    host: '0.0.0.0',
    port: 5173,
    open: true,
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
})

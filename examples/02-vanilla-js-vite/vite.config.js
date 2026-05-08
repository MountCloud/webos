import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5501,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

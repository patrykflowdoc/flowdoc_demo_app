import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      maxParallelFileOps: 2,
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '../src') },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
    strictPort: false,
    allowedHosts: [
      'szczypta-smaku.pl',
      'localhost',
    ],
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:25044',
        changeOrigin: true,
      },
    },
  },
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
})

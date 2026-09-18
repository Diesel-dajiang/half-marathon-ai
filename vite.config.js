import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WorkBuddy 一键部署时通常直接识别 Vite 项目。
// 这里固定端口与 host，方便移动端真机预览。
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // 本地联调：把 /api 代理到 Node 后端（npm run server）
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})

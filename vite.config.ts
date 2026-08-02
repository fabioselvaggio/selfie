import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Su GitHub Pages l'app vive sotto /<nome-repo>/, in locale sotto /.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { host: true, port: 5173 },
  // MediaPipe ships its own wasm loader; keep it out of the dep pre-bundle rewrite.
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
})

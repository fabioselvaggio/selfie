import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  // MediaPipe ships its own wasm loader; keep it out of the dep pre-bundle rewrite.
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
})

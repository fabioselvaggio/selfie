import { rmSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * public/__test__ contiene i volti di prova usati dagli script di verifica.
 * Il dev server deve servirli, il pacchetto di produzione no.
 */
function dropTestAssets(): Plugin {
  return {
    name: 'drop-test-assets',
    apply: 'build',
    closeBundle() {
      rmSync('dist/__test__', { recursive: true, force: true })
    },
  }
}

export default defineConfig({
  // Su GitHub Pages l'app vive sotto /<nome-repo>/, in locale sotto /.
  // BASE_PATH=./ produce un pacchetto che funziona ovunque lo si carichi.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), dropTestAssets()],
  server: { host: true, port: 5173 },
  // MediaPipe ships its own wasm loader; keep it out of the dep pre-bundle rewrite.
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
})

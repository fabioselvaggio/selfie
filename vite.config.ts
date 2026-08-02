import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

/**
 * Scrive dentro sw.js l'elenco dei file prodotti dal build.
 *
 * Serve perché i nomi contengono un hash e il service worker non può
 * indovinarli. Senza elenco il precarico salterebbe JS e CSS, e l'app
 * funzionerebbe offline solo dalla seconda visita: al primo caricamento il
 * worker si attiva quando quei file sono già stati scaricati dalla rete, e
 * quindi non passano da lui.
 */
function serviceWorkerPrecache(): Plugin {
  let files: string[] = []
  return {
    name: 'sw-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).filter((name) => !name.endsWith('.map'))
    },
    // closeBundle e non writeBundle: sw.js arriva da public/, che Vite copia dopo.
    closeBundle() {
      const swPath = 'dist/sw.js'
      if (!existsSync(swPath)) return
      const list = files.map((f) => `./${f}`)
      // L'identità del build cambia solo se cambiano i file: così un rideploy
      // identico non invalida la cache di chi ha già l'app installata.
      const build = createHash('sha256').update(list.join('|')).digest('hex').slice(0, 12)
      const source = readFileSync(swPath, 'utf8')
        .replace("/* @build */ 'dev'", `/* @build */ '${build}'`)
        .replace('/* @precache */ []', `/* @precache */ ${JSON.stringify(list)}`)
      writeFileSync(swPath, source)
      console.log(`  sw.js: precarico ${list.length} file, build ${build}`)
    },
  }
}

export default defineConfig({
  // Su GitHub Pages l'app vive sotto /<nome-repo>/, in locale sotto /.
  // BASE_PATH=./ produce un pacchetto che funziona ovunque lo si carichi.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), dropTestAssets(), serviceWorkerPrecache()],
  server: { host: true, port: 5173 },
  // MediaPipe ships its own wasm loader; keep it out of the dep pre-bundle rewrite.
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
})

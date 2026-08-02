/**
 * Prepara gli asset di MediaPipe in public/mp.
 *
 * Sono ~25 MB fra runtime wasm e modello: fuori dal repo, scaricati qui.
 * Il wasm arriva dal pacchetto npm già installato, il modello dal CDN pubblico
 * di Google. Una volta in public/ l'app li serve dal proprio dominio, quindi
 * a runtime non tocca nessuna rete esterna.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm'
const WASM_DST = 'public/mp/wasm'
const MODEL_DST = 'public/mp/models/face_landmarker.task'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

function fail(message) {
  console.warn(`\n  ⚠  ${message}`)
  console.warn('     L’app si avvia lo stesso ma il rilevamento del viso non funzionerà.')
  console.warn('     Riprova con: npm run setup\n')
  // Non blocchiamo l'installazione: meglio un'app che parte con un errore chiaro
  // che un `npm install` che esplode dietro un proxy aziendale.
  process.exit(0)
}

if (!existsSync(WASM_SRC)) fail(`Non trovo ${WASM_SRC}. Hai lanciato npm install?`)

mkdirSync(WASM_DST, { recursive: true })
mkdirSync('public/mp/models', { recursive: true })

let copied = 0
for (const name of readdirSync(WASM_SRC)) {
  if (!name.startsWith('vision_wasm')) continue
  copyFileSync(join(WASM_SRC, name), join(WASM_DST, name))
  copied++
}
console.log(`  runtime wasm: ${copied} file copiati in ${WASM_DST}`)

if (existsSync(MODEL_DST) && statSync(MODEL_DST).size > 1_000_000) {
  console.log('  modello: già presente')
} else {
  try {
    const res = await fetch(MODEL_URL)
    if (!res.ok) fail(`Download del modello fallito: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1_000_000) fail(`Modello troppo piccolo (${buf.length} byte): download incompleto.`)
    writeFileSync(MODEL_DST, buf)
    console.log(`  modello: ${(buf.length / 1024 / 1024).toFixed(1)} MB in ${MODEL_DST}`)
  } catch (err) {
    fail(`Download del modello fallito: ${err.message}`)
  }
}

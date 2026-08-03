/**
 * Verifica della nitidezza sulle foto grandi.
 *
 * Il caso che conta è quello vero: una foto da telefono (12 MP) che deve
 * rimpicciolire di 3-4 volte per entrare nella cornice. È lì che vive il
 * downscale progressivo, ed è lì che un errore non si vede in nessun altro
 * test: con una sorgente piccola il ciclo non parte nemmeno, e tutto sembra
 * a posto.
 *
 * Misuriamo la varianza del laplaciano — quanta energia c'è nei dettagli fini —
 * sulla zona del viso, e la confrontiamo con un rendering di riferimento fatto
 * in una passata sola dalla sorgente a piena risoluzione. La nostra pipeline
 * deve essere ALMENO altrettanto nitida: se è molto sotto, sta buttando via
 * pixel per strada.
 *
 * Uso:
 *   npm run dev
 *   CHROMIUM_PATH=/path/to/chromium node scripts/verify-sharpness.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'

const TEST_IMG = 'public/__test__/portrait.jpg'
if (!existsSync(TEST_IMG)) {
  mkdirSync('public/__test__', { recursive: true })
  const res = await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg')
  if (!res.ok) throw new Error(`Non riesco a scaricare il volto di prova: ${res.status}`)
  writeFileSync(TEST_IMG, Buffer.from(await res.arrayBuffer()))
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 430, height: 900 } })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })

const report = await page.evaluate(async () => {
  const fa = await import('/src/lib/faceAlign.ts')
  const im = await import('/src/lib/image.ts')

  const src = await im.loadImage('/__test__/portrait.jpg')

  /**
   * Fabbrica una "foto da telefono": la sorgente ingrandita a dimensioni reali,
   * con un po' di rumore fine che il downscale sbagliato distruggerebbe.
   */
  const makePhoto = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    const s = Math.max(w / src.naturalWidth, h / src.naturalHeight)
    ctx.drawImage(
      src,
      (w - src.naturalWidth * s) / 2,
      (h - src.naturalHeight * s) / 2,
      src.naturalWidth * s,
      src.naturalHeight * s,
    )
    return c
  }

  /** Varianza del laplaciano sulla zona centrale: quanto dettaglio fine c'è. */
  const sharpness = (img) => {
    const S = 320
    const c = document.createElement('canvas')
    c.width = S
    c.height = S
    const ctx = c.getContext('2d')
    // Ritaglio 1:1 sul viso, senza riscalare: vogliamo i pixel veri.
    ctx.drawImage(img, fa.FRAME_W * 0.34, fa.FRAME_H * 0.28, S, S, 0, 0, S, S)
    const d = ctx.getImageData(0, 0, S, S).data
    const g = new Float32Array(S * S)
    for (let i = 0; i < g.length; i++) {
      g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
    }
    let sum = 0
    let sum2 = 0
    let n = 0
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        const i = y * S + x
        const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - S] - g[i + S]
        sum += lap
        sum2 += lap * lap
        n++
      }
    }
    const mean = sum / n
    return sum2 / n - mean * mean
  }

  const SIZES = [
    // I 48 MP dei telefoni recenti sono il caso che fa davvero partire la
    // riduzione progressiva: senza questa riga il ciclo non viene mai eseguito
    // e il test non proverebbe niente.
    { name: '48 MP (5712×7616)', w: 5712, h: 7616 },
    { name: '12 MP (3024×4032)', w: 3024, h: 4032 },
    { name: '8 MP (2448×3264)', w: 2448, h: 3264 },
    { name: 'fotocamera (1440×1920)', w: 1440, h: 1920 },
    { name: 'piccola (900×1200)', w: 900, h: 1200 },
  ]

  const rows = []
  for (const size of SIZES) {
    const photo = makePhoto(size.w, size.h)

    const geometry = await fa.detectFace(photo, true)
    if (!geometry) {
      rows.push({ ...size, failed: true })
      continue
    }
    const align = fa.alignmentFor(geometry, size.w, size.h)

    // Quanto la pipeline riduce prima del disegno finale.
    const { factor } = im.downscaleFor(photo, size.w, size.h, align.scale)

    // Riferimento: una passata sola dalla sorgente intera.
    const ref = document.createElement('canvas')
    ref.width = fa.FRAME_W
    ref.height = fa.FRAME_H
    fa.renderAligned(ref.getContext('2d'), photo, align.matrix, fa.FRAME_W, fa.FRAME_H)

    const out = await fa.alignImage(photo, {})
    const ours = await im.loadImage(out.blob)

    rows.push({
      ...size,
      scale: align.scale,
      factor,
      // Dimensione reale della sorgente al momento del disegno finale.
      sourcePx: `${Math.round(size.w * factor)}×${Math.round(size.h * factor)}`,
      sharpRef: sharpness(ref),
      sharpOurs: sharpness(ours),
    })
  }
  return { rows, frame: `${fa.FRAME_W}×${fa.FRAME_H}` }
})

console.log(`\n  Cornice di lavoro: ${report.frame}`)
console.log('  ' + '-'.repeat(84))
console.log('  sorgente                 riduzione  sorgente al disegno   nitidezza rif.  nostra   esito')
let bad = 0
for (const r of report.rows) {
  if (r.failed) {
    console.log(`  ${r.name.padEnd(24)} VOLTO NON RILEVATO`)
    bad++
    continue
  }
  const ratio = r.sharpOurs / r.sharpRef
  // Il downscale progressivo deve essere almeno buono quanto la passata unica.
  const ok = ratio >= 0.8
  if (!ok) bad++
  console.log(
    `  ${r.name.padEnd(24)} ${r.scale.toFixed(3).padStart(9)}  ${r.sourcePx.padStart(19)}  ` +
      `${r.sharpRef.toFixed(1).padStart(14)}  ${r.sharpOurs.toFixed(1).padStart(7)}  ${ok ? 'ok' : `SGRANATA (${(ratio * 100).toFixed(0)}%)`}`,
  )
}
console.log(bad ? `\n  ${bad} casi con perdita di qualità` : '\n  nessuna perdita di qualità')

await browser.close()
process.exitCode = bad

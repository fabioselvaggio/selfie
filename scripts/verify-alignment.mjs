/**
 * Verifica dell'allineamento.
 *
 * Prendiamo UNA sola foto e ne fabbrichiamo N varianti con rotazione, zoom e
 * traslazione note — cioè simuliamo "la stessa faccia fotografata male in N
 * giorni diversi". Se l'allineamento funziona, tutte le uscite devono essere
 * praticamente la stessa immagine.
 *
 * La metrica che conta NON è l'errore assoluto rispetto al punto di destinazione:
 * uno scostamento sistematico sposta tutti i fotogrammi allo stesso modo e resta
 * invisibile. Quello che si vede nel timelapse è la DISPERSIONE fra un giorno e
 * l'altro. Per questo misuriamo la deviazione standard di posizione, distanza
 * interpupillare e angolo sulle uscite.
 *
 * Uso:
 *   npm run dev            # in un altro terminale
 *   CHROMIUM_PATH=/path/to/chromium node scripts/verify-alignment.mjs [cartella-output]
 */
import { chromium } from 'playwright'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'

const OUT = process.argv[2] || '.'

// Il volto di prova è un asset pubblico di MediaPipe: lo scarichiamo al volo
// invece di tenerlo nel repo.
const TEST_IMG = 'public/__test__/portrait.jpg'
if (!existsSync(TEST_IMG)) {
  mkdirSync('public/__test__', { recursive: true })
  const res = await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg')
  if (!res.ok) throw new Error(`Non riesco a scaricare il volto di prova: ${res.status}`)
  writeFileSync(TEST_IMG, Buffer.from(await res.arrayBuffer()))
  console.log('  Scaricato', TEST_IMG)
}

// In ambienti dove Playwright non ha scaricato i suoi browser si usa quello di sistema.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 430, height: 900 } })
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !t.includes('TensorFlow Lite')) {
    console.log('   [browser]', t.slice(0, 160))
  }
})

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })

const report = await page.evaluate(async () => {
  const fa = await import('/src/lib/faceAlign.ts')
  const im = await import('/src/lib/image.ts')

  /** Gli scatti "sbagliati" che vogliamo veder raddrizzare. */
  const VARIANTS = [
    { name: 'dritta', rot: 0, scale: 1.0, dx: 0, dy: 0 },
    { name: 'storta + vicina', rot: 7, scale: 1.35, dx: 0.02, dy: 0.04 },
    { name: 'storta + lontana', rot: -5, scale: 0.62, dx: -0.03, dy: 0 },
    { name: 'decentrata', rot: 2, scale: 1.05, dx: 0.12, dy: -0.08 },
    { name: 'molto storta', rot: -11, scale: 1.15, dx: 0, dy: 0.05 },
  ]

  const CONFIGS = [
    { mouthWeight: 0, refine: true },
    { mouthWeight: 0.15, refine: true },
    { mouthWeight: 0.2, refine: true },
    { mouthWeight: 0.6, refine: true },
    { mouthWeight: 0.15, refine: false },
  ]

  const W = 900
  const H = 1200
  const src = await im.loadImage('/__test__/portrait.jpg')

  const makeVariant = (v) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#26221f'
    ctx.fillRect(0, 0, W, H)
    const base = Math.max(W / src.naturalWidth, H / src.naturalHeight)
    ctx.translate(W / 2, H / 2)
    ctx.rotate((v.rot * Math.PI) / 180)
    ctx.scale(base * v.scale, base * v.scale)
    ctx.translate(v.dx * src.naturalWidth, v.dy * src.naturalHeight)
    ctx.drawImage(src, -src.naturalWidth / 2, -src.naturalHeight / 2)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return c
  }

  const rawCanvases = VARIANTS.map(makeVariant)
  const targets = fa.frameTargets()
  const targetIpd = targets[1].x - targets[0].x

  const std = (xs) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
  }

  const results = []
  let showcase = null

  for (const cfg of CONFIGS) {
    const measures = []
    const images = []
    let failed = 0
    let totalMs = 0

    for (let i = 0; i < VARIANTS.length; i++) {
      const t0 = performance.now()
      const out = await fa.alignImage(rawCanvases[i], cfg)
      totalMs += performance.now() - t0
      if (!out) {
        failed++
        continue
      }
      const img = await im.loadImage(out.blob)
      images.push(img)
      // Ri-rileviamo sul RISULTATO: dove sono finiti davvero i punti?
      const g = await fa.detectFace(img, true)
      if (!g) {
        failed++
        continue
      }
      measures.push({
        midX: (g.leftEye.x + g.rightEye.x) / 2,
        midY: (g.leftEye.y + g.rightEye.y) / 2,
        ipd: Math.hypot(g.rightEye.x - g.leftEye.x, g.rightEye.y - g.leftEye.y),
        angle: (Math.atan2(g.rightEye.y - g.leftEye.y, g.rightEye.x - g.leftEye.x) * 180) / Math.PI,
        mouthY: g.mouth.y,
        coverage: out.result.coverage,
        rotationDeg: out.result.rotationDeg,
        scale: out.result.scale,
      })
    }

    // Differenza media pixel-a-pixel fra le uscite, solo sulla zona centrale del
    // viso: fuori ci sono le bande nere, che sporcherebbero la misura.
    const crop = (img) => {
      const c = document.createElement('canvas')
      c.width = 200
      c.height = 200
      const ctx = c.getContext('2d')
      ctx.drawImage(img, fa.FRAME_W * 0.28, fa.FRAME_H * 0.26, fa.FRAME_W * 0.44, fa.FRAME_H * 0.36, 0, 0, 200, 200)
      const d = ctx.getImageData(0, 0, 200, 200).data
      const g = new Float32Array(200 * 200)
      for (let k = 0; k < g.length; k++) {
        g[k] = 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2]
      }
      return g
    }
    const greys = images.map(crop)
    let mae = 0
    let n = 0
    for (let i = 1; i < greys.length; i++) {
      let sum = 0
      for (let k = 0; k < greys[0].length; k++) sum += Math.abs(greys[i][k] - greys[0][k])
      mae += sum / greys[0].length
      n++
    }

    results.push({
      ...cfg,
      failed,
      msPerPhoto: totalMs / VARIANTS.length,
      stdX: std(measures.map((m) => m.midX)),
      stdY: std(measures.map((m) => m.midY)),
      stdIpd: std(measures.map((m) => m.ipd)),
      stdAngle: std(measures.map((m) => m.angle)),
      meanIpd: measures.reduce((a, m) => a + m.ipd, 0) / measures.length,
      targetIpd,
      faceMae: n ? mae / n : 0,
      perVariant: measures.map((m, i) => ({
        name: VARIANTS[i].name,
        applied: VARIANTS[i],
        rotationDeg: m.rotationDeg,
        scale: m.scale,
        coverage: m.coverage,
      })),
    })

    if (cfg.mouthWeight === 0.2 && cfg.refine) showcase = images
  }

  // Montaggio prima/dopo con la configurazione consigliata.
  const CW = 260
  const rawH = CW * (H / W)
  const aliH = CW * (fa.FRAME_H / fa.FRAME_W)
  const montage = document.createElement('canvas')
  montage.width = CW * VARIANTS.length
  montage.height = rawH + aliH + 92
  const mc = montage.getContext('2d')
  mc.fillStyle = '#faf8f5'
  mc.fillRect(0, 0, montage.width, montage.height)
  mc.fillStyle = '#0a0a0a'
  mc.font = '900 21px sans-serif'
  mc.fillText('La stessa foto, inquadrata male in 5 modi diversi', 12, 27)
  rawCanvases.forEach((c, i) => mc.drawImage(c, i * CW + 4, 40, CW - 8, rawH - 8))
  mc.fillStyle = '#0a0a0a'
  mc.fillText('Dopo l’allineamento automatico', 12, rawH + 68)
  ;(showcase || []).forEach((img, i) => mc.drawImage(img, i * CW + 4, rawH + 82, CW - 8, aliH - 8))

  return { results, montage: montage.toDataURL('image/jpeg', 0.86) }
})

writeFileSync(`${OUT}/alignment-proof.jpg`, Buffer.from(report.montage.split(',')[1], 'base64'))

const p = (n, w, d = 2) => n.toFixed(d).padStart(w)

console.log('\n  Correzione applicata (bocca 0.20, alta precisione)')
console.log('  ' + '-'.repeat(74))
console.log('  variante             scatto storto di   corretto di        cornice piena')
const ref = report.results.find((r) => r.mouthWeight === 0.2 && r.refine)
for (const v of ref.perVariant) {
  console.log(
    `  ${v.name.padEnd(20)} ${p(v.applied.rot, 6, 1)}° ${p(v.applied.scale, 6)}×   ` +
      `${p(v.rotationDeg, 6, 1)}° ${p(v.scale, 6)}×   ${p(v.coverage * 100, 6, 0)}%`,
  )
}

console.log('\n  Dispersione fra i giorni — è questa che fa tremare il timelapse')
console.log('  ' + '-'.repeat(74))
console.log('  bocca  2 passate   σ centro occhi   σ distanza occhi   σ angolo   diff. viso   ms/foto')
for (const r of report.results) {
  console.log(
    `  ${p(r.mouthWeight, 5)}  ${(r.refine ? 'sì' : 'no').padEnd(9)}  ` +
      `${p(Math.hypot(r.stdX, r.stdY), 8)} px   ${p(r.stdIpd, 10)} px   ${p(r.stdAngle, 7, 3)}°   ` +
      `${p(r.faceMae, 8)}     ${p(r.msPerPhoto, 6, 0)}${r.failed ? `  (${r.failed} falliti)` : ''}`,
  )
}
console.log(
  `\n  Distanza interpupillare di destinazione: ${ref.targetIpd.toFixed(0)} px` +
    ` — media ottenuta: ${ref.meanIpd.toFixed(1)} px`,
)
console.log('  Montaggio salvato in', `${OUT}/alignment-proof.jpg`)

await browser.close()

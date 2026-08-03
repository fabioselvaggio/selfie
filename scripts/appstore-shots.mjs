/**
 * Genera le schermate per l'App Store, nella misura esatta che Apple richiede.
 *
 * App Store Connect vuole gli screenshot da 6,9 pollici: 1290 × 2796. Li
 * otteniamo mostrando l'app a 430 × 932 punti su uno schermo 3x, cioè
 * esattamente la geometria di un iPhone Pro Max — non un ridimensionamento.
 *
 * Le foto le metti tu: le tue, non c'è alternativa. Le schermate dell'App Store
 * devono mostrare l'app come si presenta davvero, e per un'app di selfie
 * significa la tua faccia.
 *
 * Uso:
 *   npm run dev                                   # in un altro terminale
 *   npm run appstore:shots -- ./cartella-con-le-mie-foto
 */
import { chromium } from 'playwright'
import { readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const SRC = process.argv[2]
const OUT = process.argv[3] || 'appstore'

if (!SRC) {
  console.error(`
  Serve una cartella con le tue foto:

    npm run appstore:shots -- ./mie-foto

  Bastano una decina di selfie di giorni diversi. La data viene letta dai
  metadati EXIF, quindi vanno bene le foto così come escono dal telefono.
`)
  process.exit(1)
}

const IMAGES = readdirSync(SRC)
  .filter((f) => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()))
  .sort()

if (!IMAGES.length) {
  console.error(`  Nessuna immagine trovata in ${SRC}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
console.log(`  ${IMAGES.length} foto da ${SRC}`)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
// 430 × 932 punti su schermo 3x = 1290 × 2796 pixel, la misura da 6,9".
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
})
const page = await context.newPage()
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// Le foto entrano dalla porta principale: stesso allineamento, stessa lettura
// della data, stessa qualità di quando le importi a mano.
const files = IMAGES.map((name) => ({
  name,
  data: readFileSync(join(SRC, name)).toString('base64'),
  type: extname(name).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
}))

const imported = await page.evaluate(async (files) => {
  const fa = await import('/src/lib/faceAlign.ts')
  const im = await import('/src/lib/image.ts')
  const db = await import('/src/lib/db.ts')
  const dates = await import('/src/lib/dates.ts')
  const exif = await import('/src/lib/exif.ts')

  await db.clearPhotos()
  let ok = 0
  const failed = []

  for (const f of files) {
    const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))
    const file = new File([bytes], f.name, { type: f.type })
    const { date } = await exif.readCaptureDate(file)
    const img = await im.loadImage(file)
    const out = await fa.alignImage(img, { mouthWeight: 0.2, refine: true })
    if (!out) {
      failed.push(f.name)
      continue
    }
    const day = dates.toDayKey(date, 4)
    await db.putPhoto({
      day,
      createdAt: date.getTime(),
      capturedAt: date.getTime(),
      origin: 'import',
      dateSource: 'exif',
      original: file,
      aligned: out.blob,
      align: {
        rotationDeg: out.result.rotationDeg,
        scale: out.result.scale,
        coverage: out.result.coverage,
        iris: out.result.geometry.iris,
        mouthWeight: 0.2,
      },
      adjust: fa.NO_ADJUST,
    })
    ok++
  }
  return { ok, failed }
}, files)

console.log(`  allineate ${imported.ok}/${files.length}`)
if (imported.failed.length) {
  console.log(`  volto non rilevato in: ${imported.failed.join(', ')}`)
}

await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const tab = (i) => page.locator('.tabbar .tab').nth(i).click()

const SHOTS = [
  ['1-oggi', async () => tab(0)],
  ['2-calendario', async () => tab(1)],
  [
    '3-video',
    async () => {
      await tab(2)
      await page.waitForTimeout(2500)
      // Un fotogramma a metà sequenza dice più del primo.
      await page.locator('.player-play').click().catch(() => {})
      await page.waitForTimeout(900)
      await page.locator('.btn.ghost').first().click()
    },
  ],
  ['4-traguardi', async () => tab(3)],
  [
    '5-allineamento',
    async () => {
      await tab(1)
      await page.locator('.cal-cell.filled').first().click()
      await page.waitForTimeout(700)
    },
  ],
]

for (const [name, run] of SHOTS) {
  try {
    await run()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`  → ${OUT}/${name}.png`)
  } catch (err) {
    console.log(`  ✗ ${name}: ${String(err).split('\n')[0].slice(0, 90)}`)
  }
}

const size = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
console.log(`\n  Misura: ${size.w * 3} × ${size.h * 3} px — la 6,9" richiesta da App Store Connect.`)
console.log('  Caricale in App Store Connect nella sezione "Anteprime e screenshot".\n')

await browser.close()

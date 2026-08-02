/**
 * Riempie l'app con selfie finti e cattura le schermate.
 *
 * Serve per vedere l'app popolata senza dover scattare davvero per due settimane:
 * partiamo da una foto sola e ne generiamo una variante per giorno, ognuna con
 * rotazione, zoom e traslazione diverse — cioè esattamente il tipo di scatto
 * sbilenco che l'allineamento deve raddrizzare.
 *
 * Uso:
 *   npm run dev
 *   CHROMIUM_PATH=/path/to/chromium node scripts/seed-and-shoot.mjs [cartella-output]
 */
import { chromium } from 'playwright'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'

const OUT = process.argv[2] || '.'

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
const page = await browser.newPage({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })

const seeded = await page.evaluate(async () => {
  const fa = await import('/src/lib/faceAlign.ts')
  const im = await import('/src/lib/image.ts')
  const db = await import('/src/lib/db.ts')
  const dates = await import('/src/lib/dates.ts')

  await db.clearPhotos()
  const src = await im.loadImage('/__test__/portrait.jpg')

  // Streak di 9 giorni fino a oggi, più qualche giorno sparso più indietro:
  // così il calendario ha buchi veri e il record non coincide con lo streak.
  const offsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 15, 19, 21, 22]
  const W = 900
  const H = 1200
  let done = 0

  for (const back of offsets) {
    const day = dates.addDays(dates.todayKey(0), -back)
    // Variazione deterministica per giorno: niente random, così le catture sono riproducibili.
    const rot = ((back * 37) % 17) - 8
    const zoom = 0.75 + (((back * 53) % 70) / 100)
    const dx = (((back * 29) % 17) - 8) / 100
    const dy = (((back * 41) % 15) - 7) / 100

    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#26221f'
    ctx.fillRect(0, 0, W, H)
    const base = Math.max(W / src.naturalWidth, H / src.naturalHeight)
    ctx.translate(W / 2, H / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.scale(base * zoom, base * zoom)
    ctx.translate(dx * src.naturalWidth, dy * src.naturalHeight)
    ctx.drawImage(src, -src.naturalWidth / 2, -src.naturalHeight / 2)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const out = await fa.alignImage(c, { mouthWeight: 0.2, refine: true })
    if (!out) continue
    const original = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
    const capturedAt = dates.fromDayKey(day).getTime() + 9 * 3600_000

    await db.putPhoto({
      day,
      createdAt: capturedAt,
      capturedAt,
      origin: back % 4 === 0 ? 'import' : 'camera',
      dateSource: 'exif',
      original,
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
    done++
  }
  return done
})

console.log(`  Popolati ${seeded} giorni.`)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const shots = [
  { name: '1-oggi', run: async () => {} },
  {
    name: '2-calendario',
    run: async () => {
      await page.getByRole('button', { name: 'Calendario' }).click()
    },
  },
  {
    name: '3-timelapse',
    run: async () => {
      await page.getByRole('button', { name: 'Video' }).click()
      await page.waitForTimeout(2500)
    },
  },
  {
    name: '4-traguardi',
    run: async () => {
      await page.getByRole('button', { name: 'Traguardi' }).click()
    },
  },
  {
    name: '5-dettaglio-giorno',
    run: async () => {
      await page.getByRole('button', { name: 'Calendario' }).click()
      await page.locator('.cal-cell.filled').first().click()
      await page.waitForTimeout(600)
    },
  },
  {
    name: '6-impostazioni',
    run: async () => {
      await page.keyboard.press('Escape')
      await page.locator('.sheet-head .icon-btn').first().click()
      await page.getByRole('button', { name: 'Impostazioni' }).click()
      await page.waitForTimeout(500)
    },
  },
]

for (const s of shots) {
  try {
    await s.run()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/screen-${s.name}.png` })
    console.log('  →', `screen-${s.name}.png`)
  } catch (err) {
    console.log('  ✗', s.name, String(err).split('\n')[0].slice(0, 120))
  }
}

await browser.close()

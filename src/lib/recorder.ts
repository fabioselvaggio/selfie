/**
 * Registrazione video del timelapse.
 *
 * Due cose non ci si può permettere di dare per buone.
 *
 * La prima: `MediaRecorder.isTypeSupported` dichiara `video/mp4` supportato
 * anche dove il muxer non funziona, e la registrazione esce con zero byte —
 * un file che si scarica, sembra a posto e non si apre. Quindi il formato lo
 * proviamo davvero prima di usarlo.
 *
 * La seconda: la prova va fatta **alla dimensione vera**. Un encoder H.264
 * software può cavarsela su un francobollo da 64px e piantarsi su una cornice
 * da 1200×1700 — è successo esattamente questo, e un probe su canvas piccolo
 * dava via libera a un formato che poi non registrava niente.
 *
 * Resta comunque una rete: se alla fine il file è vuoto, si riprova con il
 * formato successivo.
 *
 * L'ordine mette MP4 davanti a WebM anche dove funzionano entrambi: è l'unico
 * che iOS accetta in Foto e che si può mandare a qualcuno senza che riceva un
 * file che non si apre.
 */

const FORMATS = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

/** Estensione da dare al file, ricavata dal tipo reale del blob. */
export function extensionFor(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm'
}

export interface Recording {
  blob: Blob
  mimeType: string
}

/**
 * Registra un canvas mentre `drive` lo disegna. Restituisce null se il formato
 * non produce nulla su questo dispositivo.
 */
export async function recordCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string | undefined,
  drive: () => Promise<void>,
): Promise<Recording | null> {
  let stream: MediaStream
  let recorder: MediaRecorder
  try {
    stream = canvas.captureStream(30)
    recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined,
    )
  } catch {
    return null
  }

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }

  // Il chunk finale può arrivare dopo `onstop` a seconda dell'implementazione:
  // aspettiamo lo stop e poi lasciamo un attimo perché si depositi.
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => resolve()
  })

  try {
    recorder.start()
  } catch {
    stream.getTracks().forEach((t) => t.stop())
    return null
  }

  await drive()
  try {
    recorder.stop()
  } catch {
    /* già fermo */
  }
  await stopped
  await new Promise((r) => setTimeout(r, 120))
  stream.getTracks().forEach((t) => t.stop())

  const total = chunks.reduce((n, c) => n + c.size, 0)
  if (!total) return null

  // Il formato vero lo dice il recorder, non quello che gli abbiamo chiesto:
  // senza opzioni Safari sceglie MP4 per conto suo.
  const type = recorder.mimeType || mimeType || 'video/webm'
  return { blob: new Blob(chunks, { type }), mimeType: type }
}

/** Prova un formato registrando mezzo secondo alla dimensione reale di lavoro. */
async function probe(mimeType: string, width: number, height: number): Promise<boolean> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const out = await recordCanvas(canvas, mimeType, async () => {
    // Un contenuto che cambia: su un'immagine ferma certi encoder non emettono
    // nulla e il test darebbe un falso negativo.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#000' : '#fff'
      ctx.fillRect(0, 0, width, height)
      await new Promise((r) => setTimeout(r, 45))
    }
  })
  return out !== null
}

const cache = new Map<string, string | null>()

/** Il primo formato che registra davvero a questa dimensione. */
export async function pickVideoFormat(
  width: number,
  height: number,
): Promise<string | undefined> {
  if (typeof MediaRecorder === 'undefined') return undefined
  const key = `${width}x${height}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit ?? undefined

  for (const mime of FORMATS) {
    if (MediaRecorder.isTypeSupported && !MediaRecorder.isTypeSupported(mime)) continue
    if (await probe(mime, width, height)) {
      cache.set(key, mime)
      return mime
    }
  }
  cache.set(key, null)
  return undefined
}

/** Ordine di ripiego, se quello scelto fallisce comunque sul video vero. */
export function fallbacksAfter(mimeType: string | undefined): Array<string | undefined> {
  const rest = FORMATS.filter(
    (m) => m !== mimeType && (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(m)),
  )
  // L'ultimo tentativo è senza opzioni: lascia scegliere al browser.
  return [...rest, undefined]
}

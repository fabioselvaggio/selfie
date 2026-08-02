/**
 * Motore di allineamento.
 *
 * Idea: ogni selfie viene portato dentro una cornice fissa applicando una
 * trasformazione di similarità (rotazione + scala uniforme + traslazione, 4 gradi
 * di libertà) stimata ai minimi quadrati su tre punti del viso:
 *
 *   - centro dell'iride sinistra
 *   - centro dell'iride destra
 *   - centro della bocca
 *
 * I due occhi da soli determinano già esattamente la similarità. La bocca entra
 * con un peso configurabile: aiuta a stabilizzare quando la testa è inclinata
 * avanti/indietro, ma se pesa troppo "combatte" con gli occhi quando guardi in
 * basso. Da qui il parametro `mouthWeight`.
 *
 * Quello che non copriamo con l'immagine sorgente resta nero: nessun crop-to-fill.
 */

import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { downscaleFor } from './image'

// ---------------------------------------------------------------- costanti

/** Rapporto della cornice: 4:5 verticale, come nel riferimento. */
export const FRAME_RATIO = 4 / 5

/** Risoluzione di lavoro della cornice (px). */
export const FRAME_W = 900
export const FRAME_H = Math.round(FRAME_W / FRAME_RATIO) // 1125

/**
 * Distanza interpupillare di destinazione, come frazione della larghezza cornice.
 * 0.17 corrisponde a un mezzobusto: testa e spalle nell'inquadratura, come nelle
 * foto di riferimento. Alzarlo stringe sul viso e costringe a ingrandire di più,
 * il che ammorbidisce l'immagine.
 */
export const TARGET_IPD_RATIO = 0.17
/** Altezza della linea degli occhi, come frazione dell'altezza cornice. */
export const TARGET_EYE_Y = 0.4
/** Distanza occhi→bocca di destinazione, in multipli della distanza interpupillare. */
export const TARGET_MOUTH_DROP = 1.15

/**
 * Indici dei landmark nella face mesh a 478 punti di MediaPipe.
 * 468 e 473 sono i centri delle due iridi e sono i punti più stabili che abbiamo:
 * a differenza degli angoli dell'occhio non si spostano quando strizzi gli occhi.
 */
const IRIS_A = 468
const IRIS_B = 473
/** Fallback se il modello restituisce solo 468 punti (senza raffinamento iridi). */
const EYE_A_CORNERS = [33, 133]
const EYE_B_CORNERS = [362, 263]
/** Centro bocca: due angoli + centro labbro superiore/inferiore interno. */
const MOUTH_POINTS = [13, 14, 61, 291]

// ---------------------------------------------------------------- tipi

export interface Pt {
  x: number
  y: number
}

/** Matrice affine nella convenzione di CanvasRenderingContext2D.setTransform. */
export interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface FaceGeometry {
  leftEye: Pt
  rightEye: Pt
  mouth: Pt
  /** true se abbiamo usato i centri delle iridi (stima migliore). */
  iris: boolean
}

export interface AlignResult {
  matrix: Matrix
  /** Rotazione applicata, in gradi. Positivo = orario. */
  rotationDeg: number
  /** Fattore di scala applicato. >1 = l'app ha ingrandito. */
  scale: number
  /** Frazione della cornice effettivamente coperta dalla foto (0..1). Il resto è nero. */
  coverage: number
  geometry: FaceGeometry
}

export interface AlignOptions {
  /** Peso della bocca nel fit. 0 = solo occhi (fit esatto), 1 = pari agli occhi. */
  mouthWeight?: number
  frameW?: number
  frameH?: number
}

// ---------------------------------------------------------------- modello

let landmarkerPromise: Promise<FaceLandmarker> | null = null

/**
 * Carica il FaceLandmarker. wasm e modello sono serviti dal nostro dominio
 * (public/mp), quindi niente CDN esterna e funziona anche offline.
 */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks('/mp/wasm')
      const build = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/mp/models/face_landmarker.task', delegate },
          runningMode: 'IMAGE',
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
          outputFaceBlendshapes: false,
        })
      // Su macchine senza WebGL utilizzabile (o in headless) si ripiega su CPU.
      return build('GPU').catch(() => build('CPU'))
    })().catch((err) => {
      landmarkerPromise = null
      throw err
    })
  }
  return landmarkerPromise
}

/** Preriscalda il modello, così il primo scatto non aspetta i 4 MB di download. */
export function warmUpLandmarker(): void {
  void getLandmarker().catch(() => {
    /* l'errore viene ri-sollevato al primo uso reale */
  })
}

// ---------------------------------------------------------------- rilevamento

type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap

function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight }
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight }
  return { w: src.width, h: src.height }
}

function mean(landmarks: NormalizedLandmark[], idx: number[], w: number, h: number): Pt {
  let sx = 0
  let sy = 0
  for (const i of idx) {
    sx += landmarks[i].x
    sy += landmarks[i].y
  }
  return { x: (sx / idx.length) * w, y: (sy / idx.length) * h }
}

function toGeometry(landmarks: NormalizedLandmark[], w: number, h: number): FaceGeometry {
  const hasIris = landmarks.length > IRIS_B
  const a = hasIris
    ? { x: landmarks[IRIS_A].x * w, y: landmarks[IRIS_A].y * h }
    : mean(landmarks, EYE_A_CORNERS, w, h)
  const b = hasIris
    ? { x: landmarks[IRIS_B].x * w, y: landmarks[IRIS_B].y * h }
    : mean(landmarks, EYE_B_CORNERS, w, h)

  // Non ci fidiamo della convenzione left/right di MediaPipe (cambia con il mirroring
  // del selfie): ordiniamo per coordinata x nell'immagine.
  const [leftEye, rightEye] = a.x <= b.x ? [a, b] : [b, a]
  return { leftEye, rightEye, mouth: mean(landmarks, MOUTH_POINTS, w, h), iris: hasIris }
}

/** Riquadro che racchiude tutti i landmark, con padding, in pixel sorgente. */
function faceBox(landmarks: NormalizedLandmark[], w: number, h: number, pad: number) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of landmarks) {
    minX = Math.min(minX, p.x * w)
    minY = Math.min(minY, p.y * h)
    maxX = Math.max(maxX, p.x * w)
    maxY = Math.max(maxY, p.y * h)
  }
  const bw = maxX - minX
  const bh = maxY - minY
  const px = bw * pad
  const py = bh * pad
  return {
    x: Math.max(0, Math.floor(minX - px)),
    y: Math.max(0, Math.floor(minY - py)),
    w: Math.min(w, Math.ceil(maxX + px)) - Math.max(0, Math.floor(minX - px)),
    h: Math.min(h, Math.ceil(maxY + py)) - Math.max(0, Math.floor(minY - py)),
  }
}

let refineCanvas: HTMLCanvasElement | null = null

/**
 * Rileva la geometria del viso.
 *
 * Con `refine` facciamo due passate: la prima trova il viso, la seconda rifà il
 * rilevamento su un ritaglio ingrandito attorno al viso. Il modello lavora
 * internamente a 192x192, quindi dandogli un ritaglio invece della foto intera
 * gli mettiamo molti più pixel sulla faccia — la stima delle pupille diventa
 * sensibilmente più stabile, ed è la stabilità fra un giorno e l'altro a
 * decidere se il timelapse "trema" o no.
 */
export async function detectFace(src: Source, refine = true): Promise<FaceGeometry | null> {
  const landmarker = await getLandmarker()
  const { w, h } = sourceSize(src)
  if (!w || !h) return null

  const first = landmarker.detect(src as HTMLImageElement)
  const lm0 = first.faceLandmarks?.[0]
  if (!lm0) return null
  if (!refine) return toGeometry(lm0, w, h)

  const box = faceBox(lm0, w, h, 0.35)
  if (box.w < 24 || box.h < 24) return toGeometry(lm0, w, h)

  // Ritaglio portato a ~512px sul lato lungo: oltre non guadagniamo nulla.
  const target = 512
  const k = Math.min(target / Math.max(box.w, box.h), 4)
  const cw = Math.max(64, Math.round(box.w * k))
  const ch = Math.max(64, Math.round(box.h * k))

  if (!refineCanvas) refineCanvas = document.createElement('canvas')
  refineCanvas.width = cw
  refineCanvas.height = ch
  const ctx = refineCanvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) return toGeometry(lm0, w, h)
  ctx.drawImage(src as CanvasImageSource, box.x, box.y, box.w, box.h, 0, 0, cw, ch)

  const second = landmarker.detect(refineCanvas)
  const lm1 = second.faceLandmarks?.[0]
  if (!lm1) return toGeometry(lm0, w, h)

  // Riporta i landmark del ritaglio nello spazio dell'immagine originale.
  const remapped = lm1.map((p) => ({
    ...p,
    x: (box.x + p.x * box.w) / w,
    y: (box.y + p.y * box.h) / h,
  })) as NormalizedLandmark[]
  return toGeometry(remapped, w, h)
}

// ---------------------------------------------------------------- matematica

/**
 * Similarità ai minimi quadrati pesati (forma chiusa 2D di Horn).
 * Trova s, θ, t che minimizzano Σ wᵢ‖ s·R(θ)·pᵢ + t − qᵢ ‖².
 */
export function weightedSimilarity(src: Pt[], dst: Pt[], weights: number[]): Matrix {
  const W = weights.reduce((s, x) => s + x, 0)
  const pc = { x: 0, y: 0 }
  const qc = { x: 0, y: 0 }
  for (let i = 0; i < src.length; i++) {
    pc.x += weights[i] * src[i].x
    pc.y += weights[i] * src[i].y
    qc.x += weights[i] * dst[i].x
    qc.y += weights[i] * dst[i].y
  }
  pc.x /= W
  pc.y /= W
  qc.x /= W
  qc.y /= W

  let numCos = 0
  let numSin = 0
  let den = 0
  for (let i = 0; i < src.length; i++) {
    const ax = src[i].x - pc.x
    const ay = src[i].y - pc.y
    const bx = dst[i].x - qc.x
    const by = dst[i].y - qc.y
    numCos += weights[i] * (ax * bx + ay * by)
    numSin += weights[i] * (ax * by - ay * bx)
    den += weights[i] * (ax * ax + ay * ay)
  }
  if (den === 0) return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

  const scaleCos = numCos / den
  const scaleSin = numSin / den
  return {
    a: scaleCos,
    b: scaleSin,
    c: -scaleSin,
    d: scaleCos,
    e: qc.x - (scaleCos * pc.x - scaleSin * pc.y),
    f: qc.y - (scaleSin * pc.x + scaleCos * pc.y),
  }
}

/** Punti di destinazione dentro la cornice. */
export function frameTargets(frameW = FRAME_W, frameH = FRAME_H): [Pt, Pt, Pt] {
  const ipd = TARGET_IPD_RATIO * frameW
  const eyeY = TARGET_EYE_Y * frameH
  return [
    { x: frameW / 2 - ipd / 2, y: eyeY },
    { x: frameW / 2 + ipd / 2, y: eyeY },
    { x: frameW / 2, y: eyeY + TARGET_MOUTH_DROP * ipd },
  ]
}

/** Ritaglio di un poligono convesso contro un rettangolo (Sutherland–Hodgman). */
function clipToRect(poly: Pt[], w: number, h: number): Pt[] {
  const edges: Array<(p: Pt) => boolean> = [
    (p) => p.x >= 0,
    (p) => p.x <= w,
    (p) => p.y >= 0,
    (p) => p.y <= h,
  ]
  const cut: Array<(a: Pt, b: Pt) => Pt> = [
    (a, b) => ({ x: 0, y: a.y + ((b.y - a.y) * (0 - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: w, y: a.y + ((b.y - a.y) * (w - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (0 - a.y)) / (b.y - a.y), y: 0 }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (h - a.y)) / (b.y - a.y), y: h }),
  ]

  let out = poly
  for (let e = 0; e < 4; e++) {
    const input = out
    out = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      const curIn = edges[e](cur)
      const prevIn = edges[e](prev)
      if (curIn) {
        if (!prevIn) out.push(cut[e](prev, cur))
        out.push(cur)
      } else if (prevIn) {
        out.push(cut[e](prev, cur))
      }
    }
    if (out.length === 0) return []
  }
  return out
}

function polygonArea(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

function applyMatrix(m: Matrix, p: Pt): Pt {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

/** Quanta parte della cornice viene realmente coperta dalla foto (il resto è nero). */
export function coverageOf(m: Matrix, srcW: number, srcH: number, frameW: number, frameH: number) {
  const corners: Pt[] = [
    { x: 0, y: 0 },
    { x: srcW, y: 0 },
    { x: srcW, y: srcH },
    { x: 0, y: srcH },
  ].map((p) => applyMatrix(m, p))
  const clipped = clipToRect(corners, frameW, frameH)
  if (clipped.length < 3) return 0
  return Math.min(1, polygonArea(clipped) / (frameW * frameH))
}

/** Calcola la trasformazione che porta questo viso dentro la cornice. */
export function alignmentFor(
  geometry: FaceGeometry,
  srcW: number,
  srcH: number,
  opts: AlignOptions = {},
): AlignResult {
  const frameW = opts.frameW ?? FRAME_W
  const frameH = opts.frameH ?? FRAME_H
  const mouthWeight = opts.mouthWeight ?? 0.35

  const targets = frameTargets(frameW, frameH)
  const matrix = weightedSimilarity(
    [geometry.leftEye, geometry.rightEye, geometry.mouth],
    targets,
    [1, 1, mouthWeight],
  )

  return {
    matrix,
    rotationDeg: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
    scale: Math.hypot(matrix.a, matrix.b),
    coverage: coverageOf(matrix, srcW, srcH, frameW, frameH),
    geometry,
  }
}

/** Composizione: prima la similarità, poi un ritocco manuale attorno al centro cornice. */
export interface ManualAdjust {
  /** Gradi aggiuntivi, orario positivo. */
  rotate: number
  /** Moltiplicatore di zoom aggiuntivo. */
  zoom: number
  /** Spostamento in frazioni della larghezza/altezza cornice. */
  dx: number
  dy: number
}

export const NO_ADJUST: ManualAdjust = { rotate: 0, zoom: 1, dx: 0, dy: 0 }

export function withManualAdjust(
  m: Matrix,
  adj: ManualAdjust,
  frameW = FRAME_W,
  frameH = FRAME_H,
): Matrix {
  const rad = (adj.rotate * Math.PI) / 180
  const cos = Math.cos(rad) * adj.zoom
  const sin = Math.sin(rad) * adj.zoom
  const cx = frameW / 2
  const cy = frameH / 2
  // Trasformazione esterna T: ruota+scala attorno al centro, poi trasla.
  const t = {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - (cos * cx - sin * cy) + adj.dx * frameW,
    f: cy - (sin * cx + cos * cy) + adj.dy * frameH,
  }
  // Composizione T ∘ m
  return {
    a: t.a * m.a + t.c * m.b,
    b: t.b * m.a + t.d * m.b,
    c: t.a * m.c + t.c * m.d,
    d: t.b * m.c + t.d * m.d,
    e: t.a * m.e + t.c * m.f + t.e,
    f: t.b * m.e + t.d * m.f + t.f,
  }
}

// ---------------------------------------------------------------- rendering

/** Disegna la sorgente allineata dentro la cornice. Ciò che non copre resta nero. */
export function renderAligned(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  m: Matrix,
  frameW = FRAME_W,
  frameH = FRAME_H,
): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, frameW, frameH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f)
  ctx.drawImage(src, 0, 0)
  ctx.restore()
}

export interface AlignedPhoto {
  blob: Blob
  result: AlignResult
}

/** Pipeline completa: rileva → calcola → renderizza → PNG/JPEG. */
export async function alignImage(
  src: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  opts: AlignOptions & { adjust?: ManualAdjust; refine?: boolean } = {},
): Promise<AlignedPhoto | null> {
  const frameW = opts.frameW ?? FRAME_W
  const frameH = opts.frameH ?? FRAME_H
  const { w, h } = sourceSize(src)

  const geometry = await detectFace(src, opts.refine ?? true)
  if (!geometry) return null

  const result = alignmentFor(geometry, w, h, { ...opts, frameW, frameH })
  const matrix = opts.adjust ? withManualAdjust(result.matrix, opts.adjust, frameW, frameH) : result.matrix

  const canvas = document.createElement('canvas')
  canvas.width = frameW
  canvas.height = frameH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Se stiamo rimpicciolendo parecchio (foto da 12 MP dentro una cornice da 900px)
  // pre-riduciamo a metà a più riprese, altrimenti drawImage fa aliasing.
  const { source, factor } = downscaleFor(src as CanvasImageSource, w, h, Math.hypot(matrix.a, matrix.b))
  const drawMatrix: Matrix =
    factor === 1
      ? matrix
      : {
          a: matrix.a / factor,
          b: matrix.b / factor,
          c: matrix.c / factor,
          d: matrix.d / factor,
          e: matrix.e,
          f: matrix.f,
        }
  renderAligned(ctx, source, drawMatrix, frameW, frameH)

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
  if (!blob) return null

  return {
    blob,
    result: {
      ...result,
      matrix,
      rotationDeg: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
      scale: Math.hypot(matrix.a, matrix.b),
      coverage: coverageOf(matrix, w, h, frameW, frameH),
    },
  }
}

// ---------------------------------------------------------------- guida live

export type GuideVerdict = 'no-face' | 'too-far' | 'too-close' | 'tilted' | 'off-center' | 'ok'

export interface GuideState {
  verdict: GuideVerdict
  hint: string
  geometry: FaceGeometry | null
}

const HINTS: Record<GuideVerdict, string> = {
  'no-face': 'Inquadra il viso',
  'too-far': 'Avvicinati un po’',
  'too-close': 'Allontanati un po’',
  tilted: 'Raddrizza la testa',
  'off-center': 'Centra il viso',
  ok: 'Perfetto, non ti muovere',
}

/**
 * Valuta l'inquadratura live. Le soglie sono volutamente larghe: l'allineamento
 * vero lo fa comunque l'algoritmo dopo, la guida serve solo a non farti scattare
 * una foto così storta da perdere mezza cornice in bande nere.
 */
export function evaluateGuide(geometry: FaceGeometry | null, w: number, h: number): GuideState {
  if (!geometry) return { verdict: 'no-face', hint: HINTS['no-face'], geometry: null }

  const ipd = Math.hypot(
    geometry.rightEye.x - geometry.leftEye.x,
    geometry.rightEye.y - geometry.leftEye.y,
  )
  const ipdRatio = ipd / w
  const angle = Math.abs(
    (Math.atan2(geometry.rightEye.y - geometry.leftEye.y, geometry.rightEye.x - geometry.leftEye.x) *
      180) /
      Math.PI,
  )
  const midX = (geometry.leftEye.x + geometry.rightEye.x) / 2 / w
  const midY = (geometry.leftEye.y + geometry.rightEye.y) / 2 / h

  let verdict: GuideVerdict = 'ok'
  if (ipdRatio < TARGET_IPD_RATIO * 0.62) verdict = 'too-far'
  else if (ipdRatio > TARGET_IPD_RATIO * 1.7) verdict = 'too-close'
  else if (angle > 9) verdict = 'tilted'
  else if (Math.abs(midX - 0.5) > 0.16 || Math.abs(midY - TARGET_EYE_Y) > 0.16) verdict = 'off-center'

  return { verdict, hint: HINTS[verdict], geometry }
}

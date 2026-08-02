import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FRAME_H,
  FRAME_W,
  NO_ADJUST,
  coverageOf,
  frameTargets,
  renderAligned,
  withManualAdjust,
  type ManualAdjust,
  type Matrix,
} from '../lib/faceAlign'
import { canvasToBlob, loadImage } from '../lib/image'
import { formatDay } from '../lib/dates'
import type { PendingShot } from '../store'
import { IconClose, IconRetry } from '../components/icons'

/** Similarità → (scala, angolo, traslazione), per poterle interpolare. */
function decompose(m: Matrix) {
  return { s: Math.hypot(m.a, m.b), r: Math.atan2(m.b, m.a), e: m.e, f: m.f }
}

function compose(s: number, r: number, e: number, f: number): Matrix {
  const c = Math.cos(r) * s
  const d = Math.sin(r) * s
  return { a: c, b: d, c: -d, d: c, e, f }
}

/** Matrice "senza allineamento": la foto grezza semplicemente contenuta nella cornice. */
function containMatrix(w: number, h: number): Matrix {
  const s = Math.min(FRAME_W / w, FRAME_H / h)
  return { a: s, b: 0, c: 0, d: s, e: (FRAME_W - w * s) / 2, f: (FRAME_H - h * s) / 2 }
}

function lerpMatrix(from: Matrix, to: Matrix, t: number): Matrix {
  const A = decompose(from)
  const B = decompose(to)
  // La scala si interpola in spazio logaritmico, altrimenti lo zoom "scatta".
  const s = Math.exp(Math.log(A.s) + (Math.log(B.s) - Math.log(A.s)) * t)
  let dr = B.r - A.r
  while (dr > Math.PI) dr -= 2 * Math.PI
  while (dr < -Math.PI) dr += 2 * Math.PI
  return compose(s, A.r + dr * t, A.e + (B.e - A.e) * t, A.f + (B.f - A.f) * t)
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function AlignSheet({
  shot,
  onCancel,
  onRetry,
  onSave,
}: {
  shot: PendingShot
  onCancel: () => void
  onRetry?: () => void
  onSave: (shot: PendingShot) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [rawUrl, setRawUrl] = useState<string>('')
  const [adjust, setAdjust] = useState<ManualAdjust>(shot.adjust ?? NO_ADJUST)
  const [tweaking, setTweaking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imgReady, setImgReady] = useState(false)

  const base = shot.result

  useEffect(() => {
    const url = URL.createObjectURL(shot.original)
    setRawUrl(url)
    let alive = true
    loadImage(shot.original)
      .then((img) => {
        if (!alive) return
        imgRef.current = img
        setImgReady(true)
      })
      .catch(() => setImgReady(false))
    return () => {
      alive = false
      URL.revokeObjectURL(url)
    }
  }, [shot.original])

  const finalMatrix = useMemo(
    () => (base ? withManualAdjust(base.matrix, adjust) : null),
    [base, adjust],
  )

  /** Disegna un fotogramma dell'animazione, con i marker su occhi e bocca. */
  const draw = useCallback(
    (matrix: Matrix, markerT: number) => {
      const canvas = canvasRef.current
      const img = imgRef.current
      if (!canvas || !img || !base) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      renderAligned(ctx, img, matrix, FRAME_W, FRAME_H)

      if (markerT >= 1) return
      const pts = [base.geometry.leftEye, base.geometry.rightEye, base.geometry.mouth]
      const targets = frameTargets()
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1 - markerT
      targets.forEach((tg, i) => {
        const p = pts[i]
        const cur = { x: matrix.a * p.x + matrix.c * p.y + matrix.e, y: matrix.b * p.x + matrix.d * p.y + matrix.f }
        ctx.strokeStyle = i === 2 ? '#4C6FFF' : '#FF6B35'
        ctx.lineWidth = 5

        ctx.beginPath()
        ctx.arc(cur.x, cur.y, 16, 0, Math.PI * 2)
        ctx.stroke()

        ctx.setLineDash([10, 10])
        ctx.globalAlpha = (1 - markerT) * 0.55
        ctx.beginPath()
        ctx.moveTo(cur.x, cur.y)
        ctx.lineTo(tg.x, tg.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1 - markerT

        ctx.beginPath()
        ctx.moveTo(tg.x - 20, tg.y)
        ctx.lineTo(tg.x + 20, tg.y)
        ctx.moveTo(tg.x, tg.y - 20)
        ctx.lineTo(tg.x, tg.y + 20)
        ctx.stroke()
      })
      ctx.restore()
    },
    [base],
  )

  /** L'animazione centrale: la foto grezza che si incastra nella cornice. */
  const play = useCallback(() => {
    const img = imgRef.current
    if (!img || !finalMatrix) return
    const from = containMatrix(img.naturalWidth, img.naturalHeight)
    const start = performance.now()
    const DURATION = 1100

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const e = easeOut(t)
      draw(lerpMatrix(from, finalMatrix, e), Math.max(0, (e - 0.72) / 0.28))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [draw, finalMatrix])

  useEffect(() => {
    if (!imgReady || !finalMatrix) return
    if (tweaking) draw(finalMatrix, 1)
    else play()
  }, [imgReady, finalMatrix, tweaking, draw, play])

  const coverage = useMemo(() => {
    const img = imgRef.current
    if (!img || !finalMatrix) return base?.coverage ?? 0
    return coverageOf(finalMatrix, img.naturalWidth, img.naturalHeight, FRAME_W, FRAME_H)
  }, [finalMatrix, base, imgReady])

  const save = async () => {
    const canvas = canvasRef.current
    if (!canvas || !base || !finalMatrix) return
    setSaving(true)
    try {
      // Ridisegna pulito (senza marker) prima di esportare.
      draw(finalMatrix, 1)
      const blob = await canvasToBlob(canvas)
      onSave({
        ...shot,
        aligned: blob,
        adjust,
        result: {
          ...base,
          matrix: finalMatrix,
          rotationDeg: (Math.atan2(finalMatrix.b, finalMatrix.a) * 180) / Math.PI,
          scale: Math.hypot(finalMatrix.a, finalMatrix.b),
          coverage,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  if (shot.failed || !base) {
    return (
      <div className="sheet">
        <div className="sheet-head">
          <button className="icon-btn" onClick={onCancel} aria-label="Chiudi">
            <IconClose />
          </button>
          <strong style={{ fontSize: 15 }}>Allineamento</strong>
          <span style={{ width: 34 }} />
        </div>
        <div className="screen">
          <div className="raw-box">{rawUrl && <img src={rawUrl} alt="" />}</div>
          <div className="pill-warn">
            Non ho trovato il viso in questa foto. Può succedere con luce molto bassa, occhiali da
            sole o il viso troppo di lato. Riprova, oppure salvala così com’è: resterà nel
            calendario ma fuori dal timelapse allineato.
          </div>
        </div>
        <div className="sheet-foot">
          {onRetry && (
            <button className="btn" onClick={onRetry}>
              Riprova
            </button>
          )}
          <button className="btn ghost" onClick={onCancel}>
            Annulla
          </button>
        </div>
      </div>
    )
  }

  const rot = (Math.atan2(finalMatrix!.b, finalMatrix!.a) * 180) / Math.PI
  const zoom = Math.hypot(finalMatrix!.a, finalMatrix!.b)

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="icon-btn" onClick={onCancel} aria-label="Chiudi">
          <IconClose />
        </button>
        <strong style={{ fontSize: 15 }}>{formatDay(shot.day)}</strong>
        <button className="icon-btn" onClick={play} aria-label="Rivedi animazione">
          <IconRetry />
        </button>
      </div>

      <div className="screen">
        <div className="compare">
          <div>
            <div className="compare-label">Scatto grezzo</div>
            <div className="raw-box">{rawUrl && <img src={rawUrl} alt="Scatto originale" />}</div>
          </div>
          <div>
            <div className="compare-label">Allineato</div>
            <div className="frame" style={{ padding: 0, borderRadius: 18 }}>
              <div className="frame-photo" style={{ borderRadius: 18 }}>
                <canvas ref={canvasRef} width={FRAME_W} height={FRAME_H} />
              </div>
            </div>
          </div>
        </div>

        <div className="metrics">
          <span className="metric">
            rotazione {rot >= 0 ? '+' : '−'}
            {Math.abs(rot).toFixed(1)}°
          </span>
          <span className="metric">zoom {zoom.toFixed(2)}×</span>
          <span className={coverage < 0.9 ? 'metric warn' : 'metric'}>
            cornice piena {(coverage * 100).toFixed(0)}%
          </span>
          <span className="metric">{base.geometry.iris ? 'pupille' : 'stima occhi'}</span>
        </div>

        {coverage < 0.85 && (
          <div className="pill-warn">
            Questo scatto lascia scoperto il {(100 - coverage * 100).toFixed(0)}% della cornice: era
            troppo ravvicinato o troppo storto. Va bene lo stesso, ma nel timelapse vedrai le bande
            nere.
          </div>
        )}

        <details onToggle={(e) => setTweaking((e.target as HTMLDetailsElement).open)}>
          <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 14, padding: '6px 0' }}>
            Ritocca a mano
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
            <div className="slider-row">
              <label>Rotazione</label>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={adjust.rotate}
                onChange={(e) => setAdjust((a) => ({ ...a, rotate: +e.target.value }))}
              />
              <span className="mono" style={{ width: 46, textAlign: 'right', fontSize: 12 }}>
                {adjust.rotate.toFixed(1)}°
              </span>
            </div>
            <div className="slider-row">
              <label>Zoom</label>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.01}
                value={adjust.zoom}
                onChange={(e) => setAdjust((a) => ({ ...a, zoom: +e.target.value }))}
              />
              <span className="mono" style={{ width: 46, textAlign: 'right', fontSize: 12 }}>
                {adjust.zoom.toFixed(2)}×
              </span>
            </div>
            <div className="slider-row">
              <label>Orizz.</label>
              <input
                type="range"
                min={-0.25}
                max={0.25}
                step={0.005}
                value={adjust.dx}
                onChange={(e) => setAdjust((a) => ({ ...a, dx: +e.target.value }))}
              />
              <span style={{ width: 46 }} />
            </div>
            <div className="slider-row">
              <label>Vert.</label>
              <input
                type="range"
                min={-0.25}
                max={0.25}
                step={0.005}
                value={adjust.dy}
                onChange={(e) => setAdjust((a) => ({ ...a, dy: +e.target.value }))}
              />
              <span style={{ width: 46 }} />
            </div>
            <button className="btn-link" onClick={() => setAdjust(NO_ADJUST)}>
              Azzera il ritocco
            </button>
          </div>
        </details>
      </div>

      <div className="sheet-foot">
        <button className="btn success" onClick={save} disabled={saving}>
          {saving ? 'Salvo…' : 'Salva'}
        </button>
        {onRetry && (
          <button className="btn ghost" onClick={onRetry}>
            Riprova
          </button>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FRAME_H, FRAME_W } from '../lib/faceAlign'
import { addDays, formatDay } from '../lib/dates'
import { loadImage } from '../lib/image'
import { useStore } from '../store'
import { IconExport, IconPause, IconPlay, IconVideo } from '../components/icons'

const SPEEDS = [
  { label: 'Lento', fps: 4 },
  { label: 'Normale', fps: 8 },
  { label: 'Veloce', fps: 16 },
]

const RANGES = [
  { label: 'Tutto', days: Infinity },
  { label: 'Mese', days: 30 },
  { label: 'Settimana', days: 7 },
]

const STRIP_H = 150

export function TimelapseScreen() {
  const { photos, settings, today } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const [speed, setSpeed] = useState(1)
  const [range, setRange] = useState(0)
  const [aligned, setAligned] = useState(true)
  const [showDate, setShowDate] = useState(settings.showDateOnPhoto)
  const [playing, setPlaying] = useState(true)
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [recording, setRecording] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const frames = useMemo(() => {
    const limit = RANGES[range].days
    if (limit === Infinity) return photos
    const from = addDays(today, -limit + 1)
    return photos.filter((p) => p.day >= from)
  }, [photos, range, today])

  const height = FRAME_H + (showDate ? STRIP_H : 0)

  // Carica le immagini della sequenza. In modalità "grezzo" usiamo gli originali:
  // è il confronto che dimostra a cosa serve tutto il resto dell'app.
  useEffect(() => {
    let alive = true
    const cache = imagesRef.current
    setLoaded(0)
    let done = 0
    const wanted = frames.map((p) => ({ key: `${aligned ? 'a' : 'r'}:${p.day}`, blob: aligned ? p.aligned : p.original }))
    for (const { key, blob } of wanted) {
      if (cache.has(key)) {
        done++
        setLoaded(done)
        continue
      }
      void loadImage(blob)
        .then((img) => {
          if (!alive) return
          cache.set(key, img)
        })
        .catch(() => {})
        .finally(() => {
          if (!alive) return
          done++
          setLoaded(done)
        })
    }
    return () => {
      alive = false
    }
  }, [frames, aligned])

  const drawFrame = useCallback(
    (i: number) => {
      const canvas = canvasRef.current
      if (!canvas || frames.length === 0) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const photo = frames[Math.min(i, frames.length - 1)]
      const img = imagesRef.current.get(`${aligned ? 'a' : 'r'}:${photo.day}`)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, FRAME_W, height)

      if (img) {
        if (aligned) {
          ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H)
        } else {
          // Senza allineamento: la foto viene solo contenuta nella cornice.
          const s = Math.min(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight)
          const w = img.naturalWidth * s
          const h = img.naturalHeight * s
          ctx.drawImage(img, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h)
        }
      }

      if (showDate) {
        ctx.fillStyle = '#fff'
        ctx.font = '900 68px Nunito, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatDay(photo.day), FRAME_W / 2, FRAME_H + STRIP_H / 2)
      }
    },
    [frames, aligned, showDate, height],
  )

  // Riproduzione.
  useEffect(() => {
    if (!playing || frames.length === 0) return
    const ms = 1000 / SPEEDS[speed].fps
    const id = window.setInterval(() => setIndex((i) => (i + 1) % frames.length), ms)
    return () => window.clearInterval(id)
  }, [playing, speed, frames.length])

  useEffect(() => {
    drawFrame(index)
  }, [index, drawFrame, loaded])

  useEffect(() => {
    setIndex(0)
  }, [range, aligned])

  const exportVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas || frames.length === 0) return
    setRecording(true)
    setPlaying(false)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)

    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m),
    )
    const stream = canvas.captureStream(30)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined)
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime ?? 'video/webm' })
        setVideoUrl(URL.createObjectURL(blob))
        resolve()
      }
    })

    recorder.start()
    const ms = 1000 / SPEEDS[speed].fps
    for (let i = 0; i < frames.length; i++) {
      setIndex(i)
      drawFrame(i)
      await new Promise((r) => setTimeout(r, ms))
    }
    // Un attimo in più, altrimenti l'ultimo fotogramma può non entrare nel file.
    await new Promise((r) => setTimeout(r, 300))
    recorder.stop()
    stream.getTracks().forEach((t) => t.stop())
    await finished
    setRecording(false)
  }

  if (photos.length === 0) {
    return (
      <div className="screen">
        <div className="empty-state">
          <IconVideo style={{ width: 56, height: 56, color: 'var(--ink-faint)' }} />
          <h2>Ancora niente da montare</h2>
          <p>Scatta qualche selfie, o importane un po’ dalla galleria. Poi torna qui.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="player">
        <canvas
          ref={canvasRef}
          width={FRAME_W}
          height={height}
          style={{ aspectRatio: `${FRAME_W} / ${height}` }}
          onClick={() => setPlaying((p) => !p)}
        />
        {loaded < frames.length && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontSize: 13,
            }}
          >
            <div className="spinner" />
          </div>
        )}
      </div>

      <div className="btn-row">
        <button className="btn ghost small" style={{ flex: 1 }} onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPause className="inline-icon" /> : <IconPlay className="inline-icon" />}
          {playing ? 'Pausa' : 'Play'}
        </button>
        <button className="btn ghost small" style={{ flex: 1 }} onClick={() => setAligned((a) => !a)}>
          {aligned ? 'Vedi grezzo' : 'Vedi allineato'}
        </button>
      </div>

      {!aligned && (
        <div className="pill-warn">
          Stai vedendo gli scatti originali, senza allineamento. È il confronto che serve: la faccia
          salta ovunque.
        </div>
      )}

      <div>
        <div className="muted" style={{ marginBottom: 6 }}>
          VELOCITÀ
        </div>
        <div className="seg">
          {SPEEDS.map((s, i) => (
            <button key={s.label} className={i === speed ? 'on' : ''} onClick={() => setSpeed(i)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 6 }}>
          INTERVALLO
        </div>
        <div className="seg">
          {RANGES.map((r, i) => (
            <button key={r.label} className={i === range ? 'on' : ''} onClick={() => setRange(i)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <div>
          <div className="row-label">Mostra la data</div>
          <div className="row-sub">Sovrimpressa sotto la foto, come nella cornice.</div>
        </div>
        <button
          className={showDate ? 'switch on' : 'switch'}
          onClick={() => setShowDate((v) => !v)}
          aria-label="Mostra la data"
        />
      </div>

      <div className="muted">
        {frames.length} {frames.length === 1 ? 'fotogramma' : 'fotogrammi'} ·{' '}
        {(frames.length / SPEEDS[speed].fps).toFixed(1)}s di video
      </div>

      <button className="btn" onClick={exportVideo} disabled={recording || loaded < frames.length}>
        {!recording && <IconExport className="inline-icon" />}
        {recording ? 'Registro…' : 'Esporta video'}
      </button>

      {videoUrl && (
        <a
          className="btn success"
          href={videoUrl}
          download={`oggi-timelapse-${today}.webm`}
          style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
        >
          Scarica il video
        </a>
      )}
    </div>
  )
}

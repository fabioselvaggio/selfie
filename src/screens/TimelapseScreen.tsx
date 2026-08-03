import { useCallback, useEffect, useRef, useState } from 'react'
import { FRAME_H, FRAME_W } from '../lib/faceAlign'
import { formatDay } from '../lib/dates'
import { loadImage } from '../lib/image'
import { useStore } from '../store'
import { IconExport, IconPause, IconPlay, IconVideo } from '../components/icons'

const SPEEDS = [
  { label: 'Lento', fps: 4 },
  { label: 'Normale', fps: 8 },
  { label: 'Veloce', fps: 16 },
]

/** Altezza della fascia con la data sotto la foto. */
const STRIP_H = 150

export function TimelapseScreen() {
  const { photos, settings, today } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const [speed, setSpeed] = useState(1)
  const [showDate, setShowDate] = useState(settings.showDateOnPhoto)
  // Fermo all'apertura: arrivare su una schermata dove qualcosa già si muove
  // toglie il controllo, e il primo fotogramma dice già tutto.
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [recording, setRecording] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const height = FRAME_H + (showDate ? STRIP_H : 0)

  useEffect(() => {
    let alive = true
    const cache = imagesRef.current
    setLoaded(0)
    let done = 0
    for (const photo of photos) {
      if (cache.has(photo.day)) {
        done++
        setLoaded(done)
        continue
      }
      void loadImage(photo.aligned)
        .then((img) => {
          if (alive) cache.set(photo.day, img)
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
  }, [photos])

  const drawFrame = useCallback(
    (i: number) => {
      const canvas = canvasRef.current
      if (!canvas || photos.length === 0) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const photo = photos[Math.min(i, photos.length - 1)]
      const img = imagesRef.current.get(photo.day)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, FRAME_W, height)
      if (img) ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H)

      if (showDate) {
        ctx.fillStyle = '#fff'
        ctx.font = '900 68px Nunito, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatDay(photo.day), FRAME_W / 2, FRAME_H + STRIP_H / 2)
      }
    },
    [photos, showDate, height],
  )

  useEffect(() => {
    if (!playing || photos.length === 0) return
    const ms = 1000 / SPEEDS[speed].fps
    const id = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), ms)
    return () => window.clearInterval(id)
  }, [playing, speed, photos.length])

  useEffect(() => {
    drawFrame(index)
  }, [index, drawFrame, loaded])

  const exportVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas || photos.length === 0) return
    setRecording(true)
    setPlaying(false)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)

    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m),
    )
    const stream = canvas.captureStream(30)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined,
    )
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
    for (let i = 0; i < photos.length; i++) {
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
        {loaded < photos.length ? (
          <div className="player-loading">
            <div className="spinner" />
          </div>
        ) : (
          !playing && (
            <button
              className="player-play"
              onClick={() => setPlaying(true)}
              aria-label="Riproduci"
            >
              <IconPlay />
            </button>
          )
        )}
      </div>

      <button className="btn ghost small" onClick={() => setPlaying((p) => !p)}>
        {playing ? <IconPause className="inline-icon" /> : <IconPlay className="inline-icon" />}
        {playing ? 'Pausa' : 'Play'}
      </button>

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
        {photos.length} {photos.length === 1 ? 'fotogramma' : 'fotogrammi'} ·{' '}
        {(photos.length / SPEEDS[speed].fps).toFixed(1)}s di video
      </div>

      <button className="btn" onClick={exportVideo} disabled={recording || loaded < photos.length}>
        {!recording && <IconExport className="inline-icon" />}
        {recording ? 'Registro…' : 'Esporta video'}
      </button>

      {videoUrl && (
        <a
          className="btn success"
          href={videoUrl}
          download={`oggi-timelapse-${today}.webm`}
          style={{ textDecoration: 'none' }}
        >
          Scarica il video
        </a>
      )}
    </div>
  )
}

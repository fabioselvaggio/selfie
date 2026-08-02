import { useEffect, useRef, useState } from 'react'
import { TARGET_EYE_Y, detectFace, evaluateGuide, type GuideState } from '../lib/faceAlign'

/**
 * Fotocamera con guida live.
 *
 * Le soglie della guida sono larghe di proposito: l'allineamento vero lo fa
 * l'algoritmo dopo lo scatto. La guida serve solo a evitare le foto così storte
 * o ravvicinate da lasciare mezza cornice nera.
 */
export function CameraSheet({
  onClose,
  onCapture,
}: {
  onClose: () => void
  onCapture: (blob: Blob) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guide, setGuide] = useState<GuideState>({ verdict: 'no-face', hint: 'Avvio fotocamera…', geometry: null })
  const [countdown, setCountdown] = useState<number | null>(null)
  const [useTimer, setUseTimer] = useState(false)

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1920 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Non riesco ad accedere alla fotocamera. Concedi il permesso, oppure importa una foto dalla galleria.',
          )
        }
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Loop della guida: ~8 rilevamenti al secondo, senza raffinamento (deve
  // essere veloce, la precisione serve dopo lo scatto).
  useEffect(() => {
    if (error) return
    let raf = 0
    let last = 0
    let busy = false

    const tick = async (t: number) => {
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
      if (!video || video.readyState < 2 || busy || t - last < 120) return
      last = t
      busy = true
      try {
        const geometry = await detectFace(video, false)
        setGuide(evaluateGuide(geometry, video.videoWidth, video.videoHeight))
      } catch {
        /* il modello può non essere ancora pronto: riproviamo al frame dopo */
      } finally {
        busy = false
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [error])

  const grab = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Specchiamo come nell'anteprima: la foto deve somigliare a quello che vedevi.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.95)
  }

  const shoot = () => {
    if (!useTimer) {
      grab()
      return
    }
    let n = 3
    setCountdown(n)
    const id = window.setInterval(() => {
      n -= 1
      if (n === 0) {
        window.clearInterval(id)
        setCountdown(null)
        grab()
      } else {
        setCountdown(n)
      }
    }, 900)
  }

  const ok = guide.verdict === 'ok'

  return (
    <div className="sheet dark">
      <div className="sheet-head">
        <button className="icon-btn" style={{ color: '#fff' }} onClick={onClose} aria-label="Chiudi">
          ✕
        </button>
        <strong style={{ fontSize: 15 }}>Selfie di oggi</strong>
        <button
          className="icon-btn"
          style={{ color: useTimer ? 'var(--primary)' : '#fff' }}
          onClick={() => setUseTimer((v) => !v)}
          aria-label="Timer"
        >
          ⏱
        </button>
      </div>

      <div className="viewfinder">
        {error ? (
          <div className="empty-state" style={{ color: '#fff' }}>
            <div style={{ fontSize: 44 }}>📷</div>
            <h2 style={{ color: '#fff' }}>Fotocamera non disponibile</h2>
            <p style={{ color: '#a1a1aa' }}>{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted />
            <div className={`guide-oval${ok ? ' ok' : ''}`}>
              <div className="guide-line" style={{ top: `${TARGET_EYE_Y * 100}%` }} />
              <div className="guide-line" style={{ top: '72%' }} />
            </div>
            <div className={`guide-hint${ok ? ' ok' : ''}`}>{guide.hint}</div>
            {countdown !== null && <div className="countdown">{countdown}</div>}
          </>
        )}
      </div>

      <div className="shutter-row">
        <span style={{ width: 44 }} />
        <button className="shutter" onClick={shoot} disabled={!!error} aria-label="Scatta" />
        <span style={{ width: 44, color: '#71717a', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>
          {useTimer ? '3s' : ''}
        </span>
      </div>
    </div>
  )
}

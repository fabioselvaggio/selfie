import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TARGET_EYE_Y,
  detectFace,
  evaluateGuide,
  type GuideState,
  type GuideVerdict,
} from '../lib/faceAlign'
import { IconCamera, IconClose, IconTimer } from '../components/icons'

/**
 * Fotocamera con guida live.
 *
 * Due cose su cui questa schermata è delicata, entrambe imparate sbagliando.
 *
 * 1. QUELLO CHE VEDI È QUELLO CHE SCATTI. L'anteprima mostrava il flusso della
 *    fotocamera ritagliato per riempire lo schermo (`object-fit: cover`), ma lo
 *    scatto prendeva il fotogramma intero: sembrava che ci fosse uno zoom, che
 *    poi "spariva" nella foto salvata. E la guida mentiva, perché era posizionata
 *    sul ritaglio. Ora il riquadro dell'anteprima ha lo stesso rapporto del
 *    sensore, quindi non si ritaglia niente e i tre elementi coincidono.
 *
 * 2. IL RILEVAMENTO NON DEVE MAI BLOCCARE L'OTTURATORE. L'inferenza di MediaPipe
 *    gira in modo sincrono sul thread principale e costa una frazione di secondo
 *    — misurata, è praticamente indipendente dalla dimensione dell'immagine,
 *    quindi rimpicciolire il fotogramma non serve a niente. Lanciandola a
 *    intervallo fisso più breve del suo stesso costo, il ciclo non si fermava
 *    mai e ogni tocco restava in coda dietro l'inferenza in corso. Adesso il
 *    ritmo si adatta: dopo ogni rilevamento aspettiamo il doppio di quanto è
 *    costato, così il thread resta libero per la maggior parte del tempo.
 */

/** Oltre questa soglia la guida costa più di quanto valga e si spegne da sola. */
const TOO_SLOW_MS = 420
/** Frazione di tempo che la guida può occupare: 1 parte di lavoro, 2 di respiro. */
const DUTY = 2

export function CameraSheet({
  onClose,
  onCapture,
}: {
  onClose: () => void
  onCapture: (blob: Blob) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  /** Alzata al momento dello scatto: ferma la guida senza aspettare un render. */
  const capturingRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [ratio, setRatio] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<GuideVerdict>('no-face')
  const [hint, setHint] = useState('Avvio fotocamera…')
  const [guideOff, setGuideOff] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [useTimer, setUseTimer] = useState(false)
  const [flash, setFlash] = useState(false)

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

  // Guida live, a ritmo adattivo.
  useEffect(() => {
    if (error || guideOff) return
    let timer = 0
    let alive = true

    const tick = async () => {
      const video = videoRef.current
      if (!alive || capturingRef.current) return
      if (!video || video.readyState < 2) {
        timer = window.setTimeout(tick, 150)
        return
      }

      const t0 = performance.now()
      let state: GuideState | null = null
      try {
        // Senza raffinamento: qui serve una risposta rapida, la precisione
        // arriva dopo lo scatto.
        const geometry = await detectFace(video, false)
        state = evaluateGuide(geometry, video.videoWidth, video.videoHeight)
      } catch {
        /* il modello può non essere ancora pronto: riproviamo al giro dopo */
      }
      const cost = performance.now() - t0
      if (!alive) return

      if (state) {
        // Aggiorniamo lo stato solo quando il giudizio cambia: un render ogni
        // rilevamento farebbe più danni dell'inferenza stessa.
        setVerdict((prev) => (prev === state.verdict ? prev : state.verdict))
        setHint((prev) => (prev === state.hint ? prev : state.hint))
      }

      if (cost > TOO_SLOW_MS) {
        // Dispositivo lento: meglio nessuna guida che un otturatore che non
        // risponde. La sagoma statica resta, l'allineamento automatico pure.
        setGuideOff(true)
        setHint('Inquadra il viso nell’ovale')
        return
      }

      timer = window.setTimeout(tick, Math.max(120, cost * DUTY))
    }

    timer = window.setTimeout(tick, 200)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [error, guideOff])

  /**
   * Preleva il fotogramma. Il disegno sul canvas è immediato: quello che conta
   * è congelare l'istante del tocco, la codifica può arrivare dopo.
   */
  const grab = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    capturingRef.current = true
    setFlash(true)

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
  }, [onCapture])

  const shoot = () => {
    if (capturingRef.current) return
    if (!useTimer) {
      grab()
      return
    }
    // Durante il conto alla rovescia la guida è già ferma: allo zero lo scatto
    // parte immediatamente, senza inferenze in coda.
    capturingRef.current = true
    let n = 3
    setCountdown(n)
    const id = window.setInterval(() => {
      n -= 1
      if (n === 0) {
        window.clearInterval(id)
        setCountdown(null)
        capturingRef.current = false
        grab()
      } else {
        setCountdown(n)
      }
    }, 900)
  }

  const ok = verdict === 'ok'

  return (
    <div className="sheet dark">
      <div className="sheet-head">
        <button className="icon-btn" style={{ color: '#fff' }} onClick={onClose} aria-label="Chiudi">
          <IconClose />
        </button>
        <strong style={{ fontSize: 15 }}>Selfie di oggi</strong>
        <button
          className="icon-btn"
          style={{ color: useTimer ? 'var(--primary)' : '#fff' }}
          onClick={() => setUseTimer((v) => !v)}
          aria-label="Timer"
        >
          <IconTimer />
        </button>
      </div>

      <div className="viewfinder">
        {error ? (
          <div className="empty-state" style={{ color: '#fff' }}>
            <IconCamera style={{ width: 46, height: 46 }} />
            <h2 style={{ color: '#fff' }}>Fotocamera non disponibile</h2>
            <p style={{ color: '#a1a1aa' }}>{error}</p>
          </div>
        ) : (
          // Il riquadro prende il rapporto del sensore: niente ritaglio, quindi
          // anteprima, guida e scatto inquadrano esattamente la stessa cosa.
          <div className="viewfinder-frame" style={ratio ? { aspectRatio: String(ratio) } : undefined}>
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={(e) => {
                const v = e.currentTarget
                if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight)
              }}
            />
            <div className={`guide-oval${ok ? ' ok' : ''}`}>
              <div className="guide-line" style={{ top: `${TARGET_EYE_Y * 100}%` }} />
              <div className="guide-line" style={{ top: '72%' }} />
            </div>
            <div className={`guide-hint${ok ? ' ok' : ''}`}>{hint}</div>
            {countdown !== null && <div className="countdown">{countdown}</div>}
            {flash && <div className="shutter-flash" />}
          </div>
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

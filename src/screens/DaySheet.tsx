import { useMemo } from 'react'
import { Frame } from '../components/Frame'
import { formatLong, type DayKey } from '../lib/dates'
import { useStore } from '../store'

/**
 * Dettaglio di un giorno, con frecce per scorrere. Scorrere veloce qui è il
 * momento in cui si capisce se l'allineamento funziona: la faccia deve restare
 * ferma mentre cambia tutto il resto.
 */
export function DaySheet({
  day,
  onNavigate,
  onClose,
}: {
  day: DayKey
  onNavigate: (day: DayKey) => void
  onClose: () => void
}) {
  const { photos, urls, byDay, remove } = useStore()

  const { prev, next, photo } = useMemo(() => {
    const days = photos.map((p) => p.day)
    const i = days.indexOf(day)
    return {
      prev: i > 0 ? days[i - 1] : null,
      next: i >= 0 && i < days.length - 1 ? days[i + 1] : null,
      photo: byDay.get(day),
    }
  }, [photos, byDay, day])

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
          ✕
        </button>
        <strong style={{ fontSize: 15 }}>{formatLong(day)}</strong>
        <button
          className="icon-btn"
          onClick={() => {
            if (confirm(`Elimino il selfie del ${formatLong(day)}?`)) {
              void remove(day).then(() => (prev || next ? onNavigate((next ?? prev)!) : onClose()))
            }
          }}
          aria-label="Elimina"
        >
          🗑
        </button>
      </div>

      <div className="screen">
        <Frame src={urls.get(day)} day={day} />

        <div className="btn-row">
          <button
            className="btn ghost"
            onClick={() => prev && onNavigate(prev)}
            disabled={!prev}
            style={{ flex: 1 }}
          >
            ‹ Prec.
          </button>
          <button
            className="btn ghost"
            onClick={() => next && onNavigate(next)}
            disabled={!next}
            style={{ flex: 1 }}
          >
            Succ. ›
          </button>
        </div>

        {photo && (
          <div className="metrics">
            <span className="metric">
              rotazione {photo.align.rotationDeg >= 0 ? '+' : '−'}
              {Math.abs(photo.align.rotationDeg).toFixed(1)}°
            </span>
            <span className="metric">zoom {photo.align.scale.toFixed(2)}×</span>
            <span className={photo.align.coverage < 0.9 ? 'metric warn' : 'metric'}>
              cornice piena {(photo.align.coverage * 100).toFixed(0)}%
            </span>
            <span className="metric">
              {photo.origin === 'camera' ? 'scattata' : 'importata'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

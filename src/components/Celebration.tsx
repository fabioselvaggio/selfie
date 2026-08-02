import { useEffect, useMemo, useState } from 'react'
import { BADGES } from '../lib/dates'
import { BadgeIcon, IconCloudySun, IconFlame } from './icons'

const COLORS = ['#FF6B35', '#4C6FFF', '#22C55E', '#FFB800', '#FF9A3C']

function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 0.09}s`,
        duration: `${1.6 + ((i * 7) % 10) / 10}s`,
        color: COLORS[i % COLORS.length],
      })),
    [count],
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: p.left,
            top: '-20px',
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  )
}

/** Contatore che sale da `from` a `to`: la piccola ricompensa dopo lo scatto. */
function CountUp({ from, to }: { from: number; to: number }) {
  const [n, setN] = useState(from)
  useEffect(() => {
    if (to <= from) {
      setN(to)
      return
    }
    let current = from
    const step = () => {
      current += 1
      setN(current)
      if (current < to) window.setTimeout(step, Math.max(40, 320 / (to - from)))
    }
    const t = window.setTimeout(step, 420)
    return () => window.clearTimeout(t)
  }, [from, to])
  return <span>{n}</span>
}

export function Celebration({
  streakBefore,
  streakAfter,
  broken,
  onClose,
}: {
  streakBefore: number
  streakAfter: number
  broken: boolean
  onClose: () => void
}) {
  const badge = BADGES.find((b) => b.days === streakAfter)

  return (
    <div className="celebrate" onClick={onClose}>
      {!broken && <Confetti />}
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        {broken ? (
          <>
            <IconCloudySun style={{ width: 62, height: 62, color: 'var(--secondary)' }} />
            <h1>Si riparte da 1</h1>
            <p>Hai saltato qualche giorno. Nessun dramma, la faccia ce l’hai ancora.</p>
          </>
        ) : (
          <>
            <div className="flame-big">
              {badge ? <BadgeIcon name={badge.icon} /> : <IconFlame />}
            </div>
            <div className="counter">
              <CountUp from={streakBefore} to={streakAfter} />
            </div>
            <h1>
              {streakAfter === 1 ? 'Primo giorno!' : `${streakAfter} giorni di fila!`}
            </h1>
            <p>
              {badge
                ? `Traguardo sbloccato: ${badge.label}.`
                : 'Selfie salvato e allineato. Ci vediamo domani.'}
            </p>
          </>
        )}
        <button className="btn" onClick={onClose}>
          Continua
        </button>
      </div>
    </div>
  )
}

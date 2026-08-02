import type { ReactNode } from 'react'
import { formatDay, type DayKey } from '../lib/dates'

/**
 * La cornice nera fissa: rapporto 4:5, foto allineata dentro, data in bianco
 * sotto. È la firma visiva dell'app e va usata ovunque compaia un selfie —
 * grande in home, minuscola nel calendario.
 */
export function Frame({
  src,
  day,
  mini,
  showDate = true,
  children,
  onClick,
}: {
  src?: string
  day?: DayKey
  mini?: boolean
  showDate?: boolean
  children?: ReactNode
  onClick?: () => void
}) {
  return (
    <div className={mini ? 'frame mini' : 'frame'} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="frame-photo">
        {children ?? (src ? <img src={src} alt={day ? `Selfie del ${formatDay(day)}` : 'Selfie'} /> : null)}
      </div>
      {showDate && day ? <div className="frame-date">{formatDay(day)}</div> : null}
    </div>
  )
}

/** Segnaposto per il giorno non ancora fatto: sagoma del viso e linee guida. */
export function EmptyFrame({ day, showDate = true }: { day?: DayKey; showDate?: boolean }) {
  return (
    <div className="frame">
      <div className="frame-empty">
        <div className="face-guide" />
      </div>
      {showDate && day ? <div className="frame-date">{formatDay(day)}</div> : null}
    </div>
  )
}

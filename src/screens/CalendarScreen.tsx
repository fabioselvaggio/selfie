import { useMemo, useState } from 'react'
import { monthName, toDayKey, type DayKey } from '../lib/dates'
import { useStore } from '../store'

const DOW = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export function CalendarScreen({ onOpenDay }: { onOpenDay: (day: DayKey) => void }) {
  const { urls, byDay, streak, today } = useStore()
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    // getDay(): 0 = domenica. La settimana italiana comincia di lunedì.
    const lead = (first.getDay() + 6) % 7
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
  }, [cursor])

  const filledThisMonth = useMemo(() => {
    const prefix = `${cursor.y}-${`${cursor.m + 1}`.padStart(2, '0')}`
    return [...byDay.keys()].filter((k) => k.startsWith(prefix)).length
  }, [byDay, cursor])

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth()
  // Nel mese in corso il denominatore sono i giorni già passati, non quelli sul
  // calendario: altrimenti il 2 del mese leggeresti sempre "6%".
  const elapsed = isCurrentMonth ? now.getDate() : daysInMonth

  const shift = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  return (
    <div className="screen">
      <div className="stat-row">
        <div className="stat">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {streak.current}
          </div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat">
          <div className="stat-value">{streak.best}</div>
          <div className="stat-label">Record</div>
        </div>
        <div className="stat">
          <div className="stat-value">{streak.total}</div>
          <div className="stat-label">Totale</div>
        </div>
      </div>

      <div className="cal-head">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mese precedente">
          ‹
        </button>
        <h2>
          {monthName(cursor.m)} {cursor.y}
        </h2>
        <button
          className="icon-btn"
          onClick={() => shift(1)}
          disabled={isCurrentMonth}
          style={{ opacity: isCurrentMonth ? 0.25 : 1 }}
          aria-label="Mese successivo"
        >
          ›
        </button>
      </div>

      <div className="muted" style={{ marginTop: -10 }}>
        {filledThisMonth} di {elapsed} giorni ·{' '}
        {Math.round((filledThisMonth / Math.max(1, elapsed)) * 100)}%
      </div>

      <div className="cal-grid">
        {DOW.map((d, i) => (
          <div key={i} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="cal-cell empty-blank" />
          const key = toDayKey(new Date(cursor.y, cursor.m, day))
          const url = urls.get(key)
          const isToday = key === today
          const isFuture = key > today
          return (
            <button
              key={key}
              className={[
                'cal-cell',
                url ? 'filled' : '',
                isToday ? 'today' : '',
                isFuture ? 'future' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => url && onOpenDay(key)}
            >
              {url ? <img src={url} alt="" /> : <span className="n">{day}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { EmptyFrame, Frame } from '../components/Frame'
import { addDays, formatLong, type DayKey } from '../lib/dates'
import { useStore } from '../store'

const DOW = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

export function Today({
  onShoot,
  onImport,
  onOpenDay,
}: {
  onShoot: () => void
  onImport: () => void
  onOpenDay: (day: DayKey) => void
}) {
  const { today, byDay, urls, streak } = useStore()
  const todayPhoto = byDay.get(today)

  const week: DayKey[] = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  return (
    <div className="screen">
      {todayPhoto ? (
        <Frame src={urls.get(today)} day={today} />
      ) : (
        <EmptyFrame day={today} />
      )}

      {todayPhoto ? (
        <div className="center-col">
          <h2>Fatto per oggi ✅</h2>
          <p>{formatLong(today)} è al suo posto. Ci vediamo domani.</p>
        </div>
      ) : (
        <div className="center-col">
          <h2>{streak.atRisk ? `Non spezzare la catena` : 'Tocca a te'}</h2>
          <p>
            {streak.atRisk
              ? `${streak.current} giorni di fila. Manca solo quello di oggi.`
              : 'Un selfie al giorno. Ci pensa l’app ad allinearlo.'}
          </p>
        </div>
      )}

      <div>
        <button className={todayPhoto ? 'btn ghost' : 'btn'} onClick={onShoot}>
          {todayPhoto ? 'Rifai lo scatto' : 'Scatta il selfie di oggi'}
        </button>
        <button className="btn-link" onClick={onImport}>
          Importa dalla galleria
        </button>
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 8 }}>
          ULTIMI 7 GIORNI
        </div>
        <div className="week">
          {week.map((day) => {
            const url = urls.get(day)
            const isToday = day === today
            return (
              <button
                key={day}
                className="week-cell"
                onClick={() => url && onOpenDay(day)}
                aria-label={formatLong(day)}
              >
                <span className="week-dow">{DOW[new Date(day).getDay()]}</span>
                <span className={`week-thumb${isToday ? ' today' : ''}`}>
                  {url ? <img src={url} alt="" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

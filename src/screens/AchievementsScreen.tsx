import { BADGES, nextBadge } from '../lib/dates'
import { useStore } from '../store'

export function AchievementsScreen() {
  const { streak } = useStore()
  const next = nextBadge(streak.best)
  const prevMilestone = [...BADGES].reverse().find((b) => b.days <= streak.best)?.days ?? 0
  const span = next ? next.days - prevMilestone : 1
  const progress = next ? Math.min(1, (streak.current - prevMilestone) / span) : 1

  return (
    <div className="screen">
      <div className={streak.current > 0 ? 'flame-big' : 'flame-big'} style={{ filter: streak.current ? 'none' : 'grayscale(1)' }}>
        🔥
      </div>
      <div className="center-col" style={{ marginTop: -8 }}>
        <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: 'var(--primary)' }}>
          {streak.current}
        </div>
        <h2>{streak.current === 1 ? 'giorno di fila' : 'giorni di fila'}</h2>
        {streak.atRisk && <p>Oggi manca ancora. Lo streak regge fino a mezzanotte.</p>}
      </div>

      <div className="card">
        {next ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>
                Ancora {Math.max(0, next.days - streak.current)} giorni
              </strong>
              <span className="muted">
                {next.emoji} {next.label}
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
          </>
        ) : (
          <div className="center-col">
            <strong>Li hai sbloccati tutti. 🏆</strong>
            <p>Un anno intero di facce. Adesso il video vale davvero la pena.</p>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{streak.best}</div>
          <div className="stat-label">Record</div>
        </div>
        <div className="stat">
          <div className="stat-value">{streak.total}</div>
          <div className="stat-label">Selfie</div>
        </div>
        <div className="stat">
          <div className="stat-value">{BADGES.filter((b) => b.days <= streak.best).length}</div>
          <div className="stat-label">Badge</div>
        </div>
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 8 }}>
          TRAGUARDI
        </div>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const on = b.days <= streak.best
            return (
              <div key={b.days} className={on ? 'badge on' : 'badge off'}>
                <span className="emoji">{on ? b.emoji : '🔒'}</span>
                <span className="n">{b.days}</span>
                <span className="t">{b.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

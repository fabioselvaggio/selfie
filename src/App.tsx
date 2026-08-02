import { useEffect, useState } from 'react'
import { StoreProvider, useStore, type PendingShot } from './store'
import { warmUpLandmarker } from './lib/faceAlign'
import { Today } from './screens/Today'
import { CameraSheet } from './screens/CameraSheet'
import { AlignSheet } from './screens/AlignSheet'
import { ImportSheet } from './screens/ImportSheet'
import { CalendarScreen } from './screens/CalendarScreen'
import { DaySheet } from './screens/DaySheet'
import { TimelapseScreen } from './screens/TimelapseScreen'
import { AchievementsScreen } from './screens/AchievementsScreen'
import { SettingsSheet } from './screens/SettingsSheet'
import { Celebration } from './components/Celebration'
import {
  IconBadges,
  IconCalendar,
  IconFlame,
  IconSettings,
  IconToday,
  IconVideo,
} from './components/icons'
import type { DayKey } from './lib/dates'

type Tab = 'today' | 'calendar' | 'timelapse' | 'badges'

const TABS: Array<{ id: Tab; Icon: (p: { active?: boolean }) => JSX.Element; label: string }> = [
  { id: 'today', Icon: IconToday, label: 'Oggi' },
  { id: 'calendar', Icon: IconCalendar, label: 'Calendario' },
  { id: 'timelapse', Icon: IconVideo, label: 'Video' },
  { id: 'badges', Icon: IconBadges, label: 'Traguardi' },
]

type Overlay =
  | { kind: 'none' }
  | { kind: 'camera' }
  | { kind: 'import' }
  | { kind: 'settings' }
  | { kind: 'day'; day: DayKey }
  | { kind: 'aligning' }
  | { kind: 'align'; shot: PendingShot }

function Shell() {
  const { ready, streak, prepare, commit } = useStore()
  const [tab, setTab] = useState<Tab>('today')
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' })
  const [party, setParty] = useState<{ before: number; after: number; broken: boolean } | null>(null)

  useEffect(() => {
    warmUpLandmarker()
  }, [])

  const close = () => setOverlay({ kind: 'none' })

  const handleCapture = async (blob: Blob) => {
    setOverlay({ kind: 'aligning' })
    const shot = await prepare(blob, Date.now(), 'camera', 'now')
    setOverlay({ kind: 'align', shot })
  }

  const handleSave = async (shot: PendingShot) => {
    const before = streak.current
    await commit(shot)
    close()
    // Uno scatto che riempie un buco vecchio non è "lo streak di oggi": niente coriandoli.
    const after = before + 1
    setParty({ before, after, broken: before === 0 && streak.total > 0 && !streak.doneToday && streak.best > 1 })
  }

  if (!ready) {
    return (
      <div className="shell">
        <div className="screen" style={{ justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <div className="topbar">
        <span className={streak.current > 0 ? 'streak-chip' : 'streak-chip cold'}>
          <IconFlame active={streak.current > 0} />
          {streak.current}
        </span>
        <button
          className="icon-btn glass"
          onClick={() => setOverlay({ kind: 'settings' })}
          aria-label="Impostazioni"
        >
          <IconSettings />
        </button>
      </div>

      {tab === 'today' && (
        <Today
          onShoot={() => setOverlay({ kind: 'camera' })}
          onImport={() => setOverlay({ kind: 'import' })}
        />
      )}
      {tab === 'calendar' && <CalendarScreen onOpenDay={(day) => setOverlay({ kind: 'day', day })} />}
      {tab === 'timelapse' && <TimelapseScreen />}
      {tab === 'badges' && <AchievementsScreen />}

      <nav className="tabbar">
        {/* La pastiglia scivola sotto la scheda scelta: è il movimento che dà
            il senso di materiale liquido, invece di accendersi e spegnersi. */}
        <span
          className="tab-pill"
          style={{ transform: `translateX(${TABS.findIndex((t) => t.id === tab) * 100}%)` }}
          aria-hidden
        />
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            <span className="glyph">
              <t.Icon active={tab === t.id} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {overlay.kind === 'camera' && (
        <CameraSheet onClose={close} onCapture={(blob) => void handleCapture(blob)} />
      )}
      {overlay.kind === 'import' && <ImportSheet onClose={close} />}
      {overlay.kind === 'settings' && <SettingsSheet onClose={close} />}
      {overlay.kind === 'day' && (
        <DaySheet
          day={overlay.day}
          onNavigate={(day) => setOverlay({ kind: 'day', day })}
          onClose={close}
        />
      )}
      {overlay.kind === 'aligning' && (
        <div className="sheet">
          <div className="screen" style={{ justifyContent: 'center' }}>
            <div className="center-col">
              <div className="spinner" />
              <h2>Allineo lo scatto</h2>
              <p>Cerco pupille e bocca, poi raddrizzo e scalo.</p>
            </div>
          </div>
        </div>
      )}
      {overlay.kind === 'align' && (
        <AlignSheet
          shot={overlay.shot}
          onCancel={close}
          onRetry={() => setOverlay({ kind: 'camera' })}
          onSave={(shot) => void handleSave(shot)}
        />
      )}

      {party && (
        <Celebration
          streakBefore={party.before}
          streakAfter={party.after}
          broken={party.broken}
          onClose={() => setParty(null)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

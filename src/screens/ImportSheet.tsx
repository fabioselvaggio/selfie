import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readCaptureDate } from '../lib/exif'
import { formatDay, toDayKey, type DayKey } from '../lib/dates'
import { useStore } from '../store'
import { IconCheck, IconClose, IconGallery, IconTick } from '../components/icons'

interface Candidate {
  id: string
  file: File
  url: string
  date: Date
  dateSource: 'exif' | 'file'
  day: DayKey
}

type Phase = 'pick' | 'working' | 'done'

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { settings, byDay, prepare, commit } = useStore()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('pick')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [outcome, setOutcome] = useState({ saved: 0, failed: 0, newDays: 0 })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef<string[]>([])

  useEffect(() => () => urlsRef.current.forEach(URL.revokeObjectURL), [])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files].filter((f) => f.type.startsWith('image/'))
      const next: Candidate[] = []
      for (const file of list) {
        const { date, source } = await readCaptureDate(file)
        const url = URL.createObjectURL(file)
        urlsRef.current.push(url)
        next.push({
          id: `${file.name}:${file.size}:${file.lastModified}`,
          file,
          url,
          date,
          dateSource: source,
          day: toDayKey(date, settings.cutoffHour),
        })
      }
      setCandidates((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        const merged = [...prev, ...next.filter((c) => !seen.has(c.id))]
        return merged.sort((a, b) => a.date.getTime() - b.date.getTime())
      })
      // Preselezione: una foto per giorno, la prima di ciascun giorno.
      setSelected((prev) => {
        const out = new Set(prev)
        const takenDays = new Set(
          [...prev].map((id) => next.find((c) => c.id === id)?.day).filter(Boolean) as DayKey[],
        )
        for (const c of next) {
          if (!takenDays.has(c.day)) {
            out.add(c.id)
            takenDays.add(c.day)
          }
        }
        return out
      })
    },
    [settings.cutoffHour],
  )

  /** Un solo scatto per giorno: selezionarne un altro sostituisce il precedente. */
  const toggle = (c: Candidate) => {
    setSelected((prev) => {
      const out = new Set(prev)
      if (out.has(c.id)) {
        out.delete(c.id)
        return out
      }
      for (const other of candidates) {
        if (other.day === c.day) out.delete(other.id)
      }
      out.add(c.id)
      return out
    })
  }

  const selectedList = useMemo(
    () => candidates.filter((c) => selected.has(c.id)),
    [candidates, selected],
  )
  const newDays = useMemo(
    () => selectedList.filter((c) => !byDay.has(c.day)).length,
    [selectedList, byDay],
  )

  const run = async () => {
    setPhase('working')
    setProgress({ done: 0, total: selectedList.length })
    let saved = 0
    let failed = 0
    let fresh = 0
    for (let i = 0; i < selectedList.length; i++) {
      const c = selectedList[i]
      const wasNew = !byDay.has(c.day)
      const shot = await prepare(c.file, c.date.getTime(), 'import', c.dateSource)
      if (shot.failed || !shot.aligned) {
        failed++
      } else {
        await commit(shot)
        saved++
        if (wasNew) fresh++
      }
      setProgress({ done: i + 1, total: selectedList.length })
    }
    setOutcome({ saved, failed, newDays: fresh })
    setPhase('done')
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
          <IconClose />
        </button>
        <strong style={{ fontSize: 15 }}>Importa dalla galleria</strong>
        <span style={{ width: 34 }} />
      </div>

      {phase === 'pick' && (
        <>
          <div className="screen">
            <div
              className={dragOver ? 'dropzone over' : 'dropzone'}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void addFiles(e.dataTransfer.files)
              }}
            >
              <IconGallery style={{ width: 38, height: 38, color: 'var(--secondary)' }} />
              <h3 style={{ marginTop: 8 }}>Scegli le foto</h3>
              <p style={{ fontSize: 13 }}>
                Leggo la data di scatto dai metadati e le metto nel giorno giusto.
              </p>
            </div>
            <input
              ref={inputRef}
              className="hidden-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />

            {candidates.length > 0 && (
              <>
                <div className="muted">
                  {candidates.length} foto · {selectedList.length} selezionate · {newDays} giorni
                  nuovi
                </div>
                <div className="import-grid">
                  {candidates.map((c) => {
                    const isNew = !byDay.has(c.day)
                    return (
                      <button
                        key={c.id}
                        className={selected.has(c.id) ? 'import-cell selected' : 'import-cell'}
                        onClick={() => toggle(c)}
                      >
                        <img src={c.url} alt="" />
                        {isNew && <span className="missing-tag">manca</span>}
                        {selected.has(c.id) && (
                          <span className="check">
                            <IconTick />
                          </span>
                        )}
                        <span className="day-tag">
                          {formatDay(c.day)}
                          {c.dateSource === 'file' ? ' ~' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="muted">
                  Il simbolo ~ indica che la foto non aveva i metadati EXIF: ho usato la data del
                  file, controllala.
                </div>
              </>
            )}
          </div>
          <div className="sheet-foot">
            <button className="btn" onClick={run} disabled={selectedList.length === 0}>
              Importa {selectedList.length > 0 ? selectedList.length : ''}{' '}
              {selectedList.length === 1 ? 'foto' : 'foto'}
            </button>
          </div>
        </>
      )}

      {phase === 'working' && (
        <div className="screen" style={{ justifyContent: 'center' }}>
          <div className="center-col">
            <div className="spinner" />
            <h2>Allineo le foto</h2>
            <p>
              {progress.done} di {progress.total}
            </p>
          </div>
          <div className="progress">
            <i style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}

      {phase === 'done' && (
        <>
          <div className="screen" style={{ justifyContent: 'center' }}>
            <div className="center-col">
              <IconCheck style={{ width: 56, height: 56, color: 'var(--success)' }} />
              <h1>
                {outcome.saved} {outcome.saved === 1 ? 'foto importata' : 'foto importate'}
              </h1>
              <p>
                {outcome.newDays} {outcome.newDays === 1 ? 'giorno recuperato' : 'giorni recuperati'}
                {outcome.failed > 0
                  ? ` · ${outcome.failed} scartate perché non ho trovato il viso`
                  : ''}
              </p>
            </div>
          </div>
          <div className="sheet-foot">
            <button className="btn" onClick={onClose}>
              Fatto
            </button>
          </div>
        </>
      )}
    </div>
  )
}

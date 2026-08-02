import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_SETTINGS,
  clearPhotos,
  deletePhoto,
  getAllPhotos,
  loadSettings,
  putPhoto,
  saveSettings,
  type PhotoRecord,
  type Settings,
} from './lib/db'
import { computeStreak, toDayKey, todayKey, type DayKey, type StreakInfo } from './lib/dates'
import { NO_ADJUST, alignImage, type AlignResult, type ManualAdjust } from './lib/faceAlign'
import { loadImage } from './lib/image'

export interface PendingShot {
  /** Foto originale in attesa di conferma. */
  original: Blob
  capturedAt: number
  day: DayKey
  origin: 'camera' | 'import'
  dateSource: 'exif' | 'file' | 'now'
  aligned: Blob | null
  result: AlignResult | null
  adjust: ManualAdjust
  /** Il volto non è stato trovato: si può salvare comunque, non allineata. */
  failed: boolean
}

interface StoreValue {
  ready: boolean
  photos: PhotoRecord[]
  byDay: Map<DayKey, PhotoRecord>
  urls: Map<DayKey, string>
  streak: StreakInfo
  today: DayKey
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  /** Allinea una foto e la mette in attesa di conferma. */
  prepare: (
    original: Blob,
    capturedAt: number,
    origin: 'camera' | 'import',
    dateSource: 'exif' | 'file' | 'now',
    adjust?: ManualAdjust,
  ) => Promise<PendingShot>
  commit: (shot: PendingShot) => Promise<void>
  remove: (day: DayKey) => Promise<void>
  wipe: () => Promise<void>
  /** Ricalcola tutti gli allineamenti dagli originali (dopo un cambio parametri). */
  realignAll: (onProgress?: (done: number, total: number) => void) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const urlsRef = useRef(new Map<DayKey, string>())
  const [urlVersion, setUrlVersion] = useState(0)

  useEffect(() => {
    setSettings(loadSettings())
    getAllPhotos()
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setReady(true))
  }, [])

  // Gli object URL vivono quanto il record: li creiamo alla prima comparsa e li
  // revochiamo quando la foto di quel giorno cambia o sparisce.
  useEffect(() => {
    const cache = urlsRef.current
    const seen = new Set<DayKey>()
    let changed = false
    for (const p of photos) {
      seen.add(p.day)
      const existing = cache.get(p.day)
      const key = `${p.day}:${p.createdAt}`
      if (!existing || cache.get(`meta:${p.day}` as DayKey) !== key) {
        if (existing) URL.revokeObjectURL(existing)
        cache.set(p.day, URL.createObjectURL(p.aligned))
        cache.set(`meta:${p.day}` as DayKey, key)
        changed = true
      }
    }
    for (const key of [...cache.keys()]) {
      const day = key.startsWith('meta:') ? key.slice(5) : key
      if (!seen.has(day)) {
        if (!key.startsWith('meta:')) URL.revokeObjectURL(cache.get(key)!)
        cache.delete(key)
        changed = true
      }
    }
    if (changed) setUrlVersion((v) => v + 1)
  }, [photos])

  const today = todayKey(settings.cutoffHour)

  const byDay = useMemo(() => new Map(photos.map((p) => [p.day, p])), [photos])
  const urls = useMemo(() => {
    void urlVersion
    return new Map([...urlsRef.current].filter(([k]) => !k.startsWith('meta:')))
  }, [urlVersion, photos])
  const streak = useMemo(
    () => computeStreak(photos.map((p) => p.day), today),
    [photos, today],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const prepare = useCallback<StoreValue['prepare']>(
    async (original, capturedAt, origin, dateSource, adjust = NO_ADJUST) => {
      const day = toDayKey(new Date(capturedAt), settings.cutoffHour)
      const base: PendingShot = {
        original,
        capturedAt,
        day,
        origin,
        dateSource,
        aligned: null,
        result: null,
        adjust,
        failed: false,
      }
      try {
        const img = await loadImage(original)
        const out = await alignImage(img, {
          mouthWeight: settings.mouthWeight,
          refine: settings.refine,
          adjust,
        })
        if (!out) return { ...base, failed: true }
        return { ...base, aligned: out.blob, result: out.result }
      } catch {
        return { ...base, failed: true }
      }
    },
    [settings.cutoffHour, settings.mouthWeight, settings.refine],
  )

  const commit = useCallback<StoreValue['commit']>(
    async (shot) => {
      if (!shot.aligned || !shot.result) return
      const record: PhotoRecord = {
        day: shot.day,
        createdAt: Date.now(),
        capturedAt: shot.capturedAt,
        origin: shot.origin,
        dateSource: shot.dateSource,
        original: shot.original,
        aligned: shot.aligned,
        align: {
          rotationDeg: shot.result.rotationDeg,
          scale: shot.result.scale,
          coverage: shot.result.coverage,
          iris: shot.result.geometry.iris,
          mouthWeight: settings.mouthWeight,
        },
        adjust: shot.adjust,
      }
      await putPhoto(record)
      setPhotos((prev) => [...prev.filter((p) => p.day !== record.day), record].sort((a, b) => a.day.localeCompare(b.day)))
    },
    [settings.mouthWeight],
  )

  const remove = useCallback<StoreValue['remove']>(async (day) => {
    await deletePhoto(day)
    setPhotos((prev) => prev.filter((p) => p.day !== day))
  }, [])

  const wipe = useCallback<StoreValue['wipe']>(async () => {
    await clearPhotos()
    setPhotos([])
  }, [])

  const realignAll = useCallback<StoreValue['realignAll']>(
    async (onProgress) => {
      const all = await getAllPhotos()
      const updated: PhotoRecord[] = []
      for (let i = 0; i < all.length; i++) {
        const p = all[i]
        try {
          const img = await loadImage(p.original)
          const out = await alignImage(img, {
            mouthWeight: settings.mouthWeight,
            refine: settings.refine,
            adjust: p.adjust,
          })
          if (out) {
            const next: PhotoRecord = {
              ...p,
              createdAt: Date.now(),
              aligned: out.blob,
              align: {
                rotationDeg: out.result.rotationDeg,
                scale: out.result.scale,
                coverage: out.result.coverage,
                iris: out.result.geometry.iris,
                mouthWeight: settings.mouthWeight,
              },
            }
            await putPhoto(next)
            updated.push(next)
          } else {
            updated.push(p)
          }
        } catch {
          updated.push(p)
        }
        onProgress?.(i + 1, all.length)
      }
      setPhotos(updated.sort((a, b) => a.day.localeCompare(b.day)))
    },
    [settings.mouthWeight, settings.refine],
  )

  const value: StoreValue = {
    ready,
    photos,
    byDay,
    urls,
    streak,
    today,
    settings,
    updateSettings,
    prepare,
    commit,
    remove,
    wipe,
    realignAll,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fuori da StoreProvider')
  return ctx
}

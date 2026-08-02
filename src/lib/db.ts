/**
 * Archivio locale. Le foto restano sul dispositivo: niente account, niente upload.
 * IndexedDB perché i Blob delle immagini non stanno in localStorage.
 */

import type { DayKey } from './dates'
import type { ManualAdjust } from './faceAlign'

const DB_NAME = 'oggi'
const DB_VERSION = 1
const STORE = 'photos'

export interface PhotoRecord {
  /** Chiave primaria: un solo selfie per giorno. */
  day: DayKey
  /** Quando è stato salvato nell'app. */
  createdAt: number
  /** Quando è stato scattato (EXIF per gli import). */
  capturedAt: number
  origin: 'camera' | 'import'
  dateSource: 'exif' | 'file' | 'now'
  /** Foto originale non toccata: serve per ri-allineare se cambi i parametri. */
  original: Blob
  /** Risultato allineato, pronto da mostrare. */
  aligned: Blob
  align: {
    rotationDeg: number
    scale: number
    coverage: number
    iris: boolean
    mouthWeight: number
  }
  adjust: ManualAdjust
}

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'day' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const req = run(transaction.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function getAllPhotos(): Promise<PhotoRecord[]> {
  return tx<PhotoRecord[]>('readonly', (s) => s.getAll() as IDBRequest<PhotoRecord[]>).then((rows) =>
    rows.sort((a, b) => a.day.localeCompare(b.day)),
  )
}

export function putPhoto(record: PhotoRecord): Promise<unknown> {
  return tx('readwrite', (s) => s.put(record))
}

export function deletePhoto(day: DayKey): Promise<unknown> {
  return tx('readwrite', (s) => s.delete(day))
}

export function clearPhotos(): Promise<unknown> {
  return tx('readwrite', (s) => s.clear())
}

// ---------------------------------------------------------------- impostazioni

export interface Settings {
  /** Ora fino alla quale uno scatto conta ancora per il giorno precedente. */
  cutoffHour: number
  /** Peso della bocca nel fit di allineamento (0 = solo occhi). */
  mouthWeight: number
  /** Due passate di rilevamento: più lento, molto più stabile. */
  refine: boolean
  reminderEnabled: boolean
  reminderTime: string
  showDateOnPhoto: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  cutoffHour: 4,
  mouthWeight: 0.2,
  refine: true,
  reminderEnabled: true,
  reminderTime: '09:00',
  showDateOnPhoto: true,
}

const SETTINGS_KEY = 'oggi.settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* quota piena o storage disabilitato: l'app funziona lo stesso */
  }
}

/**
 * Ponte verso il guscio nativo (Capacitor).
 *
 * Tutto quello che sta qui è opzionale: sul web ogni funzione non fa niente e
 * restituisce `false`, così l'app resta una sola base di codice e continua a
 * girare nel browser esattamente come prima. I plugin sono importati in modo
 * dinamico dentro il ramo nativo, così sul web non finiscono nemmeno nel
 * bundle.
 */

import { Capacitor } from '@capacitor/core'
import { addDays, fromDayKey, todayKey, type DayKey } from './dates'

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** Barra di stato: testo scuro, perché lo sfondo dell'app è chiaro. */
export async function initNative(): Promise<void> {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
  } catch {
    /* su iPad o in configurazioni particolari il plugin può non esserci */
  }
}

// ------------------------------------------------------------ promemoria

/**
 * Quanti giorni di promemoria programmiamo in anticipo.
 *
 * iOS non ha un "ogni giorno tranne quando ho già fatto": una notifica
 * ricorrente non si può saltare per un giorno solo. Quindi programmiamo i
 * prossimi giorni uno per uno e li rifacciamo tutti a ogni apertura, saltando
 * quelli già coperti. Due settimane bastano: l'app viene aperta ogni giorno,
 * ed è il punto in cui si riprogramma.
 */
const AHEAD_DAYS = 14
const ID_BASE = 4200

const BODIES = [
  'Non hai ancora fatto il selfie di oggi.',
  'Manca solo lo scatto di oggi.',
  'Dieci secondi e lo streak è salvo.',
]

function idFor(day: DayKey): number {
  // Un id stabile per giorno, dentro una finestra piccola: così cancellare e
  // riprogrammare non lascia in giro notifiche orfane.
  return ID_BASE + (fromDayKey(day).getTime() / 86_400_000) % 1000
}

/**
 * Riallinea i promemoria a come stanno le cose adesso.
 * Da richiamare a ogni cambio di impostazioni e a ogni apertura dell'app.
 */
export async function syncReminders(opts: {
  enabled: boolean
  time: string
  doneToday: boolean
  cutoffHour: number
}): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Via tutto quello che avevamo programmato: è più semplice e più sicuro
    // che ragionare su cosa aggiornare.
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
    if (!opts.enabled) return true

    const permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return false

    const [hh, mm] = opts.time.split(':').map(Number)
    const today = todayKey(opts.cutoffHour)
    const now = Date.now()

    const notifications = []
    for (let i = 0; i < AHEAD_DAYS; i++) {
      const day = addDays(today, i)
      // Oggi è già fatto: niente notifica, sarebbe solo fastidio.
      if (i === 0 && opts.doneToday) continue
      const at = fromDayKey(day)
      at.setHours(hh, mm, 0, 0)
      if (at.getTime() <= now) continue
      notifications.push({
        id: Math.round(idFor(day)) + i,
        title: 'OGGI',
        body: BODIES[i % BODIES.length],
        schedule: { at },
      })
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------ video

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Salva il video e apre il foglio di condivisione di iOS.
 *
 * Serve perché `<a download>` in una webview nativa non fa niente: il file
 * verrebbe scaricato in un posto che l'utente non può raggiungere. Passando
 * dal foglio di condivisione si può salvare in Foto, mandarlo, metterlo in
 * File — le opzioni che uno si aspetta.
 */
export async function shareVideo(blob: Blob, filename: string): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    const data = await blobToBase64(blob)
    await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    await Share.share({ title: 'Il mio timelapse', url: uri })
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------ ciclo di vita

/** Richiama `fn` quando l'app torna in primo piano. */
export async function onResume(fn: () => void): Promise<() => void> {
  if (!isNative()) {
    const handler = () => {
      if (document.visibilityState === 'visible') fn()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }
  try {
    const { App } = await import('@capacitor/app')
    const listener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) fn()
    })
    return () => void listener.remove()
  } catch {
    return () => {}
  }
}

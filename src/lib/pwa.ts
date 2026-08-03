/**
 * Installazione e aggiornamenti dell'app.
 *
 * Chrome/Edge su Android sparano `beforeinstallprompt` una volta sola e molto
 * presto, spesso prima che React abbia montato qualsiasi cosa. Se non lo si
 * intercetta subito e non lo si mette da parte, il momento passa e non si può
 * più mostrare il bottone "installa". Per questo la cattura sta qui a livello
 * di modulo e viene avviata in main.tsx, non dentro un componente.
 *
 * Su iOS l'evento non esiste proprio: Safari vuole che l'utente faccia
 * Condividi → Aggiungi a Home a mano, quindi lì mostriamo le istruzioni.
 */

import { useSyncExternalStore } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Sta già girando come app installata? */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS non implementa display-mode e usa questa proprietà non standard.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

/** Da chiamare il prima possibile, prima che React monti. */
export function watchInstallability(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Senza preventDefault Chrome mostra la sua barra e non ci lascia decidere quando.
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  )
}

/** Apre il dialogo nativo di installazione. Restituisce true se ha accettato. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const event = deferred
  // Il prompt è usa e getta: dopo averlo mostrato l'evento non vale più.
  deferred = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

/**
 * Chiede al browser di non buttare via i nostri dati.
 *
 * Senza questo, Safari cancella IndexedDB dopo qualche settimana di inattività
 * e Chrome può farlo sotto pressione di spazio: un anno di selfie sparirebbe
 * senza preavviso. Con l'app aggiunta alla schermata Home iOS concede il
 * permesso senza chiedere nulla; da browser può rifiutare, e non c'è modo di
 * insistere.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Registra il service worker. In sviluppo resta spento, darebbe fastidio all'HMR. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* niente offline: l'app funziona lo stesso, solo online */
    })
  })
}

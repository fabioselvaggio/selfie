/*
 * Service worker di OGGI.
 *
 * Scritto a mano invece di tirare dentro Workbox: le regole sono quattro e
 * conviene poterle leggere tutte in una schermata.
 *
 * Strategia:
 *   - guscio dell'app (html, JS, CSS, font, icone): precaricato all'installazione,
 *     con la lista dei file generata in fase di build. Senza quella lista i file
 *     con hash nel nome finirebbero in cache solo dalla seconda visita, perché al
 *     primo caricamento il worker si attiva quando sono già stati scaricati
 *   - navigazioni: prima la rete, poi la cache — un nuovo deploy si vede subito,
 *     ma senza connessione l'app si apre lo stesso
 *   - file con hash e roba MediaPipe (mp/): prima la cache. L'URL identifica il
 *     contenuto, quindi una volta scaricati non cambiano mai
 *   - tutto il resto sulla stessa origine: dalla cache, aggiornando in background
 *
 * Il modello del viso (3,6 MB) e il runtime wasm NON sono nel precarico: sarebbero
 * 25 MB scaricati prima ancora di vedere l'app, e delle due varianti wasm il
 * browser ne usa una sola. Entrano in cache al primo uso vero.
 */

/* I due segnaposto qui sotto vengono sostituiti da vite.config.ts in fase di
   build. I valori di default tengono il file valido anche così com'è. */
const BUILD = /* @build */ 'dev'
const BUILT_FILES = /* @precache */ []

// Il guscio è legato al build; la roba pesante di MediaPipe no, altrimenti ogni
// deploy costringerebbe a riscaricare 15 MB per niente.
const SHELL_CACHE = `oggi-shell-${BUILD}`
const RUNTIME_CACHE = 'oggi-runtime-v1'

// Relativi: l'app può stare in root o dentro una sottocartella.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  ...BUILT_FILES,
]

const INDEX = new URL('./index.html', self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Uno per uno e non addAll: quello fallisce in blocco se manca un file solo,
      // e un'icona assente non deve impedire l'installazione.
      .then((cache) => Promise.all([...new Set(SHELL)].map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Via i gusci dei build precedenti, la cache runtime resta.
            .filter((k) => k.startsWith('oggi-shell-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Prima la cache; se manca, rete e si conserva. Per i file immutabili. */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

/** Prima la rete; se non c'è, quello che abbiamo. Per l'HTML. */
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = (await caches.match(request)) || (await caches.match(INDEX))
    if (cached) return cached
    throw new Error('offline e senza copia in cache')
  }
}

/** Risponde dalla cache e intanto si aggiorna per la volta dopo. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()))
      }
      return response
    })
    .catch(() => cached)
  return cached || fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // Nome con hash o asset MediaPipe: sotto lo stesso URL il contenuto non cambia.
  if (/\/(assets|mp)\//.test(url.pathname) || /\.(woff2|wasm|task)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

// Permette alla pagina di forzare l'attivazione di una versione appena installata.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

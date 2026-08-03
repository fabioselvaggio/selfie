import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker, requestPersistentStorage, watchInstallability } from './lib/pwa'
import { initNative, isNative } from './lib/native'
import './styles.css'

if (isNative()) {
  // Dentro il guscio nativo i file sono già sul dispositivo: il service worker
  // non serve, e su WKWebView con schema custom dà solo problemi.
  void initNative()
} else {
  // Prima di montare: l'evento di installabilità arriva presto e non si ripete.
  watchInstallability()
  registerServiceWorker()
  void requestPersistentStorage()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker, watchInstallability } from './lib/pwa'
import './styles.css'

// Prima di montare: l'evento di installabilità arriva presto e non si ripete.
watchInstallability()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

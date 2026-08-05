import { useState } from 'react'
import { useStore } from '../store'
import { isIos, isStandalone, promptInstall, useCanInstall } from '../lib/pwa'
import { IconCamera, IconClose } from '../components/icons'
import { isNative } from '../lib/native'
import { detectionStats } from '../lib/faceAlign'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, realignAll, wipe, photos } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const canInstall = useCanInstall()
  const installed = isStandalone()

  const rerun = async () => {
    setBusy('0 / ' + photos.length)
    await realignAll((done, total) => setBusy(`${done} / ${total}`))
    setBusy(null)
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet modal">
        <div className="sheet-head">
        <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
          <IconClose />
        </button>
        <strong style={{ fontSize: 15 }}>Impostazioni</strong>
        <span style={{ width: 34 }} />
      </div>

      <div className="screen">
        {!installed && (
          <>
            <div className="muted">APP</div>
            <div className="card">
              {canInstall ? (
                <>
                  <div className="row-label">Installa sul telefono</div>
                  <div className="row-sub" style={{ marginBottom: 12 }}>
                    Parte a tutto schermo, senza barre del browser, e funziona anche senza
                    connessione.
                  </div>
                  <button className="btn small" onClick={() => void promptInstall()}>
                    Installa
                  </button>
                </>
              ) : isIos() ? (
                <>
                  <div className="row-label">Aggiungila alla Home</div>
                  <div className="row-sub">
                    Safari non ha un tasto di installazione: premi <strong>Condividi</strong> in
                    basso, poi <strong>Aggiungi a Home</strong>. Da lì parte a tutto schermo e
                    funziona anche offline.
                  </div>
                </>
              ) : (
                <>
                  <div className="row-label">Installala</div>
                  <div className="row-sub">
                    Dal menu del browser scegli <strong>Installa app</strong>. Parte a tutto
                    schermo e funziona anche senza connessione.
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="muted">PROMEMORIA</div>
        <div className="card">
          <div className="row">
            <div>
              <div className="row-label">Promemoria giornaliero</div>
              <div className="row-sub">
                Una notifica se non hai ancora fatto il selfie.
                {!isNative() && ' Nel browser resta solo un\u2019anteprima: le notifiche programmate arrivano con l\u2019app installata da App Store.'}
              </div>
            </div>
            <button
              className={settings.reminderEnabled ? 'switch on' : 'switch'}
              onClick={() => updateSettings({ reminderEnabled: !settings.reminderEnabled })}
              aria-label="Promemoria giornaliero"
            />
          </div>
          {settings.reminderEnabled && (
            <div className="row">
              <div className="row-label">Orario</div>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => updateSettings({ reminderTime: e.target.value })}
              />
            </div>
          )}
        </div>

        {settings.reminderEnabled && (
          <div className="notif">
            <div className="app-icon">
              <IconCamera />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>OGGI</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Non hai ancora fatto il selfie. Lo streak scade{' '}
                {settings.cutoffHour === 0 ? 'a mezzanotte' : `alle ${settings.cutoffHour}:00`}.
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11, flexShrink: 0 }}>
              ora
            </div>
          </div>
        )}

        <div className="muted">ALLINEAMENTO</div>
        <div className="card">
          <div className="row">
            <div>
              <div className="row-label">Peso della bocca</div>
              <div className="row-sub">
                A 0 conta solo la linea degli occhi. Alzandolo la bocca stabilizza quando inclini la
                testa, ma se esageri combatte con gli occhi quando guardi in basso.
              </div>
            </div>
            <span className="mono" style={{ fontWeight: 900, fontSize: 15, width: 34, textAlign: 'right' }}>
              {settings.mouthWeight.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            style={{ width: '100%' }}
            value={settings.mouthWeight}
            onChange={(e) => updateSettings({ mouthWeight: +e.target.value })}
          />
          <div className="row">
            <div>
              <div className="row-label">Alta precisione</div>
              <div className="row-sub">
                Due passate: la seconda sul viso ritagliato e ingrandito. Più lento, ma la stima
                delle pupille è molto più stabile — è quello che evita il tremolio nel timelapse.
              </div>
            </div>
            <button
              className={settings.refine ? 'switch on' : 'switch'}
              onClick={() => updateSettings({ refine: !settings.refine })}
              aria-label="Alta precisione"
            />
          </div>
          <button className="btn ghost small" onClick={rerun} disabled={!!busy || photos.length === 0}>
            {busy ? `Riallineo… ${busy}` : `Riallinea tutte le foto (${photos.length})`}
          </button>
        </div>

        <div className="muted">GIORNI</div>
        <div className="card">
          <div className="row">
            <div>
              <div className="row-label">Il giorno finisce alle</div>
              <div className="row-sub">
                Uno scatto fatto prima di quest’ora conta ancora per il giorno precedente. Serve a
                non perdere lo streak quando torni a casa alle due di notte.
              </div>
            </div>
            <select
              value={settings.cutoffHour}
              onChange={(e) => updateSettings({ cutoffHour: +e.target.value })}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? 'mezzanotte' : `${h}:00`}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <div>
              <div className="row-label">Data sulla foto</div>
              <div className="row-sub">Nel video esportato.</div>
            </div>
            <button
              className={settings.showDateOnPhoto ? 'switch on' : 'switch'}
              onClick={() => updateSettings({ showDateOnPhoto: !settings.showDateOnPhoto })}
              aria-label="Data sulla foto"
            />
          </div>
        </div>

        <div className="muted">DIAGNOSTICA</div>
        <div className="card">
          <div className="row">
            <div>
              <div className="row-label">Rilevamento del viso</div>
              <div className="row-sub">
                Se qui leggi CPU invece di GPU, ogni rilevamento costa dieci volte tanto: è la
                causa più probabile se la fotocamera risulta lenta.
              </div>
            </div>
            <span className="mono" style={{ fontWeight: 900, fontSize: 13, textAlign: 'right' }}>
              {detectionStats.delegate}
              <br />
              {detectionStats.samples ? `${Math.round(detectionStats.averageMs)} ms` : '—'}
            </span>
          </div>
        </div>

        <div className="muted">DATI</div>
        <div className="card">
          <p style={{ fontSize: 13 }}>
            Le foto restano su questo dispositivo: nessun account, nessun upload. Se svuoti i dati
            del browser spariscono, quindi esporta il video ogni tanto.
          </p>
          <button
            className="btn ghost small"
            style={{ marginTop: 12 }}
            onClick={() => {
              if (confirm('Elimino tutti i selfie? Non si torna indietro.')) void wipe()
            }}
          >
            Elimina tutto
          </button>
        </div>
        </div>
      </div>
    </>
  )
}

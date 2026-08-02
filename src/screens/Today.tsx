import { EmptyFrame, Frame } from '../components/Frame'
import { IconCheck, IconGallery } from '../components/icons'
import { useStore } from '../store'

/**
 * La schermata principale non scorre mai, per scelta.
 *
 * È una schermata da dieci secondi al giorno: la foto, cosa fare, fatto. Tutto
 * quello che invitava a scorrere (la striscia dei giorni, i testi di contorno)
 * sta altrove — il calendario mostra già gli ultimi giorni, e molto meglio.
 * La cornice si adatta all'altezza rimasta invece di imporre la propria.
 */
export function Today({ onShoot, onImport }: { onShoot: () => void; onImport: () => void }) {
  const { today, byDay, urls, streak } = useStore()
  const done = byDay.has(today)

  return (
    <div className="screen today">
      <div className="today-hero">
        {done ? <Frame src={urls.get(today)} day={today} /> : <EmptyFrame day={today} />}
      </div>

      <div className="today-status">
        {done ? (
          <h2>
            <IconCheck className="inline-icon ok" />
            Fatto per oggi
          </h2>
        ) : (
          <h2>{streak.atRisk ? 'Non spezzare la catena' : 'Tocca a te'}</h2>
        )}
      </div>

      <div className="today-actions">
        <button className={done ? 'btn ghost' : 'btn'} onClick={onShoot}>
          {done ? 'Rifai lo scatto' : 'Scatta il selfie di oggi'}
        </button>
        <button className="btn-link" onClick={onImport}>
          <IconGallery className="inline-icon" />
          Importa dalla galleria
        </button>
      </div>
    </div>
  )
}

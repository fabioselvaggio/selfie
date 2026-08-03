# Pubblicare OGGI sull'App Store

Ordine reale delle cose, con i tempi veri e i punti dove ci si incastra.
Presuppone che l'app giri già sul tuo iPhone (vedi [ios.md](ios.md)).

## 1. Apple Developer Program — 99 €/anno

[developer.apple.com/programs](https://developer.apple.com/programs/) → *Enroll*.

Scegli **Individual**, non Organization: quest'ultima richiede un numero D-U-N-S
e ci mettono settimane. Da individuo l'app esce a nome tuo, e serve solo il
documento d'identità.

**Tempi:** di solito attivo in poche ore, a volte 48. È il primo passo perché
tutto il resto lo sblocca lui.

## 2. Il nome — controllalo prima di affezionartici

I nomi sull'App Store sono unici e valgono a livello mondiale. **"OGGI" è quasi
certamente già preso**: è una parola comune, ed esiste anche un settimanale
italiano con quel nome — quindi c'è pure un rischio di marchio registrato, che è
un motivo di rifiuto a sé.

Cerca su [App Store Connect](https://appstoreconnect.apple.com) quando crei
l'app: se il nome è occupato te lo dice subito. Hai 30 caratteri per il nome e
altri 30 per il sottotitolo.

Se devi cambiarlo, l'unico punto nel codice è `appName` in
`capacitor.config.ts`. Il `appId` (`com.fabioselvaggio.oggi`) può restare com'è:
non lo vede nessuno.

## 3. Crea l'app in App Store Connect

*Le mie app* → **+** → *Nuova app*.

| campo | cosa metterci |
|---|---|
| Piattaforma | iOS |
| Nome | quello scelto sopra |
| Lingua principale | Italiano |
| Bundle ID | `com.fabioselvaggio.oggi` — appare da solo dopo il primo caricamento da Xcode |
| SKU | un codice tuo qualsiasi, es. `oggi-001`. Non lo vede nessuno |

## 4. Schede da compilare

### Privacy — è già pronta

**URL informativa privacy:**
`https://fabioselvaggio.github.io/selfie/privacy.html`

La pagina è nel repo (`public/privacy.html`) e viene pubblicata insieme all'app.
È obbligatoria: senza, l'invio è bloccato.

Nella scheda **Privacy dell'app** dichiara **"Non vengono raccolti dati"**. È
vero alla lettera: niente account, niente statistiche, niente rete. È il caso più
semplice che esista, e ti evita l'intera compilazione delle categorie.

### Conformità sull'esportazione

Già gestita: `scripts/ios-permissions.sh` scrive
`ITSAppUsesNonExemptEncryption = false` in `Info.plist`. L'app usa solo HTTPS,
che rientra nelle eccezioni. Senza quella chiave App Store Connect ti fa la
stessa domanda a ogni singolo caricamento.

### Categoria e classificazione

- **Categoria principale:** Foto e video. Secondaria: Stile di vita.
- **Classificazione per età:** 4+. Rispondi no a tutte le domande del
  questionario — non c'è contenuto generato da altri, né acquisti, né
  pubblicità.

### Testo — bozza da adattare

**Sottotitolo** (30 caratteri):
> Un selfie al giorno, allineato

**Descrizione:**

```
Un selfie al giorno. L'app pensa al resto.

Ogni foto viene raddrizzata e ridimensionata automaticamente in modo che
occhi e bocca finiscano sempre nello stesso punto. Scorri i giorni e la
faccia resta ferma mentre cambia tutto il resto: la luce, i capelli, lo
sfondo, tu.

• Allineamento automatico — trova pupille e bocca e sistema rotazione e
  inquadratura da solo. Nessun ritaglio da fare a mano.
• Timelapse — tutti i tuoi giorni in sequenza, da salvare o condividere.
• Calendario — vedi a colpo d'occhio i giorni fatti e quelli saltati.
• Import dalla galleria — recupera i selfie che hai già, la data la legge
  dai metadati.
• Streak e traguardi — perché saltare un giorno costa qualcosa.
• Promemoria giornaliero all'ora che scegli tu.

Le foto restano sul tuo iPhone. Nessun account, nessun caricamento, nessuna
statistica. Il riconoscimento del viso avviene interamente sul dispositivo,
anche senza connessione.
```

**Parole chiave** (100 caratteri in tutto, separate da virgole, senza spazi
dopo la virgola per non sprecarli):

```
selfie,timelapse,ogni giorno,abitudini,streak,foto,diario,viso,invecchiare,progressi
```

**URL di supporto:** obbligatorio. Va bene la pagina del repo:
`https://github.com/fabioselvaggio/selfie`

## 5. Screenshot

Servono da 3 a 10 immagini nella misura **6,9 pollici: 1290 × 2796**.

```bash
npm run dev                                  # in un altro terminale
npm run appstore:shots -- ./mie-foto
```

Prende le tue foto, le importa davvero nell'app (stesso allineamento, stessa
lettura della data) e cattura le schermate nella misura esatta. Ne bastano una
decina di giorni diversi, così come escono dal telefono.

Richiede Playwright una volta sola: `npx playwright install chromium`.

**Le foto devono essere le tue.** Le schermate devono mostrare l'app come si
presenta davvero, e Apple rifiuta gli screenshot con contenuto finto o di
repertorio.

## 6. Carica la build

In Xcode, con **Any iOS Device** selezionato come destinazione (non il
simulatore):

*Product* → **Archive** → attendi → *Distribute App* → **App Store Connect** →
*Upload*.

Dopo il caricamento passano 10-30 minuti prima che la build compaia in App Store
Connect.

## 7. TestFlight, prima della review

Installala su te stesso via TestFlight e usala per qualche giorno vero. È
gratis, immediato per i tester interni, e ti fa scoprire le cose che si vedono
solo con l'uso quotidiano.

**Provalo con l'app installata da TestFlight, non da Xcode:** le notifiche e i
permessi si comportano come nella versione finale, cosa che con la build di
sviluppo non è garantita.

## 8. Invia alla review

*Aggiungi per la revisione* → *Invia*. Oggi ci mettono in media 24-48 ore.

### I due motivi per cui potrebbero rifiutarla

**Linea guida 4.2 — Minimum Functionality.** È il rischio vero per un'app
costruita su Capacitor: Apple rifiuta le app che sono solo un sito impacchettato.
OGGI ha argomenti solidi — funziona offline, elabora le immagini sul dispositivo,
usa fotocamera, notifiche locali e condivisione native, e non c'è nessun sito
equivalente da visitare. Se ti scrivono, rispondi con questi punti nella
*Resolution Center*: quasi sempre basta.

**Permessi poco spiegati.** Già coperto dalle tre stringhe in `Info.plist`, che
lo script scrive da solo. Se le cambi, spiega *perché* servono, non *cosa* fanno:
è quello che il revisore controlla.

### Se ti rifiutano

Non è una bocciatura definitiva: rispondi nella Resolution Center, sistemi e
reinvii. Le prime versioni di quasi tutte le app fanno un giro di rifiuto.

## 9. Dopo la pubblicazione

Per ogni aggiornamento: alzi il numero di versione in Xcode (*General* →
*Version* e *Build*), `npm run ios`, Archive, Upload, e invii. Gli aggiornamenti
passano la review più in fretta della prima volta.

---

## Prima di iniziare, due cose da decidere

**Il backup.** Le foto vivono solo sul dispositivo. Va bene per te, ma per
qualcun altro perdere un anno di selfie cambiando telefono è un problema serio —
ed è la recensione a una stella che ti aspetta. Se pubblichi per altri, un export
o un backup su iCloud viene prima di tutto il resto.

**Lo spazio.** Di ogni giorno teniamo originale e versione allineata. Con foto da
12 MP fa circa 3 MB al giorno, cioè **oltre 1 GB in un anno**. Va risolto prima
di darla a qualcuno: o si comprimono gli originali, o si tengono solo per un
certo periodo.

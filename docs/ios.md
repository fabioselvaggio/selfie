# Portare OGGI su iOS

L'app web è già dentro un guscio [Capacitor](https://capacitorjs.com): stesso
codice, stesse schermate, stesso MediaPipe. Quello che si guadagna passando al
nativo è **il promemoria giornaliero vero** (notifiche locali programmate, senza
server), il salvataggio del video in Foto, uno storage che iOS non svuota mai, e
l'App Store.

Tutto quello che segue va fatto **su un Mac**: compilare e firmare un'app iOS
richiede Xcode, non c'è modo di aggirarlo.

## Prima volta

```bash
npm install
npx cap add ios          # crea la cartella ios/ e installa i CocoaPods
```

Poi aggiungi tre righe a `ios/App/App/Info.plist`. Sono le spiegazioni che iOS
mostra quando chiede il permesso: senza, l'app viene rifiutata dalla review e
crasha al primo accesso alla fotocamera.

```xml
<key>NSCameraUsageDescription</key>
<string>Per scattare il selfie di oggi. Le foto restano sul tuo iPhone.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Per importare selfie che hai già scattato e riempire i giorni mancanti.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Per salvare il video del timelapse nelle tue Foto.</string>
```

## Ogni volta che vuoi provare

```bash
npm run ios
```

Compila l'app web, la copia dentro il progetto iOS e apre Xcode. Da lì premi
play con l'iPhone collegato.

Da Xcode, la prima volta: seleziona il target **App** → *Signing & Capabilities*
→ scegli il tuo team. Con un Apple ID gratuito l'app funziona ma **scade dopo 7
giorni** e va reinstallata; con il Developer Program (99 €/anno) dura un anno e
puoi pubblicarla.

## Cosa cambia rispetto al web

L'app riconosce da sola dove sta girando (`src/lib/native.ts`) e si comporta di
conseguenza. Sul web ogni funzione nativa non fa niente e restituisce `false`,
quindi il browser continua a funzionare esattamente come prima.

| | web | iOS nativo |
|---|---|---|
| promemoria | solo anteprima nelle impostazioni | notifiche locali vere |
| salvataggio video | download del file | foglio di condivisione → Foto, Messaggi, File |
| dati | IndexedDB, con richiesta di persistenza | IndexedDB dell'app, mai svuotato |
| offline | service worker | i file sono già sul dispositivo |
| barra di stato | — | testo scuro su sfondo chiaro |

### Il promemoria, nel dettaglio

iOS non sa fare "ogni giorno tranne quando ho già fatto il selfie": una notifica
ricorrente non si può saltare per un giorno solo. Quindi programmiamo i
**prossimi 14 giorni uno per uno** e li rifacciamo tutti a ogni apertura,
saltando quelli già coperti. L'app viene aperta ogni giorno per definizione, ed
è lì che la finestra si rinnova.

Il codice sta in `syncReminders()`, richiamato quando cambiano le impostazioni,
quando fai il selfie di oggi, e a ogni ritorno in primo piano.

## Da verificare per prima cosa sul dispositivo

**La fotocamera.** In WKWebView `getUserMedia` funziona da iOS 14.3, ma dipende
dallo schema con cui Capacitor serve i file e ogni tanto cambia qualcosa fra una
versione e l'altra. È l'unico punto davvero a rischio di tutto il porting:
provalo subito, prima di mettere mano al resto.

Se non funzionasse, il ripiego è il plugin `@capacitor/camera`, che usa la
fotocamera di sistema invece di quella nel browser. Si perde la guida live con
l'ovale — l'allineamento automatico dopo lo scatto continua a funzionare
identico, visto che lavora sull'immagine finita.

## Se un giorno volessi il nativo puro

La matematica dell'allineamento (`src/lib/faceAlign.ts`) si porta pari pari: il
motore è una similarità ai minimi quadrati su tre punti, una cinquantina di
righe che non dipendono dal web. Cambia solo da dove arrivano i tre punti —
`VNDetectFaceLandmarksRequest` di Vision restituisce anche le pupille, che è
esattamente quello che ci serve — e come si scrive il video, con `AVAssetWriter`
al posto di `MediaRecorder`.

# Prompt per riscrivere OGGI in nativo iOS

> Copia tutto quello che sta sotto la riga e incollalo in una chat nuova.

---

Voglio costruire da zero un'app iOS nativa. Esiste già una versione web
funzionante e collaudata: quello che segue è tutto ciò che ho imparato
costruendola, compresi gli errori. Non serve che tu li rifaccia.

## Cosa fa l'app

Un selfie al giorno. Ogni foto viene raddrizzata e ridimensionata
automaticamente in modo che **occhi e bocca cadano sempre nello stesso punto**.
Scorrendo i giorni la faccia resta ferma mentre cambia tutto il resto: la luce,
i capelli, lo sfondo, io. Alla fine si esporta un timelapse.

## Il concetto visivo centrale

Ogni selfie vive dentro una **cornice nera fissa**: rapporto 4:5, angoli
arrotondati, sempre identica. Dentro, la foto viene trasformata in modo diverso
ogni giorno. Sotto la foto, dentro la stessa cornice nera, la **data in bianco,
grassetto, centrata** — è la firma visiva dell'app e va ripetuta ovunque compaia
un selfie, dal formato grande alla miniatura del calendario.

Conseguenza da rispettare e non "aggiustare": **quando la foto trasformata non
copre tutta la cornice, resta il nero**. Bande nere sopra, sotto o ai lati. Non
ritagliare per riempire: su uno scatto ravvicinato taglieresti la testa.

## La matematica dell'allineamento

È il cuore dell'app e funziona: portala pari pari.

Da ogni volto servono **tre punti**: centro della pupilla sinistra, centro della
pupilla destra, centro della bocca. Le pupille e non gli angoli dell'occhio,
perché gli angoli si spostano quando strizzi gli occhi.

Su questi tre punti si risolve una **similarità ai minimi quadrati pesati**
(forma chiusa 2D di Horn): rotazione, scala uniforme, traslazione — quattro
gradi di libertà, nessuna deformazione prospettica.

```
Dati p[i] (sorgente), q[i] (destinazione), pesi w[i]:

  W  = Σ w[i]
  p̄  = Σ w[i]·p[i] / W          q̄ = Σ w[i]·q[i] / W
  a[i] = p[i] − p̄               b[i] = q[i] − q̄

  numCos = Σ w[i]·(a[i].x·b[i].x + a[i].y·b[i].y)
  numSin = Σ w[i]·(a[i].x·b[i].y − a[i].y·b[i].x)
  den    = Σ w[i]·(a[i].x² + a[i].y²)

  sCos = numCos / den            sSin = numSin / den

  matrice = [ sCos  −sSin  q̄.x − (sCos·p̄.x − sSin·p̄.y) ]
            [ sSin   sCos  q̄.y − (sSin·p̄.x + sCos·p̄.y) ]
```

I due occhi da soli determinano già esattamente la trasformazione. La bocca
entra con **peso 0.2** contro 1.0 degli occhi: aiuta quando la testa è inclinata
avanti o indietro, ma alzandola troppo combatte con gli occhi quando guardi in
basso.

Costanti di destinazione, ricavate provando:

```
rapporto cornice     4:5 verticale
risoluzione lavoro   1200 × 1500 px            (vedi errore 7)
distanza pupille     0.17 × larghezza cornice  (vedi errore 8)
altezza occhi        0.40 × altezza cornice
distanza occhi→bocca 1.15 × distanza pupille
```

## Stack

- **SwiftUI**, iOS 17 minimo (o iOS 26 se vuoi il Liquid Glass di sistema).
- **Vision** per i landmark: `VNDetectFaceLandmarksRequest` con la costellazione
  a 76 punti dà `leftPupil`, `rightPupil` e `innerLips`. Attenzione: Vision usa
  coordinate normalizzate con origine in basso a sinistra, vanno convertite.
- **AVFoundation** per la fotocamera: `AVCaptureSession` +
  `AVCaptureVideoPreviewLayer` + `AVCapturePhotoOutput`.
- **AVAssetWriter** per esportare il timelapse in MP4/H.264.
- **PhotosUI** (`PHPickerViewController`) per l'import: non richiede permessi,
  l'utente sceglie e basta.
- **UserNotifications** per il promemoria.
- **SwiftData** o Core Data per i metadati; le immagini come file su disco, non
  dentro il database.

**Prima di dare per scontato che Vision sia meglio:** la versione web usa
MediaPipe Face Landmarker, che dà i centri delle iridi con una stabilità
misurata (vedi la tabella dei test). Vision potrebbe essere più preciso o meno.
**Misuralo con lo stesso test** prima di scegliere. Se Vision risultasse più
rumoroso, due alternative: MediaPipe esiste anche come pod iOS, e su dispositivi
TrueDepth **ARKit** (`ARFaceAnchor.leftEyeTransform`) dà una stabilità superiore
a entrambi — ma solo dal vivo, non sulle foto importate.

## Schermate

**Oggi** — la cornice con la foto del giorno, lo streak in alto, un bottone
grande per scattare, un link per importare. **Non deve scorrere mai**, su nessun
telefono: è una schermata da dieci secondi al giorno.

**Fotocamera** — anteprima a tutto schermo con una guida: ovale per il viso,
linea all'altezza degli occhi, linea alla bocca. La guida diventa verde quando
sei in posizione, con suggerimenti che cambiano ("Avvicinati", "Raddrizza la
testa", "Perfetto, non ti muovere"). Otturatore grande, timer 3 secondi
opzionale.

**Allineamento** — la schermata chiave. Prima/dopo affiancati, con
un'animazione: la foto grezza ruota, scala e trasla fino a incastrarsi, mentre
tre marker si agganciano ai bersagli. Sotto, i numeri: rotazione applicata,
zoom, quanta cornice resta piena. E un ritocco manuale con slider, perché il
rilevamento a volte sbaglia.

**Import** — griglia delle foto scelte con la data letta dall'EXIF già
mostrata, i giorni mancanti evidenziati, una sola foto per giorno. Ogni foto
importata passa comunque dall'allineamento.

**Calendario** — griglia mensile, miniature dentro mini cornici nere, giorni
vuoti in grigio, oggi evidenziato. Statistiche: streak, record, totale. Toccare
un giorno lo apre a schermo intero, con frecce per scorrere avanti e indietro —
scorrere veloce lì è il momento in cui si capisce se l'allineamento funziona.

**Timelapse** — player che parte **fermo**, velocità (lento/normale/veloce),
export. Niente altro: ogni controllo in più è peso.

**Traguardi** — fiamma grande con lo streak, badge a 3, 7, 14, 30, 60, 100, 200,
365 giorni, barra verso il prossimo.

**Impostazioni** — ora di fine giornata, peso della bocca, alta precisione,
promemoria, riallineamento di tutto l'archivio.

## Design

Moderno, semplice, con un po' di gioco — l'energia di Duolingo, ma senza
mascotte e senza XP: le meccaniche sono solo streak, calendario e badge.

```
sfondo      #FAF8F5      primario  #FF6B35   (ombra #D14A18)
inchiostro  #0A0A0A      secondario #4C6FFF
successo    #22C55E      oro       #FFB800
spento      #E7E3DC
```

Font di sistema con design `.rounded`, pesi molto grassi per titoli e numeri.
Bottoni a capsula con un bordo inferiore spesso in tinta più scura che si
schiaccia al tocco. Animazioni a molla, mai lineari.

Le superfici che fluttuano sopra il contenuto — barra in basso, pastiglie in
alto, testate dei pannelli — usano il vetro (`.ultraThinMaterial`, o
`.glassEffect()` su iOS 26). Non metterlo sulle schede statiche: su un fondo
piatto non si vede e la sfocatura la paghi comunque.

**Nessuna emoji nell'interfaccia.** Le disegna il sistema operativo, cambiano
fra versioni, portano colori loro. SF Symbols o forme disegnate.

## Decisioni di prodotto non ovvie

- **Il giorno finisce alle 4:00, non a mezzanotte** (configurabile). Chi si fa
  il selfie tornando a casa alle 2:30 non deve perdere lo streak.
- **Un solo selfie per giorno.** L'import gestisce il conflitto facendoti
  scegliere.
- **Streak interrotto = tono gentile.** Nessuna schermata punitiva.
- **Si conservano sia l'originale sia la versione allineata**, così cambiando i
  parametri si può riallineare tutto senza rifare le foto. Costa spazio (vedi
  errore 9), ma è quello che ha permesso di correggere un baco di qualità senza
  perdere niente.

## Errori già fatti — non rifarli

Questi sono i punti dove la versione web si è rotta davvero. Ognuno è costato
tempo, e ognuno ha una difesa precisa.

**1. Il downscale che distruggeva le foto.** Prima di disegnare la foto nella
cornice va ridotta progressivamente a metà, altrimenti un ridimensionamento
forte fa aliasing. La condizione del ciclo era `scalaVoluta * fattore < 0.5`
invece di `scalaVoluta / fattore < 0.5`: quello che deve restare sopra 0.5 è la
riduzione **ancora da fare**. Moltiplicando, ogni giro rendeva la condizione più
vera e il ciclo non finiva mai. Una foto da 48 MP finiva a **45×60 pixel** e poi
veniva ringrandita. Nessun test lo aveva preso perché tutti partivano da
immagini più piccole della cornice, dove il ciclo non parte nemmeno.
→ *Difesa: un test che misura la nitidezza su foto di dimensione reale.*

**2. L'anteprima non mostrava quello che scattavi.** L'anteprima riempiva lo
schermo ritagliando il flusso della fotocamera, ma lo scatto prendeva il
fotogramma intero: sembrava esserci uno zoom che poi spariva nella foto salvata.
E la guida mentiva, perché era calibrata sul ritaglio.
→ *Difesa: il riquadro dell'anteprima deve avere lo stesso rapporto del sensore,
e un test che confronta i due rapporti.*

**3. Il rilevamento live bloccava l'otturatore.** L'inferenza girava a intervallo
fisso di 120 ms mentre ne costava 250: il ciclo non finiva mai e ogni tocco
restava in coda. Su nativo hai un vantaggio — Vision può girare su una coda in
background e a 30fps — ma la regola resta: **il rilevamento non deve mai stare
sul percorso dello scatto**, e il ritmo va calibrato sul costo misurato, non su
un numero scelto a caso.

**4. Non fidarsi di quello che dichiara un'API.** `MediaRecorder.isTypeSupported`
diceva che l'MP4 era supportato e poi produceva file da zero byte. Su nativo
`AVAssetWriter` è affidabile, ma la lezione vale: **verifica l'uscita, non la
dichiarazione**.

**5. La misura sbagliata non dimostra niente.** Ho cercato di provare un
miglioramento di reattività con una sonda che non catturava il blocco, e i
numeri erano identici prima e dopo. Poi ho scoperto che il mio A/B era invalido
perché una protezione restava attiva in entrambi i rami. **Se una misura non
distingue i due casi, non è una prova — dillo invece di presentarla come tale.**

**6. I nomi delle classi si scontrano.** Ho chiamato una variante di pannello
`card`, che esisteva già come stile per le schede: il pannello si è ritrovato
padding e bordo di un'altra cosa. Banale, ma è costato un giro di debug su un
sintomo puramente visivo.

**7. Risoluzione di lavoro troppo bassa.** 900 px di larghezza sembravano tanti,
ma su uno schermo 3x la cornice ne occupa 1110: l'immagine veniva comunque
ringrandita e si vedeva. **1200 è il minimo**, su nativo puoi permetterti di più.

**8. Inquadratura di destinazione troppo stretta.** Con la distanza fra le
pupille al 34% della larghezza si stringeva sul viso, il che costringeva a
ingrandire di 3-5× e ammorbidiva tutto. A 0.17 è un mezzobusto, con zoom fra
1.2× e 1.5×.

**9. Lo spazio cresce in fretta.** Originale + allineata, con foto da 12 MP, fa
~3 MB al giorno: **oltre 1 GB in un anno**. Decidilo all'inizio: comprimere gli
originali, tenerli solo per un periodo, o accettarlo.

## Test obbligatori

Sono quelli che hanno reso affidabile la versione web. Scrivili come XCTest.

**Precisione dell'allineamento.** Prendi **una sola foto**, fabbricane N
varianti con rotazione, zoom e traslazione note — cioè la stessa faccia
fotografata male in N giorni diversi — allineale, e ri-rileva i punti sulle
uscite.

La metrica che conta **non è l'errore assoluto** rispetto al bersaglio: uno
scostamento sistematico sposta tutti i fotogrammi allo stesso modo e resta
invisibile. Quello che si vede nel timelapse è la **dispersione fra un giorno e
l'altro**. Misura la deviazione standard di posizione, distanza interpupillare e
angolo.

Riferimento da battere, misurato sulla versione web con cornice 1200×1500:

| misura | valore | in proporzione |
|---|---|---|
| σ centro occhi | 0,71 px | 0,06% della larghezza |
| σ distanza interpupillare | 1,62 px | 0,8% |
| σ angolo | 0,17° | — |

**Nitidezza.** Su foto di dimensione reale da telefono (12 e 48 MP), misura la
varianza del laplaciano sulla zona del viso e confrontala con un rendering di
riferimento fatto in una passata sola. La pipeline deve essere almeno
altrettanto nitida. È il test che avrebbe preso l'errore 1.

**Inquadratura.** Il rapporto del riquadro d'anteprima deve coincidere con
quello del sensore. È il test che avrebbe preso l'errore 2.

**Limite da tenere presente:** questi test usano varianti sintetiche di una foto
sola. Isolano la matematica, ma non dicono niente su come si comporta il
rilevatore fra due giorni veri, con luce, espressione e barba diverse. Quella
misura si fa solo su un archivio reale — fammela fare presto, con le mie foto.

## Come voglio lavorare

Misura prima di dichiarare. Se una cosa non l'hai verificata, dimmelo invece di
darla per buona. Quando trovi un baco, scrivi anche il test che l'avrebbe preso.
Commenta il *perché* delle scelte non ovvie, non il *cosa* fa il codice.

## Prima di iniziare, chiedimi

1. **Il nome.** "OGGI" è quasi certamente già preso sull'App Store, e in Italia
   c'è pure un settimanale con quel nome.
2. **La versione minima di iOS.** Da questo dipende se posso usare il Liquid
   Glass di sistema o devo approssimarlo.
3. **Il backup.** Le foto solo sul dispositivo vanno bene per me, ma se
   pubblico, perdere un anno di selfie cambiando telefono è la recensione a una
   stella garantita.
4. **Se voglio anche Android**, perché cambia tutto l'impianto.

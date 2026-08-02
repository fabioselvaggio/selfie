# OGGI

Un selfie al giorno, allineato automaticamente.

Ogni foto viene portata dentro una cornice fissa 4:5 in modo che **occhi e bocca
cadano sempre nello stesso punto**. Scorri i giorni e la faccia resta ferma
mentre cambia tutto il resto: la luce, i capelli, lo sfondo, tu.

## Aprila

**→ https://fabioselvaggio.github.io/selfie/**

> **Da fare una volta sola**, se il link dà 404: su GitHub, *Settings → Pages →
> Build and deployment → Source: **GitHub Actions***. Poi *Actions → Deploy su
> GitHub Pages → Re-run jobs*. Il token di Actions non può accendere Pages da
> solo, è l'unico passaggio manuale.

Aprila dal telefono e aggiungila alla schermata Home: parte a tutto schermo,
senza barre del browser, come un'app vera.

- **iPhone** — Safari → tasto Condividi → *Aggiungi a Home*
- **Android** — Chrome → menu ⋮ → *Installa app*

Al primo avvio scarica ~4 MB di modello per il riconoscimento del viso, poi
funziona anche offline. Le foto restano sul telefono: non passano da nessun
server, nemmeno il mio.

![prova dell'allineamento](docs/alignment-proof.jpg)

Sopra: la stessa foto inquadrata male in cinque modi diversi. Sotto: dopo
l'allineamento. Dove lo scatto non copre la cornice resta il nero — è voluto,
non è un ritaglio mancato.

## Come funziona l'allineamento

Il rilevamento usa **MediaPipe Face Landmarker** (478 punti, iridi comprese) e
gira interamente nel browser: le foto non escono mai dal dispositivo.

Da ogni volto prendiamo tre punti:

| punto | landmark | perché |
|---|---|---|
| iride sinistra | 468 | il centro dell'iride non si sposta quando strizzi gli occhi, gli angoli sì |
| iride destra | 473 | idem |
| centro bocca | media di 13, 14, 61, 291 | terzo vincolo, stabilizza l'inclinazione della testa |

Su questi tre punti risolviamo una **similarità ai minimi quadrati pesati**
(forma chiusa 2D di Horn): rotazione, scala uniforme e traslazione — quattro
gradi di libertà, nessuna deformazione prospettica.

I due occhi da soli determinano già esattamente la trasformazione. La bocca
entra con un peso configurabile (`mouthWeight`, default `0.2`): aiuta quando la
testa è inclinata avanti o indietro, ma se pesa troppo combatte con gli occhi
quando guardi in basso.

La destinazione è parametrica in `src/lib/faceAlign.ts`:

```
TARGET_IPD_RATIO   0.17   distanza fra le pupille, in frazioni della larghezza cornice
TARGET_EYE_Y       0.40   altezza della linea degli occhi
TARGET_MOUTH_DROP  1.15   distanza occhi→bocca, in multipli della distanza interpupillare
```

`TARGET_IPD_RATIO` decide l'inquadratura: `0.17` è un mezzobusto (testa e
spalle). Alzarlo stringe sul viso, ma costringe a ingrandire di più e
l'immagine si ammorbidisce.

Due dettagli che fanno la differenza sulla qualità:

- **Rilevamento in due passate.** La prima trova il viso, la seconda rifà il
  rilevamento su un ritaglio ingrandito attorno al viso. Il modello lavora
  internamente a 192×192: dandogli il ritaglio invece della foto intera gli
  mettiamo molti più pixel sulla faccia.
- **Downscale progressivo.** Una foto da 12 MP dentro una cornice da 900 px
  viene ridotta a metà a più riprese prima del `drawImage` finale, altrimenti
  il ricampionamento fa aliasing e i capelli diventano un pettine.

## Quanto è preciso

`npm run verify:alignment` prende **una sola foto**, ne fabbrica cinque varianti
con rotazione, zoom e traslazione note — cioè simula la stessa faccia
fotografata male in cinque giorni diversi — e misura dove finiscono davvero i
punti nelle uscite.

La metrica che conta non è l'errore assoluto rispetto al bersaglio: uno
scostamento sistematico sposta tutti i fotogrammi allo stesso modo e resta
invisibile. Quello che si vede nel timelapse è la **dispersione fra un giorno e
l'altro**.

Con i default (`mouthWeight 0.2`, alta precisione), su cornice 900×1125:

| misura | valore | in proporzione |
|---|---|---|
| σ centro occhi | 0,58 px | 0,06% della larghezza |
| σ distanza interpupillare | 1,13 px | 0,7% |
| σ angolo | 0,18° | — |
| tempo per foto | ~350 ms | (~190 ms senza alta precisione) |

Le rotazioni applicate vengono annullate esattamente: −11° → +11,4°, +7° →
−6,5°, e così via.

**Limite del test, da tenere presente:** sono varianti sintetiche di una foto
sola. Isolano la matematica, ma non dicono nulla su come si comporta il
rilevatore fra due giorni veri, con luce, espressione e barba diverse. Quella
misura si può fare solo su un archivio reale.

## Cosa c'è dentro

- **Oggi** — la foto del giorno nella cornice, streak, striscia degli ultimi 7 giorni
- **Fotocamera** — guida live con ovale e linee di occhi/bocca, verde quando sei in posizione
- **Allineamento** — prima/dopo animato, con i marker che si agganciano ai bersagli, metriche (rotazione, zoom, quanta cornice resta piena) e ritocco manuale
- **Import dalla galleria** — data letta dall'EXIF, evidenzia i giorni mancanti, uno scatto per giorno
- **Calendario** — mese per mese, miniature nelle cornici nere, streak / record / totale
- **Timelapse** — riproduzione, confronto allineato ↔ grezzo, export WebM reale
- **Traguardi** — badge a 3, 7, 14, 30, 60, 100, 200, 365 giorni
- **Impostazioni** — ora di fine giornata, peso della bocca, alta precisione, riallineamento di tutto l'archivio

### Scelte di prodotto non ovvie

- **Il giorno finisce alle 4:00, non a mezzanotte** (configurabile). Chi si fa il
  selfie tornando a casa alle 2:30 non deve perdere lo streak.
- **Un solo selfie per giorno.** L'import gestisce il conflitto facendoti
  scegliere quale tenere.
- **Le bande nere restano.** Ritagliare per riempire la cornice significherebbe
  tagliare la testa negli scatti troppo ravvicinati.
- **Streak interrotto = tono gentile.** Nessuna schermata punitiva.

## Farla girare

```bash
npm install          # scarica anche modello e runtime wasm in public/mp
npm run dev
```

`npm install` lancia `scripts/setup-assets.mjs`, che copia il runtime wasm dal
pacchetto npm e scarica il modello (~3,7 MB) dal CDN di Google. Se sei dietro un
proxy e il download fallisce l'installazione non si blocca: rilancia con
`npm run setup`. Da lì in poi tutto è servito dal dominio dell'app, offline
compreso.

### Verifica e demo

```bash
npm run dev                                          # in un altro terminale
CHROMIUM_PATH=/percorso/a/chromium npm run verify:alignment -- ./docs
CHROMIUM_PATH=/percorso/a/chromium npm run demo -- ./docs
```

`verify:alignment` stampa la tabella qui sopra e salva il montaggio prima/dopo.
`demo` riempie l'archivio con 16 giorni finti e cattura le schermate. Entrambi
scaricano da soli il volto di prova (un asset pubblico di MediaPipe) in
`public/__test__/`, che è fuori dal repo.

`CHROMIUM_PATH` serve solo se Playwright non ha i suoi browser; altrimenti
omettilo.

## Dati

Tutto in IndexedDB sul dispositivo: nessun account, nessun upload. Di ogni
giorno teniamo **sia l'originale sia l'allineato**, così cambiando i parametri
si può riallineare l'archivio senza rifare le foto (Impostazioni → *Riallinea
tutte le foto*).

Rovescio della medaglia: se svuoti i dati del browser sparisce tutto. Un backup
o un account sono la prima cosa da aggiungere se questa cosa diventa seria.

## Da qui a un'app vera

Questo è un prototipo web funzionante, non una app da store. Per portarla su
iOS/Android:

- **Rilevamento nativo** — Vision (`VNDetectFaceLandmarksRequest`) su iOS,
  ML Kit su Android. La matematica in `faceAlign.ts` si porta pari pari: cambia
  solo da dove arrivano i tre punti.
- **Notifiche vere** — qui il promemoria è solo un mockup dell'interfaccia.
- **Export video** — `MediaRecorder` produce WebM, che iOS non ama. Su nativo si
  usa `AVAssetWriter` per un MP4/H.264.
- **Backup** — vedi sopra.

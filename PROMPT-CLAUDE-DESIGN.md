# Prompt per Claude Design — app "OGGI" (selfie giornaliero allineato)

> Copia tutto il blocco qui sotto e incollalo in Claude Design.

---

Progetta **OGGI**, un'app mobile (iOS, portrait) per scattare un selfie al giorno e vederli
allineati perfettamente uno sull'altro nel tempo. Voglio un **prototipo UI navigabile e ad alta
fedeltà**: tutte le schermate, con foto placeholder e l'allineamento simulato via CSS transform.
Non serve codice funzionante di face detection — serve che si veda e si senta come sarà l'app.

Interfaccia e microcopy **in italiano**.

## 1. Il concetto visivo centrale (la cosa più importante)

Ogni selfie vive dentro una **cornice nera fissa** — stesso rapporto (4:5 verticale), stessi
angoli arrotondati (~28px), sempre identica. Dentro quella cornice la foto viene **trasformata**
in modo diverso ogni giorno, così che occhi e bocca finiscano sempre nella stessa identica
posizione:

- la linea fra i due occhi diventa **orizzontale** (rotazione)
- la distanza fra le pupille diventa **fissa in pixel** (scala)
- il punto medio fra gli occhi cade sempre allo **stesso punto della cornice** (~50% orizzontale, 40% verticale)
- la bocca fa da terzo punto di controllo

Conseguenza fondamentale da rendere visibile nel design: **quando la foto non copre tutta la
cornice, resta il nero.** Bande nere sopra, sotto o ai lati. Non ritagliare per riempire, non
zoomare per nascondere. Il nero fa parte dell'estetica, non è un errore.

Sotto ogni foto, dentro la stessa cornice nera, la **data in bianco, bold, centrata**
(es. `13/7/2026`). Questa è la firma visiva dell'app: rettangolo nero, foto trasformata, data
bianca sotto. Riproducila ovunque compaia un selfie.

Nel prototipo simula tutto questo con foto placeholder diverse dentro un contenitore nero con
`overflow: hidden`, applicando a ognuna `transform` differenti — una ruotata di -4° e ingrandita
al 130%, una rimpicciolita al 70% con bande nere ben visibili sopra e sotto, una traslata di
lato. Devono sembrare scatti veri raddrizzati a forza, non foto già perfette.

## 2. Stile

Moderno, semplice, giocoso — la stessa energia di Duolingo, ma senza mascotte e senza sistema
XP/livelli. Le meccaniche di gioco sono solo: **streak**, **calendario**, **badge**.

**Colori**
- Sfondo: `#FAF8F5` (bianco caldo)
- Cornici foto e testo principale: `#0A0A0A`
- Primario / azione: `#FF6B35` (arancio acceso), ombra bottone `#D14A18`
- Secondario: `#4C6FFF`
- Successo: `#22C55E`
- Badge / oro: `#FFB800`
- Vuoti e disabilitati: `#E7E3DC`

**Tipografia**: un sans geometrico e rotondo, molto grasso per i titoli e i numeri (Nunito
ExtraBold, Baloo 2 o Fredoka). Numeri grandi e orgogliosi — lo streak e le date devono avere
peso visivo.

**Componenti**
- Bottoni "chunky": pieni, angoli 16px, **bordo inferiore solido di 4-5px in una tinta più scura**
  (l'effetto 3D di Duolingo). Al tap si schiacciano: si abbassano di 4px e il bordo sparisce.
- Card con angoli 24px e ombre morbide, mai piatte.
- Icone a contorno spesso (2.5px), arrotondate.
- Micro-animazioni ovunque: molla/rimbalzo, mai easing lineare. Coriandoli sulle celebrazioni.

## 3. Schermate

**A. Oggi (home)**
- In alto: fiamma + numero streak a sinistra, ingranaggio impostazioni a destra.
- Al centro, grande, la cornice nera. Se non hai ancora scattato oggi: placeholder tratteggiato
  con silhouette di un volto e le linee guida di occhi e bocca. Se hai già scattato: la foto di
  oggi allineata, con la data sotto.
- Bottone primario enorme: **"SCATTA IL SELFIE DI OGGI"**.
- Sotto, link secondario: **"Importa dalla galleria"**.
- In fondo, una striscia orizzontale con gli ultimi 7 giorni in miniatura (mini cornici nere;
  i giorni saltati sono quadratini grigi vuoti).
- Variante "già fatto oggi": segno di spunta verde, copy tipo *"Fatto. Ci vediamo domani."*, il
  bottone primario diventa un secondario "Rifai lo scatto".

**B. Fotocamera**
- Viewfinder a tutto schermo (mockato).
- Overlay guida: ovale per il volto, una linea orizzontale all'altezza degli occhi, una per la
  bocca. La guida è arancio quando sei fuori posizione, **verde quando sei allineato**.
- Hint testuale live che cambia: *"Avvicinati"*, *"Raddrizza la testa"*, *"Perfetto, non muoverti"*.
- Shutter grande al centro, timer 3-2-1 opzionale a lato.
- Mostrami due stati: uno "non allineato" (guida arancio) e uno "allineato" (guida verde).

**C. Allineamento (schermata chiave, mostrala con cura)**
- Prima/dopo affiancati: a sinistra lo scatto grezzo, storto e troppo ravvicinato; a destra il
  risultato dentro la cornice nera.
- L'animazione centrale del prodotto: la foto grezza **ruota, scala e trasla** fino a incastrarsi,
  mentre tre marker (due sugli occhi, uno sulla bocca) si agganciano con uno scatto ai loro punti
  target. Se restano bande nere, si vedono.
- Una riga tecnica sotto, piccola e soddisfacente: *"Allineato · rotazione −4° · zoom 1,32×"*.
- Bottoni: **"Salva"** primario, "Riprova" secondario.

**D. Importa dalla galleria**
- Griglia di foto della galleria con la **data letta dai metadati** già mostrata su ogni
  miniatura. I giorni che riempiono un buco del calendario sono evidenziati in arancio con
  etichetta *"Giorno mancante"*.
- Selezione multipla, poi una schermata di riepilogo: *"6 foto · 4 giorni recuperati"*, con la
  gestione del caso "due foto lo stesso giorno" (scegli quale tenere).
- Ogni foto importata passa comunque dalla schermata di allineamento.

**E. Calendario**
- Griglia mensile. Giorno con foto = miniatura quadrata dentro una mini cornice nera. Giorno
  vuoto passato = quadratino grigio. Oggi = bordo arancio che pulsa. Giorni futuri = quasi
  trasparenti.
- Header con nome del mese e frecce, e sotto un contatore: *"23 di 31 giorni · 74%"*.
- Riga di statistiche a tre card: **streak attuale**, **record personale**, **totale selfie**.
- Tap su un giorno → dettaglio a schermo intero con la foto grande, la data, e frecce per
  scorrere avanti e indietro nei giorni (deve essere godibile scorrere velocemente e vedere la
  faccia che resta ferma mentre cambia).

**F. Timelapse**
- Player centrale con la sequenza allineata che scorre in loop, data in sovrimpressione in basso.
- Controlli: velocità (lento / normale / veloce), intervallo (tutto / ultimo mese / ultima
  settimana / personalizzato), toggle "mostra data".
- Bottone chunky **"ESPORTA VIDEO"** → stato di export con barra di avanzamento e poi schermata
  di condivisione.

**G. Traguardi**
- Fiamma grande animata in alto con il numero dello streak.
- Barra di avanzamento verso il prossimo traguardo: *"Ancora 4 giorni al badge 30"*.
- Griglia di badge — 3, 7, 14, 30, 60, 100, 200, 365 giorni. Sbloccati a colori con un riflesso
  metallico; bloccati in grigio con lucchetto.

**H. Celebrazione (modale, dopo il salvataggio)**
- Coriandoli, la fiamma che si accende, il numero che scorre da N a N+1 con animazione a
  contatore, titolo grosso *"7 giorni di fila!"*, bottone "Continua".
- Fai anche la variante "streak interrotto": tono gentile, non punitivo — *"Hai saltato ieri.
  Si riparte da 1, nessun dramma."*

**I. Impostazioni**
- Promemoria giornaliero: toggle + selettore dell'ora, con un **mockup della notifica push**
  in stile iOS (copy diretto e un po' ironico, es. *"12 giorni di fila. Non rovinare tutto adesso."*).
- Formato cornice: 4:5 / 1:1 / 9:16.
- Toggle "mostra la data sulla foto".
- Esporta tutti i dati / backup.

## 4. Tono di voce

Diretto, breve, incoraggiante con una punta di ironia. Mai infantile, mai passivo-aggressivo.
Esempi: *"Non spezzare la catena."* — *"12 giorni. Non male."* — *"Ieri non ti sei fatto vivo."*

## 5. Cosa NON voglio

- Niente ritaglio che riempie la cornice: le bande nere sono volute.
- Niente mascotte, niente XP, niente livelli, niente vite/cuori.
- Niente foto stock sorridenti da brochure: usa ritratti placeholder neutri, scattati male, come
  selfie veri appena svegli.
- Niente gradienti generici viola-blu da template SaaS.

Consegnami tutte le schermate collegate fra loro, mobile-first, con le transizioni animate.

#!/usr/bin/env bash
#
# Prepara tutto quello che si può preparare da riga di comando e apre Xcode.
#
# Fa da solo: controlli sull'ambiente, dipendenze, modello MediaPipe, progetto
# iOS, icone, chiavi dei permessi, build e sincronizzazione.
#
# Quello che resta da fare a mano è solo ciò che richiede il tuo account Apple:
# scegliere il team in Xcode, autorizzare il profilo sull'iPhone, premere play.
#
# Uso:  npm run ios:setup
set -euo pipefail

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1"; exit 1; }

# ---------------------------------------------------------------- controlli

step 'Controllo l’ambiente'

[ "$(uname)" = "Darwin" ] || fail "Serve un Mac: compilare per iOS richiede Xcode."

command -v node >/dev/null || fail "Node non è installato. Scaricalo da https://nodejs.org (versione LTS)."
echo "  node $(node -v)"

DEV_DIR="$(xcode-select -p 2>/dev/null || true)"
case "$DEV_DIR" in
  *Xcode.app*) echo "  xcode  $DEV_DIR" ;;
  *) fail "Gli strumenti da riga di comando puntano a '$DEV_DIR', non a Xcode.
   Sistema con:  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer" ;;
esac

if ! xcodebuild -version >/dev/null 2>&1; then
  fail "Xcode non risponde: probabilmente devi accettare la licenza.
   Sistema con:  sudo xcodebuild -license accept"
fi
echo "  $(xcodebuild -version | head -1)"

if ! command -v pod >/dev/null; then
  if command -v brew >/dev/null; then
    step 'Installo CocoaPods'
    brew install cocoapods
  else
    fail "Manca CocoaPods, che Capacitor usa per le dipendenze native.
   Installa Homebrew da https://brew.sh e poi:  brew install cocoapods"
  fi
fi
echo "  cocoapods $(pod --version)"

# ---------------------------------------------------------------- progetto

step 'Dipendenze e modello per il riconoscimento del viso'
npm install

step 'Compilo l’app web'
# Nel guscio nativo i file sono serviti dalla radice, non da un sottopercorso.
BASE_PATH=/ npm run build

if [ ! -d ios ]; then
  step 'Creo il progetto iOS'
  npx cap add ios
else
  echo
  echo "  Progetto iOS già presente, lo aggiorno."
fi

step 'Icona e schermata di avvio'
if [ -f assets/icon.png ]; then
  # Non blocchiamo il setup se fallisce: senza, l'app funziona lo stesso e si
  # ritrova solo l'icona segnaposto di Capacitor.
  npx --yes @capacitor/assets generate --iosProject ios/App --ios || \
    echo "  Generazione icone fallita, vado avanti (resta l’icona segnaposto)."
else
  echo "  assets/icon.png non trovato, salto."
fi

step 'Sincronizzo e scrivo i permessi'
npx cap sync ios
bash scripts/ios-permissions.sh

step 'Apro Xcode'
npx cap open ios

cat <<'FINE'

  ─────────────────────────────────────────────────────────────
  Fatto tutto quello che potevo fare io. Restano tre cose che
  richiedono il tuo account Apple, e si fanno una volta sola:

  1. In Xcode: pannello a sinistra → progetto App → target App
     → scheda "Signing & Capabilities" → spunta "Automatically
     manage signing" → alla voce Team scegli il tuo Apple ID.
     Se non c’è: Xcode → Settings → Accounts → + → Apple ID.

  2. Collega l’iPhone col cavo, selezionalo come destinazione
     nella barra in alto, e premi ▶.

  3. La prima volta l’iPhone rifiuta di aprire l’app. Vai in
     Impostazioni → Generali → VPN e gestione dispositivo →
     il tuo Apple ID → Autorizza.

  Poi apri l’app e PROVA SUBITO LA FOTOCAMERA: è l’unico punto
  davvero a rischio di tutto il porting.
  ─────────────────────────────────────────────────────────────

FINE

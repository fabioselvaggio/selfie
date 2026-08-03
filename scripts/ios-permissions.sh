#!/usr/bin/env bash
#
# Scrive in Info.plist le spiegazioni dei permessi che iOS mostra all'utente.
#
# Senza queste tre chiavi l'app non chiede il permesso: crasha e basta, al primo
# accesso alla fotocamera. E la review dell'App Store la rifiuta comunque.
#
# È idempotente: si può rilanciare quante volte si vuole, fa parte di
# `npm run ios`.
set -euo pipefail

PLIST="ios/App/App/Info.plist"
PB="/usr/libexec/PlistBuddy"

if [ ! -f "$PLIST" ]; then
  echo "  Info.plist non trovato: lancia prima 'npx cap add ios'."
  exit 0
fi

if [ ! -x "$PB" ]; then
  echo "  PlistBuddy non disponibile (non sei su macOS?): salto."
  exit 0
fi

set_key() {
  local key="$1"
  local value="$2"
  if "$PB" -c "Print :$key" "$PLIST" >/dev/null 2>&1; then
    "$PB" -c "Set :$key $value" "$PLIST"
  else
    "$PB" -c "Add :$key string $value" "$PLIST"
  fi
  echo "  $key"
}

set_key NSCameraUsageDescription \
  "Per scattare il selfie di oggi. Le foto restano sul tuo iPhone."
set_key NSPhotoLibraryUsageDescription \
  "Per importare selfie che hai già scattato e riempire i giorni mancanti."
set_key NSPhotoLibraryAddUsageDescription \
  "Per salvare il video del timelapse nelle tue Foto."

#!/usr/bin/env bash
# Re-scrape mpp.football puis régénère les données du dashboard.
# Nécessite un token valide dans .token.txt (cf. README — "Rafraîchir les données").
set -e
cd "$(dirname "$0")"

if [ ! -s .token.txt ]; then
  echo "✗ .token.txt manquant ou vide. Récupère un token frais (cf. README)."
  exit 1
fi

echo "→ scraping de l'API…"
python3 scraper.py
echo "→ génération de data.js…"
python3 build_data.py
echo "✓ Données à jour. Ouvre index.html (ou recharge la page)."

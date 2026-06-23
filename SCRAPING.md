# Playbook — Comment re-scraper les pronos MPP (de zéro)

> Doc reproductible : explique **comment** les données ont été récupérées, pour
> pouvoir tout refaire (nouvelle saison, autre ligue, ou si le token / l'API
> changent). Le code final est dans [`scraper.py`](scraper.py) ; ici c'est la
> *méthode* qui a permis d'y arriver, étape par étape.
>
> ⚠️ Aucun secret dans ce fichier. Le token ne s'écrit que dans `.token.txt` (gitignored).

---

## TL;DR du raisonnement

1. Le site `mpp.football` est une SPA → **ne pas scraper le HTML**, taper l'**API JSON** derrière.
2. L'API exige un **Bearer token** qu'on récupère dans le `localStorage` une fois connecté.
3. **Google bloque le login OAuth dans un navigateur automatisé** → on pilote le **vrai Chrome** (connexion à la main) via remote-debugging, et on lit le token de là.
4. On découvre les endpoints en **observant le trafic réseau** pendant qu'on navigue.
5. L'endpoint en or donne les pronos+points de **tous** les joueurs par match. On boucle sur tous les matchs joués.
6. Les noms de nations ne sont pas dans l'API → résolus depuis le DOM (les drapeaux encodent le `clubId`).

---

## Prompt prêt à coller (pour un agent IA)

```
Objectif : re-scraper la ligue Famille Lège sur mpp.football (Mon Petit Prono)
et régénérer les CSV du dashboard dans ~/Projets/mpp-dashboard/.

Contexte clé :
- API JSON privée : https://api.mpp.football, auth Bearer token.
- Le token est dans le localStorage du site (clé contenant 'auth0spajs' et
  'mpp.ligue1.fr'), à coller dans .token.txt (gitignored, ~30j de validité).
- Google bloque l'OAuth dans les navigateurs automatisés : il faut piloter le
  VRAI Chrome stable de l'utilisateur via remote-debugging (cf. SCRAPING.md §1),
  l'utilisateur se connecte à la main, puis on lit le token via CDP.
- Le scraper (scraper.py) est déjà écrit : une fois .token.txt à jour, lancer
  ./refresh.sh suffit. Ne ré-explorer l'API que si elle a changé.

Étapes :
1. Vérifier/obtenir un token valide (SCRAPING.md §1).
2. ./refresh.sh
3. Vérifier l'intégrité (SCRAPING.md §5) et ouvrir index.html.

Utilise la skill agent-browser pour le pilotage navigateur.
```

---

## §1 — Obtenir le token (le passage obligé)

Le blocage : cliquer "Continuer avec Google" dans le Chromium d'agent-browser /
Playwright affiche **"This browser or app may not be secure"**. Google refuse
l'OAuth sur les navigateurs pilotés. Solution : utiliser le **vrai Chrome stable**.

```bash
# 1. Lancer une 2e instance de Chrome stable, profil dédié + port de debug.
#    (Chrome 136+ REFUSE --remote-debugging-port sur le profil par défaut →
#     un --user-data-dir séparé est OBLIGATOIRE.)
DBG="$(mktemp -d)/chrome-mpp"
open -na "Google Chrome" --args \
  --remote-debugging-port=9333 \
  --user-data-dir="$DBG" \
  --no-first-run --no-default-browser-check \
  "https://mpp.football/rankings"

# 2. Vérifier que le endpoint CDP répond (UA = vrai Chrome → Google acceptera).
curl -s http://localhost:9333/json/version
```

3. **L'utilisateur se connecte À LA MAIN** dans cette fenêtre (Se connecter →
   Continuer avec Google → compte + 2FA). Attendre le retour sur mpp.football.

4. Lire le token via CDP et l'écrire dans `.token.txt` :

```bash
cat > /tmp/extract_token.js <<'EOF'
(() => {
  const key = Object.keys(localStorage)
    .find(k => k.includes('auth0spajs') && k.includes('mpp.ligue1.fr'));
  return JSON.parse(localStorage.getItem(key)).body.access_token;
})();
EOF
agent-browser --cdp 9333 eval -b "$(base64 < /tmp/extract_token.js)" \
  | grep -oE 'eyJ[A-Za-z0-9._-]+' | head -1 > .token.txt
wc -c .token.txt   # ~2200 caractères attendus
```

> Variante manuelle (sans agent-browser) : se connecter dans Chrome normal,
> ouvrir la console DevTools et exécuter le snippet `copy(...)` du README, puis
> coller dans `.token.txt`.

Sanity check du token : `curl -s -H "Authorization: Bearer $(cat .token.txt)" \
"https://api.mpp.football/challenge-standings/users-standings?challengeId=mpp_challenge_UDH4XJAG&offset=0&limit=3"`
doit renvoyer du JSON avec des joueurs.

---

## §2 — Comment les endpoints ont été découverts

On lance le site connecté, on **navigue** (ouvrir la ligue → onglet Matchs →
cliquer un match), et on **observe le trafic** :

```bash
agent-browser --cdp 9333 network requests | grep "api.mpp.football"
```

C'est comme ça qu'on a repéré `/user-match-forecasts/...` (déclenché en ouvrant
le scoresheet d'un match). Refaire ça **uniquement si l'API a changé**.

---

## §3 — Carte de l'API (état 2026-06)

Base : `https://api.mpp.football` · header `Authorization: Bearer <token>`

| But | Appel |
|-----|-------|
| Joueurs + classement cumulé | `GET /challenge-standings/users-standings?challengeId={CH}&offset=0&limit=50` |
| Classement **d'une journée** (points non cumulés) | idem `&gameWeekNumber=N` |
| Calendrier (journées → matchsIds) | `GET /championship-calendar/8` |
| Résumés matchs (clubs, score, statut) | `POST /championship-match/summaries` body `{"matchesIds":[...]}` ⚠ clé `matchesIds` |
| Détail d'un match (buts, cartons) | `GET /championship-match/{matchId}` |
| **Pronos+points de TOUS les joueurs / match** | `GET /user-match-forecasts/contest/{CH}/match/{matchId}` |

Constantes : `CH = mpp_challenge_UDH4XJAG` (ligue Famille Lège), championnat `8` (CdM 2026).

Structure d'un prono (par joueur) : `{homeScore, awayScore, editedAt, points:{base, exact, extra, bonus, total, rarityLevel}}`.
- `base>0` ⇒ bon résultat · `pred == score réel` ⇒ exact · `total` = points gagnés.

Logique complète (boucle sur matchs joués `period=="fullTime"`, écriture CSV) : voir `scraper.py`.

---

## §4 — Résoudre les noms de nations (l'API ne les donne pas)

L'API ne renvoie que des `clubId` (ex `mpp_championship_club_367`). Deux faits utiles :
- Le drapeau d'une nation = `https://s3.eu-west-1.amazonaws.com/image.mpg/<clubIdNum>.png`
  → dans le DOM, chaque ligne de match a le **drapeau (=clubId) collé au nom**.
- Les headers de scoresheet affichent `ISO3 + Nom` (ex `CZE Tchéquie`).

Méthode utilisée (one-shot, figée dans `data/club_names.json`) :
1. Aller sur l'onglet **Matchs** de la ligue, extraire chaque ligne (2 `img` drapeaux + texte `Équipe A score Équipe B`), en **scrollant** car la liste est virtualisée.
2. Pour les manquants (matchs non joués, rendus différemment), visiter le **scoresheet** du match : `/scoresheet/{matchId}?matchId={matchId}&pageFrom=CompetitionDetails` et lire le header.
3. Valider : 48/48 nations, aucun nom en doublon.

À refaire seulement quand de **nouvelles équipes** apparaissent (phases finales) :
compléter `data/club_names.json` puis relancer `./refresh.sh`.

---

## §5 — Vérifier que le scrape est bon

```bash
python3 - <<'PY'
import csv
from collections import defaultdict
P=list(csv.DictReader(open("data/predictions.csv")))
S={(r["game_week"],r["username"]):int(r["gw_points"]) for r in csv.DictReader(open("data/standings_gw.csv"))}
s=defaultdict(int)
for p in P:
    if p["game_week"]=="1": s[p["username"]]+=int(p["pts_total"])
bad=[u for u,t in s.items() if t!=S.get(("1",u))]
print("J1 cohérence (Σ points/match == classement API) :", "OK ✓" if not bad else f"ÉCART: {bad}")
PY
```

Doit afficher **OK** : c'est la preuve que chaque prono a été correctement attribué.

---

## Pièges rencontrés (pour gagner du temps)

- L'`eval` d'agent-browser **garde le contexte** entre appels → `const x` re-déclaré plante. Wrapper dans une IIFE `(() => {...})()`.
- `POST /championship-match/summaries` : la clé du body est `matchesIds` (pas `matchIds`) — sinon erreur Zod.
- Les matchs des phases finales reviennent **`null`** dans les résumés (équipes pas encore connues) → filtrer.
- La liste des matchs dans l'UI est **virtualisée** : `scrollTop` en JS ne la bouge pas, mais `agent-browser scroll` oui.
- `gameWeekNumber=N` = points **de la journée N**, pas le cumul. Le cumul/les rangs sont recalculés dans `app.js`.

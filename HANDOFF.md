# Handoff — mpp-dashboard

> Note de passation pour un agent IA qui reprend ce projet.
> Date : 2026-06-23. Lis d'abord **[README.md](README.md)** (usage, structure,
> refresh) — ce document ne le duplique pas, il ajoute le *contexte*, les
> *décisions*, l'*état actuel* et les *pistes*.

## En une phrase

Dashboard de stats pour la ligue **Famille Lège** sur [mpp.football](https://mpp.football)
(Mon Petit Prono, championnat Coupe du Monde 2026) : on scrape l'API JSON privée
→ CSV → dashboard HTML/JS auto-contenu. **C'est fonctionnel et terminé** pour une
v1 ; la suite = enrichir + maintenir à chaque journée.

## État actuel (ce qui marche)

- Pipeline complet opérationnel : `scraper.py` → `data/*.csv` → `build_data.py` → `data.js` → `index.html`.
- `./refresh.sh` enchaîne scraper + build. Testé de bout en bout.
- Dashboard : 7 sections (cf. README), thème broadcast sombre+or, Chart.js vendorisé (`vendor/`), s'ouvre en double-clic (file://), marche hors-ligne.
- Données actuelles : **journée 2/9** de la CdM → 44 matchs joués, 743 pronos, 17 joueurs, 48 nations résolues.
- Intégrité vérifiée : `Σ points par match == classement API par journée` (0 écart sur les 17 joueurs).

## Données — modèle

`data/predictions.csv` est la **table de faits** (1 ligne = 1 joueur × 1 match).
`app.js` recalcule TOUT côté client à partir de là (cumuls, rangs par journée,
précision, insights, duel). Donc pour ajouter une stat : pas besoin de retoucher
le scraper, juste `app.js`. Schéma des colonnes : voir l'en-tête du CSV et la
section "Données" du README.

## Détails techniques non triviaux (à connaître avant de toucher le scraper)

- **API** : `https://api.mpp.football`, auth `Authorization: Bearer <token>`.
- **Endpoint clé** : `GET /user-match-forecasts/contest/{challengeId}/match/{matchId}`
  = pronos + points de **tous** les joueurs de la ligue pour un match.
- **Résumés matchs** : `POST /championship-match/summaries` body `{"matchesIds":[...]}`
  (attention : la clé est `matchesIds`, pas `matchIds`) → clubs, score réel, journée, statut.
- **Calendrier** : `GET /championship-calendar/8` → `gameWeeks[n].matchesIds`.
- **Classement par journée** : `/challenge-standings/users-standings?challengeId=...&gameWeekNumber=N`
  renvoie les points **de cette journée** (PAS cumulés). Le cumul est recalculé dans `app.js`.
- **IDs** : ligue Famille Lège = `mpp_challenge_UDH4XJAG` ; championnat CdM 2026 = `8`. (constantes en haut de `scraper.py`)
- **Noms des nations** : l'API ne renvoie que des `clubId` (ex `mpp_championship_club_367`), jamais les noms.
  Ils ont été résolus **une seule fois** (via le DOM de la vue Matchs + headers de scoresheets) et
  figés dans `data/club_names.json` (versionné). Le scraper le charge pour remplir `home_team`/`away_team`.
  Les nouvelles équipes (phases finales) ne sont pas encore mappées → à compléter le moment venu (cf. Pistes).
- **Drapeau** d'une nation = `https://s3.eu-west-1.amazonaws.com/image.mpg/<clubIdNumérique>.png`.

## Authentification — LE point sensible

- Le token est un JWT dans le `localStorage` du site (clé `@@auth0spajs@@...mpp.ligue1.fr`), validité ~30 jours.
- Il vit dans **`.token.txt`** à la racine — **gitignored, jamais committé. Ne le mets nulle part de versionné.**
- **Google bloque l'OAuth dans les navigateurs automatisés** ("This browser or app may not be secure").
  La connexion Google ne marche donc PAS via le Chromium d'agent-browser/Playwright.
  Contournement utilisé : lancer le **vrai Chrome stable** en 2ᵉ instance, profil dédié + `--remote-debugging-port`
  (Chrome 136+ interdit le remote-debug sur le profil par défaut → user-data-dir séparé obligatoire),
  l'utilisateur se connecte à la main, puis on s'y branche en CDP pour lire le token.
- Procédure de renouvellement du token (console DevTools) : voir README → "Rafraîchir les données".
- **Pour tout re-scraper de zéro** (méthode complète, pas-à-pas, reproductible) : voir [`SCRAPING.md`](SCRAPING.md).

## Ce qui N'A PAS été fait / limites connues

- Le graph "Course au sommet" n'a que **2 points** (J1, J2) — normal, la CdM est à la J2/9. Se densifiera.
- Seules les nations des phases de poules (48) sont dans `club_names.json`. Les matchs à élimination directe
  (journées 4→9) n'ont pas encore d'équipes définies côté MPP, donc rien à mapper pour l'instant.
- Pas de tests automatisés. Pas de CI. Le projet vient d'être `git init` (commit initial inclus).
- Avatars des joueurs non récupérés (l'API les expose via `avatarUrl` dans les standings si besoin).

## Pistes proposées (l'utilisateur n'a pas encore tranché)

L'utilisateur a été invité à choisir parmi : nouveaux charts (heatmap des pronos,
clustering "qui se ressemble", courbe chance/malchance vs les cotes des matchs),
récupération des avatars, ou laisser tel quel. **Demander sa priorité avant de coder.**
Idées techniques déjà identifiées :
- Les cotes sont dispo (`quotations`/`stats.bets` dans les résumés de match) → permettrait un axe "value betting / malchance".
- Le détail des matchs (`/championship-match/<id>`) contient `eventsTimeline` (buts, cartons, homme du match).

## Comment lancer / rafraîchir

Voir README. En bref : `./refresh.sh` (nécessite `.token.txt` valide), puis ouvrir/recharger `index.html`.

## Suggested skills (pour l'agent suivant)

- **brainstorming** (`superpowers:brainstorming`) — avant d'ajouter des features/charts, cadrer le besoin avec l'utilisateur.
- **frontend-design** (`frontend-design:frontend-design`) — pour toute évolution visuelle du dashboard (garder la cohérence du thème broadcast sombre+or, Anton + Archivo + JetBrains Mono).
- **agent-browser** (`agent-browser`) — pour ré-extraire le token, mapper de nouvelles nations depuis l'UI, ou inspecter de nouveaux endpoints API. Rappel : Google bloque l'auto-login → passer par le vrai Chrome en CDP.
- **smart-commit** — pour committer proprement les évolutions.
- **verification-before-completion** (`superpowers:verification-before-completion`) — vérifier le rendu réel (ouvrir le dashboard, screenshot) avant d'affirmer que c'est fini.

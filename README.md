# Famille Lège — Dashboard MPP · Coupe du Monde 2026

Tableau de bord de stats pour la ligue **Famille Lège** sur
[Mon Petit Prono](https://mpp.football) (championnat Coupe du Monde 2026).

Les données (pronos de chaque joueur + points par match) sont récupérées via
l'API JSON privée de mpp.football, stockées en CSV, puis affichées dans un
dashboard HTML/JS avec plein de charts.

## Voir le dashboard

Double-clique sur **`index.html`** (ou ouvre-le dans un navigateur). Tout est
auto-contenu : Chart.js est embarqué (`vendor/`) et les données aussi
(`data.js`), donc ça marche même hors-ligne, sans serveur.

### Sections

| # | Section | Contenu |
|---|---------|---------|
| 01 | Classement | Podium + tableau complet avec mouvements de rang |
| 02 | Course au sommet | Évolution du rang de chacun, journée par journée (rang 1 en haut) |
| 03 | Points cumulés | Trajectoire des points (cumulé ou par journée) |
| 04 | Rois de la journée | Le meilleur joueur de chaque journée |
| 05 | Précision | Bons pronos % vs scores exacts % (taille = points) |
| 06 | Le saviez-vous | Faits marquants : plus gros coup, piège, carton plein… |
| 07 | Duel | Comparaison tête-à-tête de deux joueurs |

## Données (`data/`)

| Fichier | Description |
|---------|-------------|
| `predictions.csv` | **Table de faits** — 1 ligne = 1 joueur × 1 match (prono, score réel, points, bon/exact) |
| `matches.csv` | 1 ligne par match (équipes, score, journée) |
| `standings_gw.csv` | Classement par journée (source API) |
| `users.csv` | Joueurs de la ligue + classement cumulé |
| `clubs.csv` | clubId → nation |
| `club_names.json` | Mapping clubId → nom de nation (résolu une fois, versionné) |

Vérifié : la somme des points par match = exactement le classement par journée
renvoyé par l'API (0 écart).

## Rafraîchir les données (après de nouvelles journées)

```bash
./refresh.sh        # = python3 scraper.py && python3 build_data.py
```

Le scraper a besoin d'un **token d'accès** valide dans `.token.txt`
(gitignored). Le token actuel expire ~30 jours après création. Pour en
récupérer un frais quand il a expiré :

1. Connecte-toi sur https://mpp.football dans Chrome.
2. Ouvre la console DevTools (⌥⌘J) et colle :
   ```js
   copy(JSON.parse(localStorage.getItem(
     Object.keys(localStorage).find(k => k.includes('auth0spajs') && k.includes('mpp.ligue1.fr'))
   )).body.access_token)
   ```
   (le token est copié dans le presse-papier)
3. Colle-le dans `.token.txt`, puis lance `./refresh.sh`.

> ⚠️ `.token.txt` est un secret : il est dans `.gitignore`, ne le committe jamais.

> 📘 Pour comprendre/refaire **tout le scraping de zéro** (auth, découverte de
> l'API, endpoints, résolution des nations) : voir [`SCRAPING.md`](SCRAPING.md).

## Paramètres

Dans `scraper.py` :
- `CHALLENGE_ID = "mpp_challenge_UDH4XJAG"` — la ligue Famille Lège
- `CHAMPIONSHIP_ID = 8` — la Coupe du Monde 2026

## Structure

```
mpp-dashboard/
├── index.html        # le dashboard
├── styles.css        # thème broadcast sombre + or
├── app.js            # calculs + charts (tout côté client)
├── data.js           # données embarquées (généré)
├── scraper.py        # API mpp.football → CSV
├── build_data.py     # CSV → data.js
├── refresh.sh        # scraper + build
├── data/             # CSV + club_names.json
└── vendor/           # chart.js
```

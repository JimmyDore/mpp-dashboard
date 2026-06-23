# TODO — pistes d'amélioration

> Feedbacks issus de l'usage réel (2026-06-23). Dashboard public sur
> https://mppstats.jimmydore.fr, partagé aux **membres de la ligue** (souvent **sur mobile**).

## ✅ Livré le 2026-06-23

- **#1 — Audience = toute la ligue.** Le « toi / ton » n'est plus figé sur Djimitraillette.
  Sélecteur « 👤 C'est toi ? » dans le hero (mémorisé en `localStorage`) + paramètre d'URL
  `?me=Pseudo` (pour envoyer un lien perso à chacun). Sans choix → **vue neutre** (pas de « toi »,
  stats de ligue). Tout se re-render au changement : hero, classement/podium/badge TOI, couleurs,
  charts, faits marquants, duel.
- **#2 — Vue mobile.** Refonte responsive (breakpoints 880/720/560/400) : nav scrollable,
  stats 2-par-ligne, table compacte (barre + colonne Mvt masquées), charts adaptés, grilles 1 colonne,
  duel lisible. Vérifié jusqu'à 320px (zéro débordement horizontal).
- **#3 — Tableau classement.** La valeur ne chevauche plus la barre dorée : piste fine + nombre
  dans sa propre colonne, lisible.
- **#4 — Charts match par match.** « Course au sommet » et « Points cumulés » tracent désormais
  l'évolution **match par match** (44 points chronologiques) au lieu de J1→J2, avec repères de
  journée (J1/J2). Toggle « Cumulé » (par match) / « Par journée ».
- **#5 — Nouveaux faits marquants** (en plus des 6 existants) : À contre-courant (pronos rares),
  Au plus près (erreur de buts mini), Le sniper du nul, Les sosies (pronos identiques),
  Score fétiche, First blood (leader J1), Ton rival (perso), Ton pic de forme (perso).

Bonus : footer affiche la date de mise à jour des données ; échappement HTML des pseudos/équipes.

## 💡 Idées restantes (pour plus tard)

Toutes calculables côté client depuis `data/predictions.csv` (cf. HANDOFF) :

- **Monsieur Régularité / Les montagnes russes** — écart-type des points par journée
  (peu pertinent à 2 journées, à activer quand il y en aura plus).
- **La remontada / La dégringolade** — plus grosse progression / chute de rang sur une période.
- **Le mur** — prono le moins de buts en moyenne (pendant de « L'attaquant »).
- **Le spécialiste** — meilleur pronostiqueur sur les matchs d'une nation donnée.
- **Clustering « qui se ressemble »** — généraliser « Les sosies » en regroupant les profils proches.
- **Axe value betting / (mal)chance** — les cotes sont dispo (`quotations`/`stats.bets` dans les
  résumés de match) → courbe chance vs cotes.
- **Avatars des joueurs** — exposés via `avatarUrl` dans les standings.

## Notes

- Recalcul **côté client** dans `app.js`, pas besoin de retoucher le scraper.
- Cohérence du thème : broadcast sombre + or, Anton / Archivo / JetBrains Mono.

#!/usr/bin/env python3
"""
Scraper Mon Petit Prono (mpp.football) — ligue "Famille Lège".

Récupère via l'API JSON privée :
  - les joueurs de la ligue + leur classement cumulé
  - le calendrier du championnat (Coupe du Monde 2026, championship 8)
  - pour chaque match joué : le score réel + le prono de chaque joueur + les points

Produit des CSV dans data/ :
  - predictions.csv      (table de faits : 1 ligne = 1 joueur x 1 match)
  - matches.csv          (1 ligne par match)
  - standings_gw.csv     (classement par journée, source API)
  - users.csv            (joueurs de la ligue)
  - clubs.csv            (clubId -> nom de nation, rempli si dispo)

Le token d'accès (Bearer) est lu depuis le fichier pointé par MPP_TOKEN_FILE
(par défaut le scratchpad de la session). Il n'est jamais commité.

Usage:
    MPP_TOKEN_FILE=/chemin/token.txt python3 scraper.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import csv

BASE = "https://api.mpp.football"
CHALLENGE_ID = "mpp_challenge_UDH4XJAG"   # ligue "Famille Lège"
CHAMPIONSHIP_ID = 8                        # Coupe du Monde 2026

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
TOKEN_FILE = os.environ.get("MPP_TOKEN_FILE", os.path.join(HERE, ".token.txt"))


def load_token():
    with open(TOKEN_FILE) as f:
        return f.read().strip()


TOKEN = load_token()

# clubId -> nom de nation (résolu une fois depuis l'UI, versionné dans data/)
CLUB_NAMES = {}
_names_path = os.path.join(DATA, "club_names.json")
if os.path.exists(_names_path):
    CLUB_NAMES = json.load(open(_names_path, encoding="utf-8"))


def club_name(cid):
    return CLUB_NAMES.get(cid, cid)


def api(path, method="GET", body=None, retries=3):
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "Authorization": "Bearer " + TOKEN,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(BASE + path, method=method, headers=headers, data=data)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (401, 403):
                print(f"!! Auth error {e.code} sur {path} — token expiré ?", file=sys.stderr)
                raise
            time.sleep(1 + attempt)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1 + attempt)
    raise RuntimeError(f"API echec {path}: {last}")


def outcome(h, a):
    if h is None or a is None:
        return ""
    return "H" if h > a else ("A" if a > h else "D")


def main():
    os.makedirs(DATA, exist_ok=True)

    # 1) Joueurs de la ligue + classement cumulé
    print("→ standings (joueurs)…")
    standings = api(f"/challenge-standings/users-standings?challengeId={CHALLENGE_ID}&offset=0&limit=50")
    users = {}
    for s in standings["standings"]:
        u = s["user"]
        users[u["id"]] = {
            "user_id": u["id"],
            "username": u.get("username", ""),
            "first_name": (u.get("firstName") or "").strip(),
            "level": u.get("level", ""),
            "cumul_points": s["ranking"].get("points"),
            "cumul_rank": s["ranking"].get("rank"),
            "cumul_good": s["ranking"].get("goodForecasts"),
            "cumul_exact": s["ranking"].get("exactForecasts"),
        }
    print(f"   {len(users)} joueurs")

    # 2) Calendrier → matchIds par journée
    print("→ calendrier…")
    cal = api(f"/championship-calendar/{CHAMPIONSHIP_ID}")
    gw_matches = {int(gw): g["matchesIds"] for gw, g in cal["gameWeeks"].items()}
    all_ids = [m for gw in sorted(gw_matches) for m in gw_matches[gw]]
    print(f"   {len(gw_matches)} journées, {len(all_ids)} matchs")

    # 3) Résumés des matchs (clubs + score réel + statut) — par lots
    print("→ résumés des matchs…")
    summ = {}
    for i in range(0, len(all_ids), 50):
        summ.update(api("/championship-match/summaries", "POST", {"matchesIds": all_ids[i:i + 50]}))
    played = [mid for mid, s in summ.items() if s and s.get("period") == "fullTime"]
    print(f"   {len(played)} matchs joués (fullTime)")

    # 4) clubs connus (best effort — rempli plus tard par resolve_names)
    clubs = {}
    for s in summ.values():
        if not s:
            continue
        for side in ("home", "away"):
            cid = s[side]["clubId"]
            clubs.setdefault(cid, "")

    # 5) Pronos + points par match joué
    print("→ pronos par match…")
    pred_rows = []
    match_rows = []
    for n, mid in enumerate(played, 1):
        s = summ[mid]
        hs, as_ = s["home"].get("score"), s["away"].get("score")
        match_rows.append({
            "match_id": mid,
            "game_week": s["gameWeekNumber"],
            "date": s.get("date", ""),
            "period": s.get("period", ""),
            "home_club_id": s["home"]["clubId"],
            "away_club_id": s["away"]["clubId"],
            "home_team": club_name(s["home"]["clubId"]),
            "away_team": club_name(s["away"]["clubId"]),
            "home_score": hs,
            "away_score": as_,
            "result": outcome(hs, as_),
        })
        fc = api(f"/user-match-forecasts/contest/{CHALLENGE_ID}/match/{mid}")
        for uid, f in fc.items():
            if not f or f.get("homeScore") is None:
                continue
            ph, pa = f.get("homeScore"), f.get("awayScore")
            pts = f.get("points") or {}
            is_exact = int(ph == hs and pa == as_)
            is_good = int(outcome(ph, pa) == outcome(hs, as_))
            pred_rows.append({
                "match_id": mid,
                "game_week": s["gameWeekNumber"],
                "date": s.get("date", ""),
                "home_club_id": s["home"]["clubId"],
                "away_club_id": s["away"]["clubId"],
                "home_team": club_name(s["home"]["clubId"]),
                "away_team": club_name(s["away"]["clubId"]),
                "home_score": hs,
                "away_score": as_,
                "result": outcome(hs, as_),
                "user_id": uid,
                "username": users.get(uid, {}).get("username", uid),
                "pred_home": ph,
                "pred_away": pa,
                "pts_base": pts.get("base", 0),
                "pts_exact": pts.get("exact", 0),
                "pts_extra": pts.get("extra", 0),
                "pts_bonus": pts.get("bonus", 0),
                "pts_total": pts.get("total", 0),
                "rarity_level": pts.get("rarityLevel", 0),
                "is_good": is_good,
                "is_exact": is_exact,
                "edited_at": f.get("editedAt", ""),
            })
        if n % 10 == 0:
            print(f"   {n}/{len(played)}")

    # 6) Classement par journée (source API)
    print("→ classements par journée…")
    max_gw = max((r["game_week"] for r in match_rows), default=0)
    sgw_rows = []
    for gw in range(1, max_gw + 1):
        st = api(f"/challenge-standings/users-standings?challengeId={CHALLENGE_ID}&offset=0&limit=50&gameWeekNumber={gw}")
        for s in st["standings"]:
            u = s["user"]
            r = s["ranking"]
            sgw_rows.append({
                "game_week": gw,
                "user_id": u["id"],
                "username": u.get("username", ""),
                "gw_points": r.get("points"),
                "gw_good": r.get("goodForecasts"),
                "gw_exact": r.get("exactForecasts"),
                "gw_calculated": r.get("calculatedForecasts"),
                "gw_rank": r.get("rank"),
            })

    # 7) Écriture des CSV
    def write_csv(name, rows, cols):
        path = os.path.join(DATA, name)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            for r in rows:
                w.writerow(r)
        print(f"   ✓ {name} ({len(rows)} lignes)")

    print("→ écriture CSV…")
    write_csv("predictions.csv", pred_rows, list(pred_rows[0].keys()))
    write_csv("matches.csv", match_rows, list(match_rows[0].keys()))
    write_csv("standings_gw.csv", sgw_rows, list(sgw_rows[0].keys()))
    write_csv("users.csv", list(users.values()), list(next(iter(users.values())).keys()))
    write_csv("clubs.csv", [{"club_id": c, "name": club_name(c)} for c in sorted(clubs)],
              ["club_id", "name"])

    # méta
    json.dump({
        "challenge_id": CHALLENGE_ID,
        "championship_id": CHAMPIONSHIP_ID,
        "n_users": len(users),
        "n_matches_played": len(played),
        "max_game_week": max_gw,
        "generated_unix": int(time.time()),
    }, open(os.path.join(DATA, "meta.json"), "w"), indent=2)
    print("Terminé.")


if __name__ == "__main__":
    main()

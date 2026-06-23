#!/usr/bin/env python3
"""
Transforme les CSV de data/ en un fichier data.js embarqué
(window.MPP_DATA = {...}) pour que index.html s'ouvre sans serveur (file://).

Usage: python3 build_data.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


def read(name, casts=None):
    casts = casts or {}
    rows = []
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            for k, fn in casts.items():
                if r.get(k) not in (None, ""):
                    try:
                        r[k] = fn(r[k])
                    except (ValueError, TypeError):
                        pass
            rows.append(r)
    return rows


def main():
    int_ = int
    predictions = read("predictions.csv", {
        "game_week": int_, "home_score": int_, "away_score": int_,
        "pred_home": int_, "pred_away": int_, "pts_base": int_, "pts_exact": int_,
        "pts_extra": int_, "pts_bonus": int_, "pts_total": int_, "rarity_level": int_,
        "is_good": int_, "is_exact": int_,
    })
    matches = read("matches.csv", {
        "game_week": int_, "home_score": int_, "away_score": int_,
    })
    standings_gw = read("standings_gw.csv", {
        "game_week": int_, "gw_points": int_, "gw_good": int_, "gw_exact": int_,
        "gw_calculated": int_, "gw_rank": int_,
    })
    users = read("users.csv", {
        "level": int_, "cumul_points": int_, "cumul_rank": int_,
        "cumul_good": int_, "cumul_exact": int_,
    })
    clubs = read("clubs.csv")
    meta = json.load(open(os.path.join(DATA, "meta.json"), encoding="utf-8"))

    payload = {
        "predictions": predictions,
        "matches": matches,
        "standingsGw": standings_gw,
        "users": users,
        "clubs": clubs,
        "meta": meta,
    }
    out = os.path.join(HERE, "data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// Généré par build_data.py — ne pas éditer à la main\n")
        f.write("window.MPP_DATA = ")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    size = os.path.getsize(out)
    print(f"✓ data.js écrit ({size//1024} Ko, {len(predictions)} pronos, "
          f"{len(matches)} matchs, {len(users)} joueurs)")


if __name__ == "__main__":
    main()

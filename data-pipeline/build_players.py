"""Builds public/data/players.json from the Kaggle dataset "NBA Stats (1947-present)"
(by Sumitro Datta, data originally from Basketball-Reference).

Put these CSVs into data-pipeline/raw/ :
  Player Per Game.csv, Advanced.csv, All-Star Selections.csv, Player Award Shares.csv

Run:  python data-pipeline/build_players.py
The rating formula is documented in DATA_SOURCES.md.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from franchises import TEAM_TO_FRANCHISE, TEAM_NAMES, TEAM_COLORS, ALL_POSITION_PLAYERS

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "public" / "data" / "players.json"
# Optional overrides (used for testing):  --raw <dir>  --out <file>
for flag in ("--raw", "--out"):
    if flag in sys.argv:
        value = Path(sys.argv[sys.argv.index(flag) + 1])
        RAW, OUT = (value, OUT) if flag == "--raw" else (RAW, value)

# The Kaggle files may name columns slightly differently; map them to our names.
ALIASES = {"tm": "team", "team_abbr": "team", "mp_per_g": "mp_per_game", "pts_per_g": "pts_per_game",
           "trb_per_g": "trb_per_game", "ast_per_g": "ast_per_game", "stl_per_g": "stl_per_game",
           "blk_per_g": "blk_per_game", "ts_pct": "ts_percent", "ws/48": "ws_48"}
POSITIONS = ["PG", "SG", "SF", "PF", "C"]
PLAYERS_PER_COMBO = 5  # top N stints per franchise-decade
SECONDARY_SHARE = 0.65  # about this share of players gets a secondary position
MIN_SEASON_MINUTES = 500

# Column names we need. If Kaggle renames something, the check below tells you what is missing.
REQUIRED = {
    "Player Per Game.csv": ["player", "season", "team", "pos", "g", "mp_per_game", "pts_per_game",
                            "trb_per_game", "ast_per_game", "stl_per_game", "blk_per_game"],
    "Advanced.csv": ["player", "season", "team", "mp", "ts_percent", "bpm", "ws_48"],
    "All-Star Selections.csv": ["player", "season"],
    "Player Award Shares.csv": ["player", "season", "award", "share"],
}


def load(name):
    path = RAW / name
    if not path.exists():
        sys.exit(f"Missing file: {path}\nDownload the Kaggle dataset and put the CSVs into data-pipeline/raw/")
    df = pd.read_csv(path)
    df.columns = [ALIASES.get(c.strip().lower(), c.strip().lower()) for c in df.columns]
    missing = [c for c in REQUIRED[name] if c not in df.columns]
    if missing:
        sys.exit(f"{name}: missing columns {missing}. Found: {list(df.columns)}")
    return df


def zscore(s):
    return (s - s.mean()) / (s.std(ddof=0) or 1)


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console: names like Dončić
    pg = load("Player Per Game.csv")
    adv = load("Advanced.csv")
    allstar = load("All-Star Selections.csv")
    awards = load("Player Award Shares.csv")

    # 1. Only single-team rows (drop "TOT"/"2TM" totals) in 1960+ seasons.
    for df in (pg, adv):
        df.drop(df[df["team"].isin(["TOT", "2TM", "3TM", "4TM", "5TM"])].index, inplace=True)
    pg = pg[pg["season"] >= 1960]
    adv = adv[adv["season"] >= 1960]

    df = pg.merge(adv[["player", "season", "team", "mp", "ts_percent", "bpm", "ws_48"]],
                  on=["player", "season", "team"], how="inner")
    df = df[df["mp"] >= MIN_SEASON_MINUTES].copy()
    df["franchise"] = df["team"].map(TEAM_TO_FRANCHISE)
    df = df.dropna(subset=["franchise", "pos"])  # some rows have no position listed
    df["decade"] = df["season"] // 10 * 10  # season = ending year, 1996-97 -> 1997 -> 1990s

    # 2. Era-adjusted score: z-scores against the league in that very season.
    stl_known = df["season"] >= 1974  # steals/blocks were not tracked before 1973-74
    parts = {}
    for col, w in [("pts_per_game", 1.0), ("trb_per_game", 0.7), ("ast_per_game", 0.8),
                   ("stl_per_game", 0.4), ("blk_per_game", 0.4), ("ts_percent", 0.6),
                   ("bpm", 1.5), ("ws_48", 1.0)]:
        z = df.groupby("season")[col].transform(zscore)
        if col in ("stl_per_game", "blk_per_game"):
            z = z.where(stl_known)
            w_series = stl_known.astype(float) * w
        else:
            w_series = pd.Series(w, index=df.index)
        parts[col] = (z.fillna(0) * w_series, w_series)
    num = sum(p[0] for p in parts.values())
    den = sum(p[1] for p in parts.values())
    df["score"] = num / den  # re-normalised so missing stats don't punish old players

    # 3. Stint = player + franchise + decade. Minutes-weighted average, plus a peak bonus.
    def stint(g):
        w = g["mp"]
        def avg(c):  # games-weighted mean over seasons where the stat exists (steals/blocks start 1973-74)
            ok = g[c].notna()
            return (g.loc[ok, c] * g.loc[ok, "g"]).sum() / g.loc[ok, "g"].sum() if ok.any() else float("nan")
        pos_counts = g["pos"].str.split("-").explode().value_counts(normalize=True)
        main = g["pos"].str.split("-").str[0].value_counts().index[0]
        alt = [p for p in pos_counts.index if p != main and p in POSITIONS and pos_counts[p] >= 0.2]
        team = g.groupby("team")["g"].sum().idxmax()  # historical abbreviation, e.g. SEA for the Sonics years
        return pd.Series({
            "team": team,
            "ppg": avg("pts_per_game"), "rpg": avg("trb_per_game"), "apg": avg("ast_per_game"),
            "spg": avg("stl_per_game"), "bpg": avg("blk_per_game"),
            "score": (g["score"] * w).sum() / w.sum() * 0.8 + g["score"].max() * 0.2,
            "minutes": w.sum(), "main": main, "alt": alt, "seasons": len(g),
        })

    stints = df.groupby(["player", "franchise", "decade"]).apply(stint, include_groups=False).reset_index()
    stints = stints[stints["main"].isin(POSITIONS)]

    # 4. Rating 40-99 by percentile of the composite score.
    stints["rating"] = (40 + stints["score"].rank(pct=True) ** 3 * 59).round().astype(int)

    # 5. Fans value 1-100 from All-Star picks, MVP / All-NBA style award shares and career length.
    stars = allstar.groupby("player").size()
    mvp = awards[awards["award"].str.contains("mvp", case=False)].groupby("player")["share"].sum()
    career = df.groupby("player")["season"].nunique()
    fans = (stars.reindex(career.index).fillna(0) * 4 + mvp.reindex(career.index).fillna(0) * 8 + career * 1.5)
    fans = (fans / fans.max() * 99 + 1).round().astype(int)
    stints["fans"] = stints["player"].map(fans).fillna(1).astype(int)

    # 5b. Secondary positions. Data labels ("SG-SF", >=20 % of games) only cover a minority, so we add the
    # neighbouring position (PG-SG-SF-PF-C) whose typical stat profile the player resembles most.
    NEIGHBOURS = {"PG": ["SG"], "SG": ["PG", "SF"], "SF": ["SG", "PF"], "PF": ["SF", "C"], "C": ["PF"]}
    feats = stints[["rpg", "apg", "bpg", "spg"]].fillna(0)
    z = (feats - feats.mean()) / feats.std()
    centroid = {m: z[stints["main"] == m].mean() for m in POSITIONS}
    ratio = {}
    for i, r in stints.iterrows():
        d_own = ((z.loc[i] - centroid[r.main]) ** 2).sum() ** 0.5
        best = min(NEIGHBOURS[r.main], key=lambda nb: ((z.loc[i] - centroid[nb]) ** 2).sum() ** 0.5)
        ratio[i] = (best, ((z.loc[i] - centroid[best]) ** 2).sum() ** 0.5 / max(d_own, 1e-6))
    cut = sorted(v[1] for v in ratio.values())[int(len(ratio) * SECONDARY_SHARE)]
    for i, (nb, rt) in ratio.items():
        if rt <= cut and nb not in stints.at[i, "alt"]:
            stints.at[i, "alt"] = list(stints.at[i, "alt"]) + [nb]
    stints["alt"] = stints["alt"].apply(lambda a: a[:2])

    # 6. Archetype tags (used by the chemistry engine in phase 3).
    def tags(r):
        t = []
        if r.bpg >= 1.5: t.append("rim_protector")
        if r.apg >= 6: t.append("playmaker")
        if r.rpg >= 9: t.append("rebounder")
        if r.ppg >= 22: t.append("scorer")
        if r.spg >= 1.5: t.append("defender")
        if r.ppg >= 16 and r.main in ("PG", "SG", "SF"): t.append("shooter")
        return t
    stints["tags"] = stints.apply(tags, axis=1)

    # 7. Keep the best stints per franchise-decade.
    stints["rank_key"] = stints["rating"] * stints["minutes"]
    top = (stints.sort_values("rank_key", ascending=False)
           .groupby(["franchise", "decade"]).head(PLAYERS_PER_COMBO))

    # Re-rate within the final pool: the first rating spans ALL stints (role players too), so the
    # selected best-of-franchise players would cluster at 90+. Spreading over the pool keeps 99 rare.
    top = top.copy()
    top["rating"] = (50 + top["score"].rank(pct=True) ** 1.6 * 49).round().astype(int)

    players = []
    for r in top.itertuples():
        players.append({
            "id": f"{r.franchise}-{int(r.decade)}-{r.player.lower().replace(' ', '-').replace('.', '').replace(chr(39), '')}",
            "name": r.player, "franchise": r.franchise, "decade": int(r.decade),
            "team": r.team,
            "pos": [r.main], "altPos": list(r.alt),
            "ppg": round(r.ppg, 1), "rpg": round(r.rpg, 1), "apg": round(r.apg, 1),
            "spg": None if pd.isna(r.spg) else round(r.spg, 1),
            "bpg": None if pd.isna(r.bpg) else round(r.bpg, 1),
            "fans": int(r.fans), "rating": int(r.rating), "tags": r.tags,
            **({"allPos": True} if r.player in ALL_POSITION_PLAYERS else {}),
        })
    players.sort(key=lambda p: (p["franchise"], p["decade"], -p["rating"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "meta": {"source": "Kaggle: NBA Stats (1947-present) by Sumitro Datta / Basketball-Reference",
                 "generated": datetime.now(timezone.utc).isoformat(), "version": 1},
        "players": players}, ensure_ascii=False, indent=1), encoding="utf-8")

    used = sorted({p["team"] for p in players})
    teams = {t: {"name": TEAM_NAMES.get(t, t), "franchise": TEAM_TO_FRANCHISE[t],
                 **({"primary": TEAM_COLORS[t][0], "secondary": TEAM_COLORS[t][1]} if t in TEAM_COLORS else {})} for t in used}
    OUT.with_name("teams.json").write_text(json.dumps(teams, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Wrote {len(players)} players to {OUT} and {len(teams)} team names")
    print("Top 10 by rating (sanity check):")
    for p in sorted(players, key=lambda p: -p["rating"])[:10]:
        print(f"  {p['rating']:>3}  {p['name']} ({p['franchise']} {p['decade']}s, {p['pos'][0]})")


if __name__ == "__main__":
    main()

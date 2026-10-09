# Data sources

- **Real data**: Kaggle dataset "NBA Stats (1947-present)" by Sumitro Datta (derived from Basketball-Reference). Check the dataset page for its license before publishing the app. Only facts (stats) are used; no names/ratings/assets from other games are copied.
- **Pipeline**: `python data-pipeline/build_players.py` -> `public/data/players.json`.
- **Dev sample**: `npm run sample` writes SYNTHETIC fake players so the code runs without the CSVs. `meta.source` says "SYNTHETIC SAMPLE" in that case.

## Rating (0-99) – own formula
1. Per season, z-scores vs. the league for PTS, TRB, AST, STL, BLK, TS%, BPM, WS/48 (min. 500 minutes).
2. Weighted sum, re-normalised by the weights actually available (STL/BLK are unknown before 1973-74, so they are left out instead of guessed).
3. Per player + franchise + decade: 80% minutes-weighted average + 20% best season.
4. Mapped to 40-99 with `40 + percentile^3 * 59`, so only a few stints reach the high 90s.

## Other fields
- **Positions**: main = most frequent first listed position; alt = other positions with >= 20% share.
- **Fans (1-100)**: All-Star picks, MVP award shares, career length.
- **Tags** (for chemistry later): rim_protector (BPG>=1.5), playmaker (APG>=6), rebounder (RPG>=9), scorer (PPG>=22), defender (SPG>=1.5).
- Top 5 stints per franchise-decade are kept (~900-1000 players).

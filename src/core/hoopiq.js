// HoopIQ mode: stats are hidden during the draft. Afterwards your picks are compared
// with the best player that was available on each board.

export const IQ_TITLES = [
  [95, 'Draft-Genie'],
  [88, 'General Manager'],
  [80, 'Chefscout'],
  [70, 'Scout'],
  [0, 'Rookie'],
];

// picks: [{ playerId, bestId, worstId }] from the draft state. Each pick is scored by where it
// sits between the worst (0 %) and the best (100 %) player of its board; the IQ is the average.
export function iqScore(picks, byId) {
  const rows = picks.map((k) => {
    const picked = byId.get(k.playerId), best = byId.get(k.bestId), worst = byId.get(k.worstId);
    const span = best.rating - worst.rating;
    return { name: picked.name, rating: picked.rating, bestName: best.name, best: best.rating, score: span ? (picked.rating - worst.rating) / span : 1 };
  });
  const pct = rows.length ? Math.round((rows.reduce((s, r) => s + r.score, 0) / rows.length) * 100) : 0;
  return {
    pct,
    title: IQ_TITLES.find(([min]) => pct >= min)[1],
    perfect: rows.filter((r) => r.rating === r.best).length,
    rows,
  };
}

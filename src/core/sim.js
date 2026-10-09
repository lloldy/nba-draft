// Regular-season simulation. Pure function: same seed + same team rating => same season.

import { SIM } from './config.js';
import { createRng } from './seed.js';

export const winProbability = (team, opponent) => 1 / (1 + Math.exp(-(team - opponent) / SIM.scale));

export const longestStreak = (games) => {
  let best = 0, run = 0;
  for (const g of games) {
    run = g.win ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};

// `rating` is the team's average effective rating; `bonus` is added on top
// (chemistry/coach in phase 3). Returns the full game-by-game log.
export function simulateSeason({ seed, rating, bonus = 0 }) {
  const rng = createRng(seed ^ 0x5eed5eed);
  const team = rating + bonus;
  const games = [];
  let wins = 0;
  for (let n = 1; n <= SIM.games; n++) {
    // Opponent strength: average of two uniforms gives a bell-ish shape.
    const opp = SIM.oppMean + (rng.next() + rng.next() - 1) * SIM.oppSpread * 2;
    const p = winProbability(team, opp);
    const win = rng.next() < p;
    if (win) wins++;
    games.push({ n, opp: Math.round(opp * 10) / 10, p, win, wins, losses: n - wins });
  }
  return { games, wins, losses: SIM.games - wins, streak: longestStreak(games) };
}

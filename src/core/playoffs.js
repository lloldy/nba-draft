import { PLAYOFFS } from './config.js';
import { createRng } from './seed.js';
import { winProbability } from './sim.js';

export const qualifies = (wins) => wins >= PLAYOFFS.minWins;

// Opponents depend only on seed + round, so they never change when you rearrange your lineup.
export function opponentFor({ seed, round, franchiseCodes }) {
  const rng = createRng(seed ^ ((round + 1) * 0x2545f491));
  const rating = PLAYOFFS.oppBase[round] + (rng.next() * 2 - 1) * PLAYOFFS.oppNoise;
  return { franchise: rng.pick(franchiseCodes), rating: Math.round(rating * 10) / 10 };
}

// Best-of-7: first to 4 wins. Returns every game that was played.
export function simulateSeries({ seed, round, strength, opponent }) {
  const rng = createRng(seed ^ ((round + 1) * 0x9e3779b1));
  const p = winProbability(strength, opponent.rating);
  const games = [];
  let team = 0, opp = 0;
  while (team < PLAYOFFS.winsNeeded && opp < PLAYOFFS.winsNeeded) {
    const win = rng.next() < p;
    win ? team++ : opp++;
    games.push({ win, team, opp });
  }
  return { games, teamWins: team, oppWins: opp, won: team > opp, p };
}

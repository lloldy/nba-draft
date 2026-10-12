import { PLAYOFFS } from './config.js';
import { createRng } from './seed.js';
import { winProbability } from './sim.js';
import { boardValue } from './spin.js';
import { boardTeam } from './teams.js';

// Every franchise + decade board as a possible opponent, weakest first, e.g. the "Seattle SuperSonics 1990er".
export function opponentBoards(players) {
  const boards = new Map();
  for (const p of players) {
    const k = `${p.franchise}|${p.decade}`;
    if (!boards.has(k)) boards.set(k, []);
    boards.get(k).push(p);
  }
  return [...boards].map(([k, list]) => {
    const [franchise, decade] = k.split('|');
    return { franchise, decade: Number(decade), team: boardTeam(list), value: boardValue(list) };
  }).sort((a, b) => a.value - b.value || (a.franchise + a.decade).localeCompare(b.franchise + b.decade));
}

// Later rounds draw from stronger boards: round 0 from all of them, the finals from the top 30 %.
const POOL_START = [0, 0.25, 0.5, 0.7];

export const qualifies = (wins) => wins >= PLAYOFFS.minWins;

// Opponents depend only on seed + round, so they never change when you rearrange your lineup.
export function opponentFor({ seed, round, franchiseCodes, boards = null }) {
  const rng = createRng(seed ^ ((round + 1) * 0x2545f491));
  const rating = PLAYOFFS.oppBase[round] + (rng.next() * 2 - 1) * PLAYOFFS.oppNoise;
  const r = Math.round(rating * 10) / 10;
  if (boards?.length) {
    const b = rng.pick(boards.slice(Math.floor(boards.length * POOL_START[round])));
    return { franchise: b.franchise, decade: b.decade, team: b.team, rating: r };
  }
  return { franchise: rng.pick(franchiseCodes), rating: r };
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

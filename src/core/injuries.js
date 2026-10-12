// Playoff injuries. Pure functions on the `slots` map ({ PG: playerId, ... }).
// An injured player leaves the lineup and a weak replacement takes his slot,
// so the player has to rearrange the other four (position fit and chemistry change).
import { INJURY, POSITIONS } from './config.js';
import { createRng } from './seed.js';

export const BENCH_ID = 'bench';

// Generic replacement: plays every position, but only PG counts fully (the others are secondary).
export const BENCH = {
  id: BENCH_ID, name: 'Ersatzspieler', franchise: '—', decade: 0, bench: true,
  pos: [POSITIONS[0]], altPos: POSITIONS.slice(1), rating: INJURY.benchRating,
  ppg: 4, rpg: 2, apg: 1, spg: 0, bpg: 0, fans: 0, tags: [],
};

// Decide before a round whether somebody gets hurt. Who it is depends only on the
// seed, the round and WHICH players are on the team - rearranging slots cannot dodge it.
export function rollInjury({ seed, round, slots }) {
  const rng = createRng((seed ^ ((round + 1) * 0x7f4a7c15)) >>> 0);
  const roll = rng.next();
  const healthy = Object.values(slots).filter((id) => id && id !== BENCH_ID).sort();
  const victim = rng.pick(healthy);
  const rounds = rng.pick(INJURY.durations);
  if (roll >= (INJURY.chance[round] ?? 0) || !healthy.length) return null;
  return { playerId: victim, roundsLeft: rounds };
}

// Take the player out and put the replacement into his slot.
export function applyInjury(slots, playerId) {
  const slot = POSITIONS.find((s) => slots[s] === playerId);
  return { slots: { ...slots, [slot]: BENCH_ID }, slot };
}

// One round has passed: count down the injury.
export function tickInjury(injured) {
  if (!injured) return { injured: null, recovered: false };
  return injured.roundsLeft <= 1
    ? { injured: null, recovered: true }
    : { injured: { ...injured, roundsLeft: injured.roundsLeft - 1 }, recovered: false };
}

// A spun replacement player takes the bench player's slot.
export function standIn(slots, playerId) {
  const slot = POSITIONS.find((s) => slots[s] === BENCH_ID);
  return slot ? { ...slots, [slot]: playerId } : slots;
}

// The player returns and takes the stand-in's current slot (the stand-in leaves again).
export function recoverPlayer(slots, playerId, standInId = BENCH_ID) {
  const slot = POSITIONS.find((s) => slots[s] === standInId) ?? POSITIONS.find((s) => slots[s] === BENCH_ID);
  return slot ? { ...slots, [slot]: playerId } : slots;
}

// Skips for the replacement spin: the ones you still have from the draft. If you have none left,
// you get ONE random bonus skip (era or team; only team in era mode). Same seed -> same bonus.
export function replacementSkips(skips, { seed, round, allowEra = true }) {
  if (skips.team + skips.era > 0) return { skips: { ...skips }, bonus: null };
  const rng = createRng((seed ^ ((round + 1) * 0x2f9be6cf)) >>> 0);
  const bonus = allowEra ? rng.pick(['team', 'era']) : 'team';
  return { skips: { ...skips, [bonus]: 1 }, bonus };
}

// Skips you used during the replacement spin are gone; a granted bonus skip never carries over.
export const leftoverSkips = (original, remaining) => ({
  team: Math.min(original.team, remaining.team),
  era: Math.min(original.era, remaining.era),
});

// Seed of the replacement spin: depends only on seed and round, so friends get the same board.
export const replacementSeed = (seed, round) => (seed ^ ((round + 1) * 0x51ed270b)) >>> 0;

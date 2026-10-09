// Draft state machine. Every function returns a NEW state and never mutates the
// old one, which keeps undo and tests simple.
//
// The sequence of spins depends only on the seed (not on what you pick), so
// friends playing the same seed see exactly the same boards.

import { POSITIONS, DEFAULT_SKIPS, UNDO_PER_RUN } from './config.js';
import { createRng } from './seed.js';
import { indexPlayers } from './data.js';
import { effectiveRating } from './positions.js';

// constraints: { decades?: number[], excludeFranchises?: string[], allowPlayer?: (p) => boolean }
export function createDraft({ seed, players, skips = DEFAULT_SKIPS, constraints = {} }) {
  const idx = indexPlayers(players);
  const ok = (p) =>
    (!constraints.decades || constraints.decades.includes(p.decade)) &&
    !(constraints.excludeFranchises ?? []).includes(p.franchise) &&
    (!constraints.allowPlayer || constraints.allowPlayer(p));

  const pool = new Map(); // "FRA|decade" -> eligible players
  for (const [k, list] of idx.byCombo) {
    const eligible = list.filter(ok);
    if (eligible.length) pool.set(k, eligible);
  }
  if (!pool.size) throw new Error('No eligible players for these constraints');

  // Shuffle all combos once; spins walk through this list in order.
  const queue = createRng(seed).shuffle([...pool.keys()].sort());

  const state = {
    seed,
    skips: { ...skips },
    undosLeft: UNDO_PER_RUN,
    slots: Object.fromEntries(POSITIONS.map((s) => [s, null])), // slot -> playerId
    queue,
    cursor: -1,
    current: null, // { franchise, decade, players }
    picks: [], // [{ playerId, slot, cursor }] in pick order, for undo
    _pool: pool,
    _byId: idx.byId,
  };
  return spin(state);
}

function show(state, cursor, key) {
  const [franchise, decade] = key.split('|');
  return { ...state, cursor, current: { franchise, decade: Number(decade), players: state._pool.get(key) } };
}

export const isComplete = (state) => POSITIONS.every((s) => state.slots[s]);

export function spin(state) {
  if (isComplete(state)) return state;
  const cursor = state.cursor + 1;
  if (cursor >= state.queue.length) throw new Error('Out of combos');
  return show(state, cursor, state.queue[cursor]);
}

// Replace the current board with the next queued combo that satisfies `match`.
function skipTo(state, match, skipKey) {
  if (state.skips[skipKey] <= 0) throw new Error(`No ${skipKey} skips left`);
  for (let c = state.cursor + 1; c < state.queue.length; c++) {
    const [f, d] = state.queue[c].split('|');
    if (match(f, Number(d))) {
      // Swap the match into the current position; the skipped board takes its place later.
      const queue = [...state.queue];
      [queue[state.cursor], queue[c]] = [queue[c], queue[state.cursor]];
      const s = { ...state, queue, skips: { ...state.skips, [skipKey]: state.skips[skipKey] - 1 } };
      return show(s, state.cursor, queue[state.cursor]);
    }
  }
  throw new Error('No other combination available');
}

// New franchise, same decade.
export const skipTeam = (state) =>
  skipTo(state, (f, d) => d === state.current.decade && f !== state.current.franchise, 'team');
// New decade, same franchise.
export const skipEra = (state) =>
  skipTo(state, (f, d) => f === state.current.franchise && d !== state.current.decade, 'era');

export function pick(state, playerId, slot) {
  if (!POSITIONS.includes(slot)) throw new Error(`Unknown slot ${slot}`);
  if (state.slots[slot]) throw new Error(`Slot ${slot} is taken`);
  if (!state.current.players.some((p) => p.id === playerId)) throw new Error('Player not on current board');
  if (Object.values(state.slots).includes(playerId)) throw new Error('Player already drafted');
  const next = {
    ...state,
    slots: { ...state.slots, [slot]: playerId },
    picks: [...state.picks, { playerId, slot, cursor: state.cursor }],
  };
  return isComplete(next) ? next : spin(next);
}

export function swapSlots(state, a, b) {
  return { ...state, slots: { ...state.slots, [a]: state.slots[b], [b]: state.slots[a] } };
}

// Undo the last pick; you get the same board back. Once per run by default.
export function undoLastPick(state) {
  if (state.undosLeft <= 0) throw new Error('No undo left');
  const last = state.picks.at(-1);
  if (!last) throw new Error('Nothing to undo');
  const s = {
    ...state,
    undosLeft: state.undosLeft - 1,
    slots: { ...state.slots, [last.slot]: null },
    picks: state.picks.slice(0, -1),
  };
  return show(s, last.cursor, state.queue[last.cursor]);
}

export function teamRating(state) {
  const perSlot = {};
  let sum = 0;
  for (const s of POSITIONS) {
    const p = state._byId.get(state.slots[s]);
    perSlot[s] = p ? effectiveRating(p, s) : 0;
    sum += perSlot[s];
  }
  return { perSlot, average: Math.round((sum / POSITIONS.length) * 10) / 10 };
}

// Draft state machine. Every function returns a NEW state and never mutates the
// old one, which keeps undo and tests simple.
//
// The sequence of spins depends only on the seed (not on what you pick), so
// friends playing the same seed see exactly the same boards.

import { POSITIONS, DEFAULT_SKIPS, UNDO_PER_RUN, ULTRA } from './config.js';
import { createRng } from './seed.js';
import { indexPlayers } from './data.js';
import { effectiveRating } from './positions.js';
import { boardWeights, weightedOrder } from './spin.js';

// constraints: { decades?: number[], excludeFranchises?: string[], allowPlayer?: (p) => boolean }
// locked: { slot, playerId } = a legend that is already on the team (not offered again).
export function createDraft({ seed, players, skips = DEFAULT_SKIPS, constraints = {}, locked = null }) {
  const idx = indexPlayers(players);
  const lockedName = locked ? idx.byId.get(locked.playerId).name : null;
  const ok = (p) =>
    p.name !== lockedName &&
    (!constraints.decades || constraints.decades.includes(p.decade)) &&
    !(constraints.excludeFranchises ?? []).includes(p.franchise) &&
    (!constraints.allowPlayer || constraints.allowPlayer(p));

  const pool = new Map(); // "FRA|decade" -> eligible players
  for (const [k, list] of idx.byCombo) {
    const eligible = list.filter(ok);
    if (eligible.length) pool.set(k, eligible);
  }
  if (!pool.size) throw new Error('No eligible players for these constraints');

  // Order all combos once (weighted: strong, famous boards tend to come first); spins walk through it.
  const queue = weightedOrder([...pool.keys()].sort(), boardWeights(pool), createRng(seed));

  const state = {
    seed,
    skips: { ...skips },
    undosLeft: UNDO_PER_RUN,
    ultra: null, // { playerId } once the ultra spin was used
    slots: Object.fromEntries(POSITIONS.map((s) => [s, null])), // slot -> playerId
    queue,
    cursor: -1,
    current: null, // { franchise, decade, players }
    picks: [], // [{ playerId, slot, cursor }] in pick order, for undo
    _pool: pool,
    _byId: idx.byId,
  };
  if (locked) state.slots[locked.slot] = locked.playerId;
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

const bestOnBoard = (players) => players.reduce((a, b) => (b.rating > a.rating ? b : a));
const worstOnBoard = (players) => players.reduce((a, b) => (b.rating < a.rating ? b : a));

export function pick(state, playerId, slot) {
  if (!POSITIONS.includes(slot)) throw new Error(`Unknown slot ${slot}`);
  if (state.slots[slot]) throw new Error(`Slot ${slot} is taken`);
  if (!state.current.players.some((p) => p.id === playerId)) throw new Error('Player not on current board');
  if (Object.values(state.slots).includes(playerId)) throw new Error('Player already drafted');
  const name = state._byId.get(playerId).name;
  if (Object.values(state.slots).some((id) => id && state._byId.get(id).name === name)) {
    throw new Error(`${name} steht schon in deinem Team (anderer Zeitraum)`);
  }
  const next = {
    ...state,
    slots: { ...state.slots, [slot]: playerId },
    // bestId / worstId = best and worst rated player on this board (HoopIQ scoring)
    picks: [...state.picks, { playerId, slot, cursor: state.cursor, ultra: !!state.current.ultra, bestId: bestOnBoard(state.current.players).id, worstId: worstOnBoard(state.current.players).id }],
  };
  return isComplete(next) ? next : spin(next);
}

// Ultra spin: the board is replaced by ONE star card (the same for everyone with this seed and pick number).
// It costs all remaining skips. You can pick it or decline it (then the next normal board comes, the spin is gone).
export const canUltra = (state) =>
  !state.ultra && !state.current?.ultra && POSITIONS.filter((s) => state.slots[s]).length <= ULTRA.maxFilled;

export function ultraSpin(state) {
  if (!canUltra(state)) throw new Error('Ultra-Spin nicht verfügbar');
  const taken = new Set(Object.values(state.slots).filter(Boolean).map((id) => state._byId.get(id).name));
  const stars = [...state._pool.values()].flat()
    .filter((p) => p.rating >= ULTRA.minRating && !taken.has(p.name))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!stars.length) throw new Error('Keine Star-Karte verfügbar');
  const legends = stars.filter((p) => p.rating >= ULTRA.legendRating);
  const rng = createRng((state.seed ^ ((state.cursor + 1) * 0x7f4a7c15)) >>> 0);
  const group = legends.length && (rng.next() < ULTRA.legendShare || legends.length === stars.length)
    ? legends : stars.filter((p) => p.rating < ULTRA.legendRating).length ? stars.filter((p) => p.rating < ULTRA.legendRating) : stars;
  const card = rng.pick(group);
  return ultraBoard({ ...state, skips: { team: 0, era: 0 }, ultra: { playerId: card.id } });
}

function ultraBoard(state) {
  const p = state._byId.get(state.ultra.playerId);
  return { ...state, current: { franchise: p.franchise, decade: p.decade, players: [p], ultra: true } };
}

// Turn the ultra card down: the next normal board comes (the ultra spin stays used up).
export function declineUltra(state) {
  if (!state.current?.ultra) throw new Error('Kein Ultra-Spin aktiv');
  return spin(state);
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
  return last.ultra ? ultraBoard({ ...show(s, last.cursor, state.queue[last.cursor]) }) : show(s, last.cursor, state.queue[last.cursor]);
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

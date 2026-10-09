import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createDraft, spin, pick, skipTeam, skipEra, swapSlots, undoLastPick, isComplete, teamRating } from '../src/core/draft.js';
import { POSITIONS, DECADES } from '../src/core/config.js';

// Small synthetic pool: 4 franchises x 3 decades x 2 players.
const players = [];
for (const f of ['AAA', 'BBB', 'CCC', 'DDD']) {
  for (const d of [1980, 1990, 2000]) {
    for (let i = 0; i < 2; i++) {
      players.push({ id: `${f}${d}${i}`, name: 'x', franchise: f, decade: d, pos: [POSITIONS[(i + d / 10) % 5]], altPos: [], rating: 70 + i * 10 });
    }
  }
}

const fillAll = (s) => {
  for (const slot of POSITIONS) s = pick(s, s.current.players[0].id, slot);
  return s;
};

describe('draft', () => {
  it('same seed gives identical boards, regardless of picks', () => {
    const boards = (s) => {
      const out = [s.current.franchise + s.current.decade];
      for (const slot of POSITIONS.slice(0, 4)) {
        s = pick(s, s.current.players[0].id, slot);
        out.push(s.current.franchise + s.current.decade);
      }
      return out;
    };
    const a = boards(createDraft({ seed: 9, players }));
    const b = boards(createDraft({ seed: 9, players }));
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length); // no combo twice
  });

  it('five picks fill all slots', () => {
    const s = fillAll(createDraft({ seed: 1, players }));
    expect(isComplete(s)).toBe(true);
    expect(teamRating(s).average).toBeGreaterThan(0);
  });

  it('rejects taken slots and players not on the board', () => {
    let s = createDraft({ seed: 1, players });
    const id = s.current.players[0].id;
    s = pick(s, id, 'PG');
    expect(() => pick(s, s.current.players[0].id, 'PG')).toThrow();
    expect(() => pick(s, 'nope', 'SG')).toThrow();
  });

  it('skips change the board and are limited', () => {
    let s = createDraft({ seed: 3, players, skips: { team: 1, era: 1 } });
    const { franchise, decade } = s.current;
    s = skipTeam(s);
    expect(s.current.decade).toBe(decade);
    expect(s.current.franchise).not.toBe(franchise);
    expect(() => skipTeam(s)).toThrow();
    const f2 = s.current.franchise;
    s = skipEra(s);
    expect(s.current.franchise).toBe(f2);
    expect(() => skipEra(s)).toThrow();
  });

  it('swapSlots moves players and position fit changes the rating', () => {
    const base = fillAll(createDraft({ seed: 5, players }));
    const guard = { id: 'g', name: 'g', franchise: 'X', decade: 1980, pos: ['PG'], altPos: [], rating: 80 };
    const big = { id: 'b', name: 'b', franchise: 'X', decade: 1980, pos: ['C'], altPos: [], rating: 80 };
    const s = { ...base, slots: { PG: 'g', SG: null, SF: null, PF: null, C: 'b' }, _byId: new Map([['g', guard], ['b', big]]) };
    const swapped = swapSlots(s, 'PG', 'C');
    expect(swapped.slots).toMatchObject({ PG: 'b', C: 'g' });
    expect(teamRating(swapped).perSlot.PG).toBe(73.6); // 80 * 0.92
    expect(teamRating(swapped).average).toBeLessThan(teamRating(s).average);
  });

  it('undo works exactly once and restores the same board', () => {
    let s = createDraft({ seed: 2, players });
    const board = s.current.franchise + s.current.decade;
    s = pick(s, s.current.players[0].id, 'C');
    s = undoLastPick(s);
    expect(s.slots.C).toBeNull();
    expect(s.current.franchise + s.current.decade).toBe(board);
    s = pick(s, s.current.players[0].id, 'C');
    expect(() => undoLastPick(s)).toThrow();
  });

  it('era mode only spins one decade, exclusions are honoured', () => {
    let s = createDraft({ seed: 4, players, constraints: { decades: [1990], excludeFranchises: ['AAA'] } });
    for (const slot of POSITIONS.slice(0, 2)) {
      expect(s.current.decade).toBe(1990);
      expect(s.current.franchise).not.toBe('AAA');
      s = pick(s, s.current.players[0].id, slot);
    }
  });
});

// Runs only when real/sample data exists.
const dataPath = 'public/data/players.json';
describe.skipIf(!fs.existsSync(dataPath))('players.json', () => {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  it('has sane contents', () => {
    expect(data.players.length).toBeGreaterThan(100);
    for (const p of data.players) {
      expect(p.rating).toBeGreaterThanOrEqual(0);
      expect(p.rating).toBeLessThanOrEqual(99);
      expect(DECADES).toContain(p.decade);
      expect(POSITIONS).toContain(p.pos[0]);
    }
    expect(new Set(data.players.map((p) => p.id)).size).toBe(data.players.length);
  });
});

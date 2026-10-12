import { describe, it, expect } from 'vitest';
import { createDraft } from '../src/core/draft.js';
import { boardValue, boardWeights } from '../src/core/spin.js';

const mk = (f, d, rating, fans = 10) => ({ id: `${f}${d}${rating}`, name: `${f}${d}${rating}`, franchise: f, decade: d, pos: ['PG'], altPos: [], rating, fans });
// one strong board (STR) and many weak ones
const pool = [mk('STR', 2000, 95, 60), mk('STR', 2000, 92, 50), mk('STR', 2000, 90, 40)];
for (let i = 0; i < 20; i++) for (const r of [60, 58, 55]) pool.push(mk(`W${i}`, 1990, r, 5));

describe('weighted spin', () => {
  it('rates strong and famous boards higher', () => {
    const w = boardWeights(new Map([['STR|2000', pool.slice(0, 3)], ['W0|1990', pool.slice(3, 6)]]));
    expect(w.get('STR|2000')).toBeGreaterThan(w.get('W0|1990') * 5);
    expect(boardValue(pool.slice(0, 3))).toBeGreaterThan(boardValue(pool.slice(3, 6)));
  });

  it('strong boards come up earlier on average, but not always first', () => {
    let first = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) if (createDraft({ seed, players: pool }).current.franchise === 'STR') first++;
    expect(first / N).toBeGreaterThan(0.2); // uniform would be 1/21 = 5 %
    expect(first / N).toBeLessThan(0.9);
  });

  it('is deterministic per seed', () => {
    const a = createDraft({ seed: 7, players: pool }).queue;
    expect(createDraft({ seed: 7, players: pool }).queue).toEqual(a);
    expect(createDraft({ seed: 8, players: pool }).queue).not.toEqual(a);
  });
});

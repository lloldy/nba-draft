import { describe, it, expect } from 'vitest';
import { mulberry32, createRng, hashString, dailySeed } from '../src/core/seed.js';

describe('seed', () => {
  it('same seed gives same sequence, different seed differs', () => {
    const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    sa.forEach((x) => expect(x >= 0 && x < 1).toBe(true));
  });

  it('shuffle is deterministic and a permutation', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = createRng(5).shuffle(arr), s2 = createRng(5).shuffle(arr);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(arr);
  });

  it('int stays in the inclusive range', () => {
    const r = createRng(1);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 5);
      expect(v >= 3 && v <= 5).toBe(true);
    }
  });

  it('hashString is stable', () => {
    expect(hashString('2026-10-09')).toBe(hashString('2026-10-09'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('dailySeed depends only on the UTC date', () => {
    const early = new Date('2026-10-09T00:00:01Z');
    const late = new Date('2026-10-09T23:59:59Z');
    expect(dailySeed(early)).toBe(dailySeed(late));
    expect(dailySeed(early)).not.toBe(dailySeed(new Date('2026-10-10T00:00:01Z')));
  });
});

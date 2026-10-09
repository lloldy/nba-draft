import { describe, it, expect } from 'vitest';
import { rollInjury, applyInjury, tickInjury, recoverPlayer, BENCH_ID, BENCH } from '../src/core/injuries.js';
import { INJURY } from '../src/core/config.js';
import { fitFactor } from '../src/core/positions.js';

const slots = { PG: 'a', SG: 'b', SF: 'c', PF: 'd', C: 'e' };

describe('injuries', () => {
  it('is deterministic and independent of slot order', () => {
    const a = rollInjury({ seed: 1, round: 1, slots });
    expect(a).toEqual(rollInjury({ seed: 1, round: 1, slots }));
    const shuffled = { PG: 'e', SG: 'd', SF: 'c', PF: 'b', C: 'a' };
    for (let seed = 1; seed < 200; seed++) {
      expect(rollInjury({ seed, round: 2, slots })).toEqual(rollInjury({ seed, round: 2, slots: shuffled }));
    }
  });

  it('happens about as often as configured and never hits the replacement', () => {
    const n = 4000;
    let hits = 0;
    for (let seed = 1; seed <= n; seed++) {
      const inj = rollInjury({ seed, round: 1, slots: { ...slots, C: BENCH_ID } });
      if (inj) {
        hits++;
        expect(inj.playerId).not.toBe(BENCH_ID);
        expect(INJURY.durations).toContain(inj.roundsLeft);
      }
    }
    expect(hits / n).toBeGreaterThan(INJURY.chance[1] - 0.04);
    expect(hits / n).toBeLessThan(INJURY.chance[1] + 0.04);
  });

  it('replacement fills the slot, injury counts down, player returns', () => {
    const { slots: hurt, slot } = applyInjury(slots, 'c');
    expect(slot).toBe('SF');
    expect(hurt.SF).toBe(BENCH_ID);
    const moved = { ...hurt, SF: 'b', SG: BENCH_ID }; // player rearranged the lineup
    expect(recoverPlayer(moved, 'c')).toEqual({ PG: 'a', SG: 'c', SF: 'b', PF: 'd', C: 'e' });

    expect(tickInjury({ playerId: 'c', roundsLeft: 2 })).toEqual({ injured: { playerId: 'c', roundsLeft: 1 }, recovered: false });
    expect(tickInjury({ playerId: 'c', roundsLeft: 1 })).toEqual({ injured: null, recovered: true });
    expect(tickInjury(null).recovered).toBe(false);
  });

  it('replacement is weak but can play anywhere', () => {
    expect(BENCH.rating).toBe(INJURY.benchRating);
    expect(fitFactor(BENCH, 'PG')).toBe(1);
    expect(fitFactor(BENCH, 'C')).toBeLessThan(1);
    expect(fitFactor(BENCH, 'C')).toBeGreaterThan(0.9);
  });
});

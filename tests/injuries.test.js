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

import { standIn, replacementSkips, leftoverSkips, replacementSeed } from '../src/core/injuries.js';

describe('replacement spin', () => {
  it('injuries are a quarter as likely as before', () => {
    expect(INJURY.chance).toEqual([0.0375, 0.075, 0.0875, 0.0875]);
  });

  it('keeps your leftover skips and only grants a bonus when you have none', () => {
    expect(replacementSkips({ team: 1, era: 0 }, { seed: 1, round: 0 })).toEqual({ skips: { team: 1, era: 0 }, bonus: null });
    expect(replacementSkips({ team: 1, era: 1 }, { seed: 1, round: 0 }).bonus).toBeNull();
    const kinds = new Set();
    for (let seed = 1; seed < 100; seed++) {
      const r = replacementSkips({ team: 0, era: 0 }, { seed, round: 1 });
      expect(r.skips.team + r.skips.era).toBe(1);
      expect(r.skips[r.bonus]).toBe(1);
      expect(r).toEqual(replacementSkips({ team: 0, era: 0 }, { seed, round: 1 }));
      kinds.add(r.bonus);
    }
    expect([...kinds].sort()).toEqual(['era', 'team']); // both outcomes happen
  });

  it('era mode only grants a team skip', () => {
    for (let seed = 1; seed < 50; seed++) expect(replacementSkips({ team: 0, era: 0 }, { seed, round: 0, allowEra: false }).bonus).toBe('team');
  });

  it('used skips are gone, a bonus skip does not carry over', () => {
    expect(leftoverSkips({ team: 1, era: 1 }, { team: 0, era: 1 })).toEqual({ team: 0, era: 1 });
    expect(leftoverSkips({ team: 0, era: 0 }, { team: 1, era: 0 })).toEqual({ team: 0, era: 0 });
  });

  it('the stand-in takes the bench slot and leaves when the player returns', () => {
    const { slots: hurt } = applyInjury(slots, 'c');
    const withStandIn = standIn(hurt, 'x');
    expect(withStandIn.SF).toBe('x');
    expect(recoverPlayer(withStandIn, 'c', 'x')).toEqual(slots);
    const moved = { ...withStandIn, SF: 'b', SG: 'x' }; // lineup rearranged
    expect(recoverPlayer(moved, 'c', 'x')).toEqual({ PG: 'a', SG: 'c', SF: 'b', PF: 'd', C: 'e' });
  });

  it('replacement board seed depends on seed and round only', () => {
    expect(replacementSeed(5, 1)).toBe(replacementSeed(5, 1));
    expect(replacementSeed(5, 1)).not.toBe(replacementSeed(5, 2));
  });
});

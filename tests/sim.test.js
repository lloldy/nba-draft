import { describe, it, expect } from 'vitest';
import { simulateSeason, winProbability, longestStreak } from '../src/core/sim.js';

const avgWins = (rating) => {
  let sum = 0;
  for (let seed = 1; seed <= 200; seed++) sum += simulateSeason({ seed, rating }).wins;
  return sum / 200;
};

describe('sim', () => {
  it('plays 82 games and is deterministic per seed', () => {
    const a = simulateSeason({ seed: 11, rating: 85 });
    const b = simulateSeason({ seed: 11, rating: 85 });
    expect(a.games).toHaveLength(82);
    expect(a.wins + a.losses).toBe(82);
    expect(a).toEqual(b);
    expect(simulateSeason({ seed: 12, rating: 85 }).games).not.toEqual(a.games);
  });

  it('better teams win more, with a non-linear curve', () => {
    const w60 = avgWins(60), w75 = avgWins(75), w85 = avgWins(85), w95 = avgWins(95);
    expect(w60).toBeLessThan(w75);
    expect(w75).toBeLessThan(w85);
    expect(w85).toBeLessThan(w95);
    expect(w95).toBeGreaterThan(50);
    expect(w95).toBeLessThanOrEqual(82);
    expect(w60).toBeLessThan(15);
  });

  it('bonus acts like extra rating', () => {
    expect(simulateSeason({ seed: 3, rating: 80, bonus: 5 })).toEqual(simulateSeason({ seed: 3, rating: 85 }));
  });

  it('win probability is monotonic and centred', () => {
    expect(winProbability(80, 80)).toBeCloseTo(0.5);
    expect(winProbability(90, 80)).toBeGreaterThan(winProbability(85, 80));
  });

  it('longestStreak counts consecutive wins', () => {
    const g = [1, 1, 0, 1, 1, 1, 0, 1].map((w) => ({ win: !!w }));
    expect(longestStreak(g)).toBe(3);
  });
});

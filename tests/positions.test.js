import { describe, it, expect } from 'vitest';
import { fitFactor, effectiveRating } from '../src/core/positions.js';
import { POSITION_FIT } from '../src/core/config.js';

const p = { rating: 90, pos: ['PF'], altPos: ['C'] };

describe('positions', () => {
  it('applies primary / secondary / off-position factors from config', () => {
    expect(fitFactor(p, 'PF')).toBe(POSITION_FIT.primary);
    expect(fitFactor(p, 'C')).toBe(POSITION_FIT.secondary);
    expect(fitFactor(p, 'PG')).toBe(POSITION_FIT.off);
  });

  it('computes effective rating', () => {
    expect(effectiveRating(p, 'PF')).toBe(90);
    expect(effectiveRating(p, 'C')).toBe(87.3);
    expect(effectiveRating(p, 'PG')).toBe(82.8);
  });
});

describe('players known for two positions', () => {
  const harden = { rating: 96, pos: ['SG', 'PG'], altPos: ['SF'] };
  it('lose nothing on any of their full positions', () => {
    expect(fitFactor(harden, 'SG')).toBe(POSITION_FIT.primary);
    expect(fitFactor(harden, 'PG')).toBe(POSITION_FIT.primary);
    expect(effectiveRating(harden, 'PG')).toBe(96);
  });
  it('still get the secondary and off-position factors elsewhere', () => {
    expect(fitFactor(harden, 'SF')).toBe(POSITION_FIT.secondary);
    expect(fitFactor(harden, 'C')).toBe(POSITION_FIT.off);
  });
});

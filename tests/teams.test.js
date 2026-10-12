import { describe, it, expect } from 'vitest';
import { boardTeam, teamName, teamColors } from '../src/core/teams.js';
import { fitKind, effectiveRating } from '../src/core/positions.js';
import { POSITIONS } from '../src/core/config.js';

const pl = (team, rating) => ({ team, rating });

describe('historical team names', () => {
  it('picks the team most players of a board played for', () => {
    expect(boardTeam([pl('SEA', 90), pl('SEA', 80), pl('OKC', 95)])).toBe('SEA');
  });
  it('breaks ties with the best player and survives missing data', () => {
    expect(boardTeam([pl('NJN', 70), pl('BRK', 90)])).toBe('BRK');
    expect(boardTeam([{ rating: 80 }])).toBeNull();
  });
  it('names and colours fall back to the franchise', () => {
    const teams = { SEA: { name: 'Seattle SuperSonics', primary: '#00653A', secondary: '#FFC200' }, WSB: { name: 'Washington Bullets' } };
    const fr = { WAS: { primary: '#002B5C', secondary: '#E31837' } };
    expect(teamName(teams, 'SEA', 'x')).toBe('Seattle SuperSonics');
    expect(teamName(teams, 'ZZZ', 'Fallback')).toBe('Fallback');
    expect(teamColors(teams, fr, 'SEA', 'OKC').primary).toBe('#00653A');
    expect(teamColors(teams, fr, 'WSB', 'WAS')).toEqual({ primary: '#002B5C', secondary: '#E31837' });
  });
});

describe('all-position players', () => {
  const lebron = { rating: 99, pos: ['SF'], altPos: [], allPos: true };
  it('play every slot at full rating', () => {
    for (const slot of POSITIONS) {
      expect(fitKind(lebron, slot)).toBe('primary');
      expect(effectiveRating(lebron, slot)).toBe(99);
    }
  });
  it('normal players are unaffected', () => {
    expect(fitKind({ rating: 80, pos: ['SF'], altPos: [] }, 'C')).toBe('off');
  });
});

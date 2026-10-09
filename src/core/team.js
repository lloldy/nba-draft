// Puts everything together: lineup -> rating + chemistry + coach = strength.
import { POSITIONS } from './config.js';
import { effectiveRating } from './positions.js';
import { evaluateChemistry } from './chemistry.js';
import { coachBonus } from './coaches.js';

export function buildTeam({ slots, byId, coach = null }) {
  const lineup = POSITIONS.map((slot) => {
    const player = slots[slot] ? byId.get(slots[slot]) : null;
    return { slot, player, eff: player ? effectiveRating(player, slot) : 0 };
  });
  const rating = Math.round((lineup.reduce((s, l) => s + l.eff, 0) / POSITIONS.length) * 10) / 10;
  const chem = evaluateChemistry(lineup);
  const coachPts = coachBonus(coach, lineup, chem);
  return { lineup, rating, chem, coachBonus: coachPts, strength: Math.round((rating + chem.bonus + coachPts) * 10) / 10 };
}

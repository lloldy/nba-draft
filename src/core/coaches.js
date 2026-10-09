// Fictional coaches (no real names). Each one boosts a playing style: the more
// of your players carry one of the style's tags, the bigger the bonus.
import { getTags } from './chemistry.js';

export const COACHES = [
  { id: 'ruiz', name: 'Marco Ruiz', style: 'Tempo', tags: ['playmaker', 'scorer'], boost: 7 },
  { id: 'okafor', name: 'Daniel Okafor', style: 'Tempo', tags: ['playmaker', 'defender'], boost: 7 },
  { id: 'brandt', name: 'Karl Brandt', style: 'Defense', tags: ['rim_protector', 'defender'], boost: 8 },
  { id: 'mensah', name: 'Efua Mensah', style: 'Defense', tags: ['defender', 'rebounder'], boost: 7 },
  { id: 'lindqvist', name: 'Sven Lindqvist', style: 'Shooting', tags: ['shooter', 'scorer'], boost: 8 },
  { id: 'park', name: 'Jin Park', style: 'Shooting', tags: ['shooter', 'playmaker'], boost: 7 },
  { id: 'navarro', name: 'Elena Navarro', style: 'Balance', tags: [], boost: 2 },
];

// Rating points a coach adds to the team. `lineup` = [{ slot, player }].
export function coachBonus(coach, lineup, chem) {
  if (!coach) return 0;
  if (coach.style === 'Balance') return coach.boost + 0.5 * chem.count; // rewards a well-rounded team
  const players = lineup.filter((l) => l.player);
  const matching = players.filter((l) => coach.tags.some((t) => getTags(l.player).has(t))).length;
  return Math.round(((coach.boost * matching) / 5) * 10) / 10;
}

import { POSITION_FIT } from './config.js';

export function fitKind(player, slot) {
  if (player.allPos) return 'primary'; // e.g. LeBron: every slot counts as his main position
  if (player.pos.includes(slot)) return 'primary'; // main position plus any position he is known for (e.g. Harden: PG and SG)
  if ((player.altPos ?? []).includes(slot)) return 'secondary';
  return 'off';
}

export function fitFactor(player, slot) {
  return POSITION_FIT[fitKind(player, slot)];
}

export function effectiveRating(player, slot) {
  return Math.round(player.rating * fitFactor(player, slot) * 10) / 10;
}

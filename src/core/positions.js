import { POSITION_FIT } from './config.js';

export function fitKind(player, slot) {
  if (player.pos[0] === slot) return 'primary';
  if (player.pos.includes(slot) || (player.altPos ?? []).includes(slot)) return 'secondary';
  return 'off';
}

export function fitFactor(player, slot) {
  return POSITION_FIT[fitKind(player, slot)];
}

export function effectiveRating(player, slot) {
  return Math.round(player.rating * fitFactor(player, slot) * 10) / 10;
}

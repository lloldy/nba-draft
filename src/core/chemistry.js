import { CHEM } from './config.js';
import { fitKind } from './positions.js';

// Archetype tags: those stored in the data plus the ones derivable from stats
// (so older data files without tags still work).
export function getTags(p) {
  const r = CHEM.tagRules;
  const t = new Set(p.tags ?? []);
  if ((p.bpg ?? 0) >= r.rim_protector) t.add('rim_protector');
  if ((p.apg ?? 0) >= r.playmaker) t.add('playmaker');
  if ((p.rpg ?? 0) >= r.rebounder) t.add('rebounder');
  if ((p.ppg ?? 0) >= r.scorer) t.add('scorer');
  if ((p.spg ?? 0) >= r.defender) t.add('defender');
  if ((p.ppg ?? 0) >= r.shooter && ['PG', 'SG', 'SF'].includes(p.pos[0])) t.add('shooter');
  return t;
}

// lineup: [{ slot, player }]. Returns which player covers which role.
// A player only counts when he is NOT playing an off-position slot, and each
// player can fill just one role (bipartite matching, so no double counting).
export function evaluateChemistry(lineup) {
  const eligible = lineup.filter((l) => l.player && fitKind(l.player, l.slot) !== 'off');
  const canFill = Object.fromEntries(
    CHEM.roles.map((role) => [role, eligible.filter((l) => getTags(l.player).has(role)).map((l) => l.slot)]),
  );

  const slotToRole = {};
  const tryAssign = (role, seen) => {
    for (const slot of canFill[role]) {
      if (seen.has(slot)) continue;
      seen.add(slot);
      if (!slotToRole[slot] || tryAssign(slotToRole[slot], seen)) {
        slotToRole[slot] = role;
        return true;
      }
    }
    return false;
  };
  for (const role of CHEM.roles) tryAssign(role, new Set());

  const roles = Object.fromEntries(CHEM.roles.map((r) => [r, null]));
  for (const [slot, role] of Object.entries(slotToRole)) roles[role] = slot;
  const count = Object.values(roles).filter(Boolean).length;
  return { roles, count, ...CHEM.levels[count], perfect: count === CHEM.roles.length };
}

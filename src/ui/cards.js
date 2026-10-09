import { h } from './dom.js';
import { effectiveRating, fitKind } from '../core/positions.js';

export const initials = (name) =>
  name.replace(/^Sample /, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const fmt = (v) => (v == null ? '–' : v.toFixed(1));

// Collectible-style player card. `slot` (optional) shows the rating the player has in that slot.
export function playerCard(p, franchises, { slot, selected, onClick, hint } = {}) {
  const f = franchises[p.franchise] ?? { primary: '#444', secondary: '#888' };
  const eff = slot ? effectiveRating(p, slot) : p.rating;
  const kind = slot ? fitKind(p, slot) : null;
  return h('button', {
    class: `card${selected ? ' selected' : ''}${kind ? ` fit-${kind}` : ''}`,
    style: { '--c1': f.primary, '--c2': f.secondary },
    onclick: onClick,
    type: 'button',
  },
    h('div', { class: 'card-top' },
      h('span', { class: 'card-rating' }, Math.round(eff)),
      h('span', { class: 'card-pos' }, [p.pos[0], ...(p.altPos ?? [])].join('/')),
    ),
    h('div', { class: 'card-initials' }, initials(p.name)),
    h('div', { class: 'card-name' }, p.name),
    h('div', { class: 'card-team' }, `${p.franchise} · ${p.decade}er`),
    h('div', { class: 'card-stats' },
      h('span', {}, h('b', {}, fmt(p.ppg)), ' PTS'),
      h('span', {}, h('b', {}, fmt(p.rpg)), ' REB'),
      h('span', {}, h('b', {}, fmt(p.apg)), ' AST'),
    ),
    hint && h('div', { class: 'card-hint' }, hint),
  );
}

export function emptySlot(slot, { onClick, preview, active }) {
  return h('button', { class: `card empty${active ? ' active' : ''}`, type: 'button', onclick: onClick },
    h('div', { class: 'card-initials' }, slot),
    h('div', { class: 'card-name' }, preview != null ? `${preview} Rating` : 'frei'),
  );
}

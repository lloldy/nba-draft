import { h } from './dom.js';
import { app, register } from './state.js';
import { DECADES } from '../core/config.js';
import { franchisePage, eraPage } from '../core/browse.js';

const back = () => h('button', { class: 'btn ghost', onclick: () => { location.hash = ''; } }, 'Zurück');
const link = (hash, ...kids) => h('a', { class: 'tile', href: hash }, ...kids);

const playerRow = (p, showTeam) =>
  h('li', {}, h('b', {}, p.rating), h('span', {}, p.name), h('em', {}, `${p.pos[0]}${p.altPos?.length ? `/${p.altPos.join('/')}` : ''} · ${showTeam ? `${p.team ?? p.franchise} ${p.decade}er · ` : ''}${p.ppg?.toFixed(1)} / ${p.rpg?.toFixed(1)} / ${p.apg?.toFixed(1)}`));

function franchisesScreen() {
  return h('main', { class: 'screen browse' },
    h('h2', {}, 'Franchises'),
    h('div', { class: 'tiles' }, Object.entries(app.franchises).map(([code, f]) =>
      link(`#/franchise/${code}`, h('span', { class: 'tile-bar', style: { background: `linear-gradient(90deg, ${f.primary} 70%, ${f.secondary} 70%)` } }), f.name))),
    back());
}

function franchiseScreen() {
  const code = app.view.id, f = app.franchises[code];
  if (!f) return h('main', { class: 'screen' }, h('p', {}, 'Unbekannte Franchise.'), back());
  const page = franchisePage(app.data.players, code);
  return h('main', { class: 'screen browse' },
    h('h2', { style: { color: f.primary === '#1D1D1D' ? '#fff' : f.secondary } }, f.name),
    h('h3', {}, 'Top 5 aller Zeiten'),
    h('ol', { class: 'board-list' }, page.top.map((p) => playerRow(p, true))),
    [...page.byDecade].map(([decade, list]) => [
      h('h3', {}, link(`#/era/${decade}`, `${decade}er`)),
      h('ol', { class: 'board-list' }, list.map((p) => playerRow(p, false))),
    ]),
    back());
}

function erasScreen() {
  return h('main', { class: 'screen browse' },
    h('h2', {}, 'Ären'),
    h('div', { class: 'tiles' }, DECADES.map((d) => link(`#/era/${d}`, `${d}er`))),
    back());
}

function eraScreen() {
  const decade = Number(app.view.id);
  const page = eraPage(app.data.players, decade);
  return h('main', { class: 'screen browse' },
    h('h2', {}, `${decade}er`),
    h('h3', {}, 'Top 5 der Ära'),
    h('ol', { class: 'board-list' }, page.top.map((p) => playerRow(p, true))),
    [...page.byFranchise].map(([code, list]) => [
      h('h3', {}, link(`#/franchise/${code}`, app.franchises[code]?.name ?? code)),
      h('ol', { class: 'board-list' }, list.map((p) => playerRow(p, false))),
    ]),
    back());
}

register('browse', () =>
  ({ franchises: franchisesScreen, franchise: franchiseScreen, eras: erasScreen, era: eraScreen })[app.view.kind]());

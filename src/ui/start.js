import { h } from './dom.js';
import { app, go, render, register } from './state.js';
import { load, save, KEYS } from './storage.js';
import { spinAnimation } from './screens.js';
import { DECADES } from '../core/config.js';
import { createDraft } from '../core/draft.js';
import { COACHES } from '../core/coaches.js';
import { constraintsFor, pickLegend, ruleById } from '../core/rules.js';
import { dailyInfo, utcDate, emptyDaily, hasPlayed, startAttempt, currentStreak } from '../core/daily.js';
import { PO_LABELS } from '../core/stats.js';

export function startDraft() {
  const locked = app.rule?.type === 'legend' ? pickLegend(app.data.players, app.seed) : null;
  app.draft = createDraft({
    seed: app.seed,
    players: app.data.players,
    constraints: constraintsFor(app.rule, app.decade),
    locked,
  });
  app.selCard = app.selSlot = null;
  app.po = null;
  app.run = null;
  app.coach = COACHES.at(-1);
  app.lineupBack = 'season';
  go('draft');
  spinAnimation();
}

function startDaily() {
  const today = utcDate();
  const info = dailyInfo(today);
  save(KEYS.daily, startAttempt(load(KEYS.daily, emptyDaily()), today)); // one attempt per day, used up now
  Object.assign(app, { mode: 'daily', seed: info.seed, rule: info.rule, decade: null, dailyDate: today });
  startDraft();
}

function acceptChallenge() {
  const c = app.challenge;
  Object.assign(app, { mode: 'challenge', seed: c.seed, decade: c.era, rule: ruleById(c.rule) });
  startDraft();
}

function dailyCard() {
  const today = utcDate();
  const info = dailyInfo(today);
  const daily = load(KEYS.daily, emptyDaily());
  const played = hasPlayed(daily, today);
  const result = daily.attempts[today];
  return h('section', { class: 'panel daily' },
    h('div', { class: 'panel-head' }, h('h3', {}, `Daily · ${today}`), h('span', { class: 'chip accent' }, `Streak ${currentStreak(daily, today)}`)),
    h('p', { class: 'rule-line' }, h('b', {}, info.rule.label), ` – ${info.rule.desc}`),
    played
      ? h('p', { class: 'hint' }, result?.done
          ? `Heute gespielt: ${result.wins} Siege · ${PO_LABELS[result.po]}${info.rule.type !== 'constraint' || info.rule.id === 'fans300' ? (result.passed ? ' · Regel erfüllt' : ' · Regel verfehlt') : ''}`
          : 'Dein heutiger Versuch ist angefangen, aber nicht beendet worden. Morgen gibt es einen neuen.')
      : h('button', { class: 'btn primary', onclick: startDaily }, 'Daily starten (1 Versuch)'),
  );
}

function startScreen() {
  const seedInput = h('input', { type: 'number', value: app.seed, id: 'seed', inputmode: 'numeric' });
  const era = h('select', { id: 'era' },
    h('option', { value: '' }, 'Alle Dekaden'),
    DECADES.map((d) => h('option', { value: d, selected: app.decade === d }, `Nur ${d}er`)));
  const name = h('input', { type: 'text', value: app.name, maxlength: 20, placeholder: 'Dein Name (für Challenge-Links)', oninput: () => { app.name = name.value; save(KEYS.name, app.name); } });
  const ch = app.challenge;
  return h('main', { class: 'screen start' },
    h('h1', { class: 'logo' }, 'NBA ', h('span', {}, 'DRAFT')),
    h('p', { class: 'lead' }, 'Dreh das Rad, drafte fünf Spieler und simuliere 82 Spiele.'),
    app.data.meta.source.includes('SYNTHETIC') && h('p', { class: 'notice' }, 'Beispieldaten (erfundene Spieler) – echte Daten siehe DATA_SOURCES.md'),
    ch && h('section', { class: 'panel challenge' },
      h('h3', {}, `${ch.by ?? 'Ein Freund'} fordert dich heraus`),
      h('p', { class: 'rule-line' }, ch.record ? `Rekord: ${ch.record.wins} Siege · ${PO_LABELS[ch.record.po]}` : 'Gleiche Boards, gleicher Seed.',
        ch.rule && ruleById(ch.rule) ? ` · Regel: ${ruleById(ch.rule).label}` : '', ch.era ? ` · Nur ${ch.era}er` : ''),
      h('button', { class: 'btn primary', onclick: acceptChallenge }, 'Challenge annehmen')),
    dailyCard(),
    h('section', { class: 'panel' },
      h('h3', {}, 'Freies Spiel'),
      h('label', {}, 'Seed (gleicher Seed = gleiche Boards)', seedInput),
      h('label', {}, 'Ära-Modus', era),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { seedInput.value = Math.floor(Math.random() * 1e9); } }, 'Zufälliger Seed'),
        h('button', { class: 'btn primary', onclick: () => {
          Object.assign(app, { mode: 'free', rule: null, seed: Number(seedInput.value) || 1, decade: era.value ? Number(era.value) : null });
          startDraft();
        } }, 'Draft starten'))),
    h('label', {}, 'Dein Name', name),
    h('nav', { class: 'row links' },
      h('button', { class: 'btn ghost', onclick: () => go('stats') }, 'Statistik'),
      h('button', { class: 'btn ghost', onclick: () => { location.hash = '#/franchises'; } }, 'Franchises'),
      h('button', { class: 'btn ghost', onclick: () => { location.hash = '#/era'; } }, 'Ären')),
  );
}

register('start', startScreen);

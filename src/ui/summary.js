import { h } from './dom.js';
import { app, go, register, team } from './state.js';
import { healAll } from './screens.js';
import { load, save, KEYS } from './storage.js';
import { renderShareCard, shareText, downloadCanvas } from './share.js';
import { qualifies } from '../core/playoffs.js';
import { PO_LABELS, playoffScore, addRun, leaderboard, summarize } from '../core/stats.js';
import { checkRule } from '../core/rules.js';
import { emptyDaily, finishAttempt, currentStreak, utcDate } from '../core/daily.js';
import { encodeChallenge, compareToRecord } from '../core/challenge.js';
import { iqScore } from '../core/hoopiq.js';

// Called when a run is over (season missed playoffs, or playoffs ended).
export function goSummary() {
  if (!app.run) finalize();
  go('summary');
}

function finalize() {
  healAll();
  const s = app.season, st = app.seasonTeam, now = team();
  const qualified = qualifies(s.wins);
  const po = playoffScore({ qualified, po: app.po });
  const passed = checkRule(app.rule, { wins: s.wins, streak: s.streak, lineup: st.lineup, chem: st.chem });
  const run = {
    at: Date.now(), date: utcDate(), mode: app.mode, seed: app.seed, era: app.decade,
    hoopiq: app.hoopiq, iq: app.hoopiq ? iqScore(app.draft.picks, app.data.byId) : null,
    rule: app.rule?.id ?? null, ruleLabel: app.rule?.label ?? null, passed,
    wins: s.wins, losses: s.losses, streak: s.streak, po,
    strength: now.strength, chem: now.chem.name,
    lineup: now.lineup.map((l) => ({ slot: l.slot, name: l.player.name, rating: Math.round(l.eff), franchise: l.player.franchise, decade: l.player.decade })),
  };
  save(KEYS.runs, addRun(load(KEYS.runs, []), run));
  if (app.mode === 'daily') {
    save(KEYS.daily, finishAttempt(load(KEYS.daily, emptyDaily()), app.dailyDate, { wins: run.wins, po, passed }));
  }
  app.run = run;
}

const baseUrl = () => `${location.origin}${location.pathname}`;
const challengeLink = (run) =>
  `${baseUrl()}#${encodeChallenge({ seed: run.seed, era: run.era, rule: run.rule, by: app.name, wins: run.wins, po: run.po, iq: run.hoopiq })}`;

function summaryScreen() {
  const run = app.run;
  const canvas = renderShareCard(run, app.franchises);
  canvas.className = 'share-card';
  const link = challengeLink(run);
  const flash = (btn, text) => { const old = btn.textContent; btn.textContent = text; setTimeout(() => { btn.textContent = old; }, 1600); };
  const copy = async (btn, text, ok) => {
    try { await navigator.clipboard.writeText(text); flash(btn, ok); } catch { prompt('Zum Kopieren:', text); }
  };
  const textBtn = h('button', { class: 'btn', onclick: () => copy(textBtn, shareText(run, link), 'Text kopiert!') }, 'Ergebnis-Text kopieren');
  const linkBtn = h('button', { class: 'btn', onclick: () => copy(linkBtn, link, 'Link kopiert!') }, 'Challenge-Link kopieren');
  const cmp = app.mode === 'challenge' && app.challenge?.record ? compareToRecord(run, app.challenge.record) : null;
  const daily = load(KEYS.daily, emptyDaily());
  return h('main', { class: 'screen summary' },
    h('h2', {}, 'Ergebnis'),
    cmp && h('div', { class: cmp === 'win' ? 'perfect' : cmp === 'tie' ? 'notice' : 'out' },
      cmp === 'win' ? `Rekord geschlagen! (${app.challenge.record.wins} Siege · ${PO_LABELS[app.challenge.record.po]})`
        : cmp === 'tie' ? 'Gleichstand mit dem Rekord.' : `Rekord von ${app.challenge.by ?? 'deinem Freund'} nicht geknackt (${app.challenge.record.wins} Siege · ${PO_LABELS[app.challenge.record.po]}).`),
    run.ruleLabel && h('div', { class: run.passed ? 'perfect' : 'out' }, `${run.ruleLabel}: ${run.passed ? 'erfüllt ✓' : 'nicht erfüllt ✗'}`),
    run.mode === 'daily' && h('p', { class: 'lead' }, `Daily-Streak: ${currentStreak(daily, utcDate())} Tage (Bestwert ${daily.best})`),
    run.iq && iqPanel(run.iq),
    canvas,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => downloadCanvas(canvas, `nba-draft-${run.wins}-${run.losses}.png`) }, 'Bild speichern'),
      textBtn, linkBtn),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => go('stats') }, 'Statistik'),
      h('button', { class: 'btn primary', onclick: () => { app.seed = Math.floor(Math.random() * 1e9); app.challenge = null; go('start'); } }, 'Neuer Run')),
  );
}

function iqPanel(iq) {
  return h('section', { class: 'panel iq' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'HoopIQ'), h('span', { class: 'chip accent' }, `${iq.pct} % · ${iq.title}`)),
    h('p', { class: 'hint' }, `${iq.perfect} von ${iq.rows.length} Picks waren der beste Spieler auf dem Board.`),
    h('ul', { class: 'iq-rows' }, iq.rows.map((r) => h('li', { class: r.rating === r.best ? 'ok' : '' },
      h('b', {}, r.name), h('span', {}, r.rating), h('em', {}, r.rating === r.best ? 'Bester auf dem Board' : `Besser: ${r.bestName} (${r.best})`)))));
}

function statsScreen() {
  const runs = load(KEYS.runs, []);
  const s = summarize(runs);
  const daily = load(KEYS.daily, emptyDaily());
  const row = (r) => h('li', {}, h('b', {}, `${r.wins}–${r.losses}`), h('span', {}, PO_LABELS[r.po]),
    h('em', {}, `${r.mode === 'daily' ? `Daily ${r.date}` : r.mode === 'challenge' ? 'Challenge' : 'Frei'}${r.ruleLabel ? ` · ${r.ruleLabel}` : ''}`));
  const tile = (label, value) => h('div', {}, h('small', {}, label), h('b', {}, value));
  return h('main', { class: 'screen stats' },
    h('h2', {}, 'Statistik'),
    h('div', { class: 'strength' }, tile('Runs', s.runs), tile('Titel', s.titles), tile('82–0', s.perfect), tile('Beste Bilanz', s.bestWins)),
    h('div', { class: 'strength' }, tile('Ø Siege', s.avgWins), tile('Daily-Streak', currentStreak(daily, utcDate())), tile('Bester Streak', daily.best), tile('Daily gespielt', Object.values(daily.attempts).filter((a) => a.done).length)),
    h('h3', {}, 'Bestenliste'),
    runs.length ? h('ol', { class: 'board-list' }, leaderboard(runs).map(row)) : h('p', { class: 'hint' }, 'Noch keine Runs.'),
    h('h3', {}, 'Letzte Runs'),
    runs.length ? h('ol', { class: 'board-list' }, runs.slice(0, 10).map(row)) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => { if (confirm('Alle lokalen Daten löschen?')) { save(KEYS.runs, []); save(KEYS.daily, emptyDaily()); go('stats'); } } }, 'Daten löschen'),
      h('button', { class: 'btn primary', onclick: () => go('start') }, 'Zurück')),
  );
}

register('summary', summaryScreen);
register('stats', statsScreen);

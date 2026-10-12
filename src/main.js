import '@fontsource/big-shoulders-display/800';
import '@fontsource/barlow/400';
import '@fontsource/barlow/600';
import '@fontsource/barlow/700';
import { loadPlayers } from './core/data.js';
import { BENCH } from './core/injuries.js';
import { parseChallenge } from './core/challenge.js';
import { app, render } from './ui/state.js';
import { load, KEYS } from './ui/storage.js';
import './ui/screens.js';
import './ui/start.js';
import './ui/summary.js';
import './ui/browse.js';

// "#/franchises", "#/franchise/LAL", "#/era", "#/era/1990" open the overview pages.
function route() {
  const hash = location.hash;
  if (hash.startsWith('#/')) {
    const [kind, id] = hash.slice(2).split('/');
    app.view = { kind: kind === 'era' && !id ? 'eras' : kind, id };
    app.screen = 'browse';
  } else if (app.screen === 'browse') {
    app.screen = 'start';
  }
  render();
}

async function boot() {
  const [data, franchises] = await Promise.all([
    loadPlayers('./data/players.json'),
    fetch('./data/franchises.json').then((r) => r.json()),
  ]);
  await document.fonts.load('800 40px "Big Shoulders Display"').catch(() => {}); // so the share card canvas has the font
  data.byId.set(BENCH.id, BENCH); // replacement player for injuries (never part of draft pools)
  app.data = data;
  app.franchises = franchises;
  app.teams = await fetch('./data/teams.json').then((r) => r.json()).catch(() => ({}));
  app.name = load(KEYS.name, '');

  // Challenge link: #seed=123&era=1990&rule=only90s&by=Noah&rw=63&rp=5
  app.challenge = parseChallenge(location.hash);
  app.seed = app.challenge?.seed ?? Math.floor(Math.random() * 1e9);
  app.decade = app.challenge?.era ?? null;
  route();
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/') || app.screen === 'browse') route();
  });
}

boot().catch((e) => {
  document.getElementById('app').textContent = `Fehler beim Laden: ${e.message}`;
});

// Offline support + installability (production build only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

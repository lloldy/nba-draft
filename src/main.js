import { loadPlayers } from './core/data.js';
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
  app.data = data;
  app.franchises = franchises;
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

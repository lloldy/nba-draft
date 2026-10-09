import { loadPlayers } from './core/data.js';
import { app, render } from './ui/screens.js';

async function boot() {
  const [data, franchises] = await Promise.all([
    loadPlayers('./data/players.json'),
    fetch('./data/franchises.json').then((r) => r.json()),
  ]);
  app.data = data;
  app.franchises = franchises;

  // Challenge link: #seed=123&era=1990
  const params = new URLSearchParams(location.hash.slice(1));
  app.seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
  app.decade = Number(params.get('era')) || null;
  render();
}

boot().catch((e) => {
  document.getElementById('app').textContent = `Fehler beim Laden: ${e.message}`;
});

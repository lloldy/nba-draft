// Loads players.json (browser: fetch, Node: fs) and indexes it.

export const comboKey = (franchise, decade) => `${franchise}|${decade}`;

export function indexPlayers(players) {
  const byCombo = new Map();
  const byId = new Map();
  for (const p of players) {
    byId.set(p.id, p);
    const k = comboKey(p.franchise, p.decade);
    if (!byCombo.has(k)) byCombo.set(k, []);
    byCombo.get(k).push(p);
  }
  return { players, byCombo, byId };
}

export async function loadPlayers(url = './data/players.json') {
  let json;
  if (typeof window === 'undefined') {
    const fs = await import(/* @vite-ignore */ 'node:fs/promises');
    json = JSON.parse(await fs.readFile(url, 'utf8'));
  } else {
    json = await (await fetch(url)).json();
  }
  return { meta: json.meta, ...indexPlayers(json.players) };
}

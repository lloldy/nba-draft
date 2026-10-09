// Data for the franchise / era overview pages.

export const topPlayers = (players, filter, n = 5) =>
  players.filter(filter).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)).slice(0, n);

// Map in ascending key order, each group sorted by rating.
export function groupBy(players, keyFn) {
  const map = new Map();
  for (const p of [...players].sort((a, b) => b.rating - a.rating)) {
    const k = keyFn(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return new Map([...map.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1)));
}

export const franchisePage = (players, code) => {
  const mine = players.filter((p) => p.franchise === code);
  return { top: topPlayers(mine, () => true), byDecade: groupBy(mine, (p) => p.decade) };
};

export const eraPage = (players, decade) => {
  const mine = players.filter((p) => p.decade === decade);
  return { top: topPlayers(mine, () => true), byFranchise: groupBy(mine, (p) => p.franchise) };
};

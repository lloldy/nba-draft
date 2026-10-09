// localStorage can be missing or blocked (private windows), so every access is guarded.
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = { daily: 'nbd:daily', runs: 'nbd:runs', name: 'nbd:name' };

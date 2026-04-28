const TILESETS_KEY = 'sketch_tilesets';
const LOAD_FLAG_KEY = 'sketch_load_seed';

export function loadTilesets() {
  try { return JSON.parse(localStorage.getItem(TILESETS_KEY) || '[]'); }
  catch { return []; }
}

export function saveTileset(name, seed) {
  const list = loadTilesets();
  list.unshift({ id: Date.now().toString(), name, seed, savedAt: new Date().toISOString() });
  localStorage.setItem(TILESETS_KEY, JSON.stringify(list));
}

export function deleteTileset(id) {
  const list = loadTilesets().filter(t => t.id !== id);
  localStorage.setItem(TILESETS_KEY, JSON.stringify(list));
}

export function setLoadFlag(seed) {
  localStorage.setItem(LOAD_FLAG_KEY, seed);
}

export function consumeLoadFlag() {
  const seed = localStorage.getItem(LOAD_FLAG_KEY);
  if (seed) localStorage.removeItem(LOAD_FLAG_KEY);
  return seed || null;
}

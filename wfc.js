/**
 * Wave Function Collapse for a 5-tile world:
 *   0 = empty  (void / sky)
 *   1 = ground (land / sand)
 *   2 = object (placed on land)
 *   3 = water
 *   4 = shore  (land↔water boundary)
 *
 * When hasWater is false, only tiles 0-2 are used (backward-compatible).
 */

export const TILE_EMPTY  = 0;
export const TILE_GROUND = 1;
export const TILE_OBJECT = 2;
export const TILE_WATER  = 3;
export const TILE_SHORE  = 4;

const ADJACENCY_BASIC = {
  [TILE_EMPTY]:  new Set([TILE_EMPTY, TILE_GROUND]),
  [TILE_GROUND]: new Set([TILE_EMPTY, TILE_GROUND, TILE_OBJECT]),
  [TILE_OBJECT]: new Set([TILE_GROUND]),
};

const ADJACENCY_WATER = {
  [TILE_EMPTY]:  new Set([TILE_EMPTY, TILE_GROUND, TILE_WATER, TILE_SHORE]),
  [TILE_GROUND]: new Set([TILE_EMPTY, TILE_GROUND, TILE_SHORE, TILE_OBJECT]),
  [TILE_OBJECT]: new Set([TILE_GROUND]),
  [TILE_WATER]:  new Set([TILE_EMPTY, TILE_WATER, TILE_SHORE]),
  [TILE_SHORE]:  new Set([TILE_GROUND, TILE_WATER, TILE_SHORE, TILE_EMPTY]),
};

/**
 * Generate a WxH tilemap using WFC.
 * @param {number} width
 * @param {number} height
 * @param {number} sparseness - 0 (dense objects) to 1 (very sparse)
 * @param {number} rngSeed
 * @param {boolean} hasWater - enable water/shore cell types
 * @returns {Uint8Array}
 */
export function generateChunk(width, height, sparseness, rngSeed, hasWater = false) {
  const rng = makeRng(rngSeed);
  const ADJACENCY = hasWater ? ADJACENCY_WATER : ADJACENCY_BASIC;
  const allTypes = hasWater ? [0, 1, 2, 3, 4] : [0, 1, 2];

  const tiles = new Uint8Array(width * height).fill(255);

  const weights = hasWater
    ? {
        [TILE_EMPTY]:  10,
        [TILE_GROUND]: 40,
        [TILE_OBJECT]: Math.max(1, Math.round((1 - sparseness) * 30)),
        [TILE_WATER]:  20,
        [TILE_SHORE]:  10,
      }
    : {
        [TILE_EMPTY]:  20,
        [TILE_GROUND]: 60,
        [TILE_OBJECT]: Math.max(1, Math.round((1 - sparseness) * 30)),
      };

  const possible = Array.from({ length: width * height }, () => new Set(allTypes));

  const idx = (x, y) => y * width + x;
  const neighbors = (x, y) => {
    const n = [];
    if (x > 0)        n.push([x - 1, y]);
    if (x < width-1)  n.push([x + 1, y]);
    if (y > 0)        n.push([x, y - 1]);
    if (y < height-1) n.push([x, y + 1]);
    return n;
  };

  const propagate = (x, y) => {
    const stack = [[x, y]];
    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const collapsed = tiles[idx(cx, cy)];
      if (collapsed === 255) continue;
      const allowed = ADJACENCY[collapsed];
      for (const [nx, ny] of neighbors(cx, cy)) {
        const ni = idx(nx, ny);
        if (tiles[ni] !== 255) continue;
        const before = possible[ni].size;
        for (const t of possible[ni]) {
          if (!allowed.has(t)) possible[ni].delete(t);
        }
        if (possible[ni].size < before) stack.push([nx, ny]);
      }
    }
  };

  for (let iter = 0; iter < width * height; iter++) {
    let minEntropy = Infinity;
    let candidates = [];
    for (let i = 0; i < width * height; i++) {
      if (tiles[i] !== 255) continue;
      const e = possible[i].size;
      if (e === 0) possible[i].add(TILE_GROUND);
      if (e < minEntropy) { minEntropy = e; candidates = [i]; }
      else if (e === minEntropy) candidates.push(i);
    }
    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(rng() * candidates.length)];
    const options = [...possible[pick]];
    const totalWeight = options.reduce((s, t) => s + (weights[t] || 1), 0);
    let r = rng() * totalWeight;
    let chosen = options[0];
    for (const t of options) {
      r -= (weights[t] || 1);
      if (r <= 0) { chosen = t; break; }
    }
    tiles[pick] = chosen;
    propagate(pick % width, Math.floor(pick / width));
  }

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 255) tiles[i] = TILE_GROUND;
  }

  return tiles;
}

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

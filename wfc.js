/**
 * Simplified Wave Function Collapse for a 3-tile world:
 *   0 = empty (background)
 *   1 = ground
 *   2 = object (placed on top of ground)
 *
 * Adjacency rules:
 *   empty  → can border: empty, ground
 *   ground → can border: empty, ground, object
 *   object → can border: ground (objects must be surrounded by ground)
 */

export const TILE_EMPTY  = 0;
export const TILE_GROUND = 1;
export const TILE_OBJECT = 2;

// adjacency[tile] = Set of allowed neighbor tiles
const ADJACENCY = {
  [TILE_EMPTY]:  new Set([TILE_EMPTY, TILE_GROUND]),
  [TILE_GROUND]: new Set([TILE_EMPTY, TILE_GROUND, TILE_OBJECT]),
  [TILE_OBJECT]: new Set([TILE_GROUND]),
};

/**
 * Generate a WxH tilemap using WFC.
 * @param {number} width
 * @param {number} height
 * @param {number} sparseness - 0 (dense objects) to 1 (very sparse objects)
 * @param {number} rngSeed - deterministic random seed
 * @returns {Uint8Array} flat array of tile values
 */
export function generateChunk(width, height, sparseness, rngSeed) {
  const rng = makeRng(rngSeed);
  const tiles = new Uint8Array(width * height).fill(255); // 255 = uncollapsed

  // Weight of each tile type (object rarity controlled by sparseness)
  const weights = {
    [TILE_EMPTY]:  20,
    [TILE_GROUND]: 60,
    [TILE_OBJECT]: Math.max(1, Math.round((1 - sparseness) * 30)),
  };

  // Possibility sets per cell (start = all tiles possible)
  const possible = Array.from({ length: width * height }, () => new Set([0, 1, 2]));

  const idx = (x, y) => y * width + x;
  const neighbors = (x, y) => {
    const n = [];
    if (x > 0)         n.push([x-1, y]);
    if (x < width-1)   n.push([x+1, y]);
    if (y > 0)         n.push([x,   y-1]);
    if (y < height-1)  n.push([x,   y+1]);
    return n;
  };

  // Collapse queue (cells to propagate from)
  const propagate = (x, y) => {
    const stack = [[x, y]];
    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const collapsed = tiles[idx(cx, cy)];
      if (collapsed === 255) continue;

      for (const [nx, ny] of neighbors(cx, cy)) {
        const ni = idx(nx, ny);
        if (tiles[ni] !== 255) continue;

        // Remove possibilities that aren't allowed by the collapsed neighbor
        const allowed = ADJACENCY[collapsed];
        const before = possible[ni].size;
        for (const t of possible[ni]) {
          if (!allowed.has(t)) possible[ni].delete(t);
        }
        if (possible[ni].size < before) {
          stack.push([nx, ny]);
        }
      }
    }
  };

  // Collapse all cells
  for (let iter = 0; iter < width * height; iter++) {
    // Find lowest-entropy uncollapsed cell
    let minEntropy = Infinity;
    let candidates = [];
    for (let i = 0; i < width * height; i++) {
      if (tiles[i] !== 255) continue;
      const e = possible[i].size;
      if (e === 0) {
        // Contradiction — just pick ground
        possible[i].add(TILE_GROUND);
      }
      if (e < minEntropy) { minEntropy = e; candidates = [i]; }
      else if (e === minEntropy) candidates.push(i);
    }
    if (candidates.length === 0) break;

    // Pick random candidate, weighted collapse
    const pick = candidates[Math.floor(rng() * candidates.length)];
    const options = [...possible[pick]];
    const totalWeight = options.reduce((s, t) => s + weights[t], 0);
    let r = rng() * totalWeight;
    let chosen = options[0];
    for (const t of options) {
      r -= weights[t];
      if (r <= 0) { chosen = t; break; }
    }

    tiles[pick] = chosen;
    const px = pick % width;
    const py = Math.floor(pick / width);
    propagate(px, py);
  }

  // Fill any remaining uncollapsed with ground
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 255) tiles[i] = TILE_GROUND;
  }

  return tiles;
}

/** Simple deterministic seeded PRNG (mulberry32) */
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

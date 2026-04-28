import { generateChunk, TILE_EMPTY, TILE_GROUND, TILE_OBJECT, TILE_WATER, TILE_SHORE } from './wfc.js';

const CHUNK_W = 16;
const CHUNK_H = 16;

export class WorldRenderer {
  constructor(canvas, worldData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldData = worldData;

    this.sparseness = worldData.s / 100;
    this.palette = worldData.p;

    const groundGridSize = worldData.gg || 8;
    const objectGridSize = worldData.og || 8;

    // Feature 3: tile display size scales with grid size (6px per tile-pixel)
    this.tilePx   = 6 * groundGridSize;
    this.chunkPxW = CHUNK_W * this.tilePx;
    this.chunkPxH = CHUNK_H * this.tilePx;

    // Feature 1: group pre-rendered ground tiles by label
    const groundLabels = worldData.gl || worldData.gs.map(() => 'land');
    this.tileGroups = { land: [], water: [], shore: [], sand: [] };
    worldData.gs.forEach((pixels, i) => {
      const label = groundLabels[i] || 'land';
      const img = this.renderTile(pixels, groundGridSize);
      (this.tileGroups[label] || this.tileGroups.land).push(img);
    });

    // Fallbacks so every group always has at least one image
    const allGround = Object.values(this.tileGroups).flat();
    const fallback = allGround.length ? allGround : [this.renderTile(worldData.gs[0], groundGridSize)];
    if (!this.tileGroups.land.length)  this.tileGroups.land  = fallback;
    if (!this.tileGroups.water.length) this.tileGroups.water = this.tileGroups.land;
    if (!this.tileGroups.sand.length)  this.tileGroups.sand  = this.tileGroups.land;
    if (!this.tileGroups.shore.length) this.tileGroups.shore = this.tileGroups.sand;

    this.objectImgs = worldData.os.map(p => this.renderTile(p, objectGridSize));

    // Only enable water/shore WFC cells when the user has labeled tiles accordingly
    this.hasWater = groundLabels.some(l => l === 'water' || l === 'shore');

    this.camX = 0;
    this.camY = 0;
    const angle = Math.random() * Math.PI * 2;
    this.driftX = Math.cos(angle) * 0.12;
    this.driftY = Math.sin(angle) * 0.12;

    this.chunkCache = new Map();
    this.baseSeed = worldData.gs[0].reduce((a, b, i) => a + b * (i + 1), 0) +
                    worldData.os[0].reduce((a, b, i) => a + b * (i + 7), 0);

    this.running = false;
  }

  start() { this.running = true; this.loop(); }
  stop()  { this.running = false; }

  loop() {
    if (!this.running) return;
    this.camX += this.driftX;
    this.camY += this.driftY;
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const startCX = Math.floor(this.camX / this.chunkPxW) - 1;
    const startCY = Math.floor(this.camY / this.chunkPxH) - 1;
    const endCX   = Math.ceil((this.camX + canvas.width)  / this.chunkPxW) + 1;
    const endCY   = Math.ceil((this.camY + canvas.height) / this.chunkPxH) + 1;

    for (let cy = startCY; cy <= endCY; cy++) {
      for (let cx = startCX; cx <= endCX; cx++) {
        const chunk = this.getChunk(cx, cy);
        ctx.drawImage(chunk, cx * this.chunkPxW - this.camX, cy * this.chunkPxH - this.camY);
      }
    }

    if (this.chunkCache.size > 64) {
      const toDelete = [];
      for (const key of this.chunkCache.keys()) {
        const [kcx, kcy] = key.split(',').map(Number);
        if (Math.abs(kcx - Math.floor(this.camX / this.chunkPxW)) > 8 ||
            Math.abs(kcy - Math.floor(this.camY / this.chunkPxH)) > 8) {
          toDelete.push(key);
        }
      }
      toDelete.forEach(k => this.chunkCache.delete(k));
    }
  }

  getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.chunkCache.has(key)) return this.chunkCache.get(key);

    const chunkSeed = this.baseSeed ^ (cx * 73856093) ^ (cy * 19349663);
    const tiles = generateChunk(CHUNK_W, CHUNK_H, this.sparseness, chunkSeed, this.hasWater);

    const oc = new OffscreenCanvas(this.chunkPxW, this.chunkPxH);
    const octx = oc.getContext('2d');

    for (let ty = 0; ty < CHUNK_H; ty++) {
      for (let tx = 0; tx < CHUNK_W; tx++) {
        const tile = tiles[ty * CHUNK_W + tx];
        const dx = tx * this.tilePx;
        const dy = ty * this.tilePx;
        const varHash = ((chunkSeed * 1000003 + ty * CHUNK_W + tx) >>> 0);

        if (tile === TILE_EMPTY) {
          octx.fillStyle = '#1a2018';
          octx.fillRect(dx, dy, this.tilePx, this.tilePx);
          continue;
        }

        // Pick the right image group for this cell type
        let group;
        if (tile === TILE_WATER) group = this.tileGroups.water;
        else if (tile === TILE_SHORE) group = this.tileGroups.shore;
        else group = this.tileGroups.land;  // TILE_GROUND or TILE_OBJECT

        const gImg = group[varHash % group.length];
        octx.drawImage(gImg, dx, dy, this.tilePx, this.tilePx);

        if (tile === TILE_OBJECT) {
          const oImg = this.objectImgs[((varHash * 7) >>> 0) % this.objectImgs.length];
          octx.drawImage(oImg, dx, dy, this.tilePx, this.tilePx);
        }
      }
    }

    this.chunkCache.set(key, oc);
    return oc;
  }

  /** Render a palette-indexed pixel array scaled to tilePx×tilePx */
  renderTile(pixels, gridSize) {
    const scale = this.tilePx / gridSize;
    const oc = new OffscreenCanvas(this.tilePx, this.tilePx);
    const ctx = oc.getContext('2d');
    pixels.forEach((colorIdx, i) => {
      if (colorIdx === 0) return;
      const x = i % gridSize;
      const y = Math.floor(i / gridSize);
      ctx.fillStyle = this.palette[colorIdx];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
    return oc;
  }
}

import { generateChunk, TILE_EMPTY, TILE_GROUND, TILE_OBJECT } from './wfc.js';

const TILE_PX = 48;   // each world tile rendered at 48×48 px
const CHUNK_W = 16;
const CHUNK_H = 16;
const CHUNK_PX_W = TILE_PX * CHUNK_W;
const CHUNK_PX_H = TILE_PX * CHUNK_H;

export class WorldRenderer {
  constructor(canvas, worldData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldData = worldData;

    this.sparseness = worldData.s / 100;
    this.palette = worldData.p;

    const groundGridSize = worldData.gg || 16;
    const objectGridSize = worldData.og || 16;

    // Pre-render all tile variants
    this.groundImgs = worldData.gs.map(p => this.renderTile(p, groundGridSize));
    this.objectImgs = worldData.os.map(p => this.renderTile(p, objectGridSize));

    // Camera position (world-pixels, top-left of viewport)
    this.camX = 0;
    this.camY = 0;

    // Slow random drift
    const angle = Math.random() * Math.PI * 2;
    this.driftX = Math.cos(angle) * 0.12;
    this.driftY = Math.sin(angle) * 0.12;

    this.chunkCache = new Map();

    this.baseSeed = worldData.gs[0].reduce((a, b, i) => a + b * (i + 1), 0) +
                    worldData.os[0].reduce((a, b, i) => a + b * (i + 7), 0);

    this.running = false;
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

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

    const startCX = Math.floor(this.camX / CHUNK_PX_W) - 1;
    const startCY = Math.floor(this.camY / CHUNK_PX_H) - 1;
    const endCX = Math.ceil((this.camX + canvas.width) / CHUNK_PX_W) + 1;
    const endCY = Math.ceil((this.camY + canvas.height) / CHUNK_PX_H) + 1;

    for (let cy = startCY; cy <= endCY; cy++) {
      for (let cx = startCX; cx <= endCX; cx++) {
        const chunk = this.getChunk(cx, cy);
        ctx.drawImage(chunk, cx * CHUNK_PX_W - this.camX, cy * CHUNK_PX_H - this.camY);
      }
    }

    // Evict distant chunks
    if (this.chunkCache.size > 64) {
      const toDelete = [];
      for (const key of this.chunkCache.keys()) {
        const [kcx, kcy] = key.split(',').map(Number);
        if (Math.abs(kcx - Math.floor(this.camX / CHUNK_PX_W)) > 8 ||
            Math.abs(kcy - Math.floor(this.camY / CHUNK_PX_H)) > 8) {
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
    const tiles = generateChunk(CHUNK_W, CHUNK_H, this.sparseness, chunkSeed);

    const oc = new OffscreenCanvas(CHUNK_PX_W, CHUNK_PX_H);
    const octx = oc.getContext('2d');

    for (let ty = 0; ty < CHUNK_H; ty++) {
      for (let tx = 0; tx < CHUNK_W; tx++) {
        const tile = tiles[ty * CHUNK_W + tx];
        const dx = tx * TILE_PX;
        const dy = ty * TILE_PX;

        // Deterministic variant per tile position
        const varHash = ((chunkSeed * 1000003 + ty * CHUNK_W + tx) >>> 0);
        const gImg = this.groundImgs[varHash % this.groundImgs.length];
        const oImg = this.objectImgs[((varHash * 7) >>> 0) % this.objectImgs.length];

        if (tile === TILE_EMPTY) {
          octx.fillStyle = '#1a1a2e';
          octx.fillRect(dx, dy, TILE_PX, TILE_PX);
        } else if (tile === TILE_GROUND) {
          octx.drawImage(gImg, dx, dy);
        } else if (tile === TILE_OBJECT) {
          octx.drawImage(gImg, dx, dy);
          octx.drawImage(oImg, dx, dy);
        }
      }
    }

    this.chunkCache.set(key, oc);
    return oc;
  }

  /** Render a pixel array of gridSize×gridSize scaled up to TILE_PX×TILE_PX */
  renderTile(pixels, gridSize) {
    const scale = TILE_PX / gridSize;
    const oc = new OffscreenCanvas(TILE_PX, TILE_PX);
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

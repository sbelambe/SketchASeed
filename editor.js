import { encodeSeed } from './seed.js';

const CANVAS_SIZE = 320; // fixed canvas display size in px
const SIZE_STEPS = [8, 16, 32, 64]; // each step doubles pixel count

const PALETTE = [
  '#111111', // eraser / transparent
  '#2d6a4f', // dark green
  '#52b788', // green
  '#95d5b2', // light green
  '#b7e4c7', // pale green
  '#8B6914', // brown
  '#c9a84c', // tan
  '#e9c46a', // sand
  '#264653', // dark teal
  '#2a9d8f', // teal
  '#48cae4', // sky blue
  '#90e0ef', // light blue
  '#adb5bd', // gray
  '#6c757d', // mid gray
  '#3d3d3d', // dark gray
  '#e76f51', // orange-red
  '#f4a261', // orange
  '#ffd166', // yellow
  '#ffffff', // white
];

export class Editor {
  constructor(container) {
    this.container = container;
    this.groundGridSize = 8;
    this.objectGridSize = 8;
    this.groundTiles = [new Array(8 * 8).fill(0)];
    this.objectTiles = [new Array(8 * 8).fill(0)];
    this.activeGroundIdx = 0;
    this.activeObjectIdx = 0;
    this.activeColor = 1;
    this.painting = false;
    this.sparseness = 0.15;
    this.undoStack = [];
    this.render();
    this.prefillDefaults();
  }

  get groundPixels() { return this.groundTiles[this.activeGroundIdx]; }
  get objectPixels() { return this.objectTiles[this.activeObjectIdx]; }

  cell(which) {
    return CANVAS_SIZE / (which === 'ground' ? this.groundGridSize : this.objectGridSize);
  }

  // Scale all tiles of a type to a new grid size
  changeGridSize(which, newSize) {
    const oldSize = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    if (newSize === oldSize) return;
    const tiles = which === 'ground' ? this.groundTiles : this.objectTiles;
    const scaled = tiles.map(p => this.scalePixels(p, oldSize, newSize));
    if (which === 'ground') {
      this.groundTiles = scaled;
      this.groundGridSize = newSize;
    } else {
      this.objectTiles = scaled;
      this.objectGridSize = newSize;
    }
    this.rerender();
  }

  scalePixels(pixels, fromSize, toSize) {
    const result = new Array(toSize * toSize).fill(0);
    if (toSize > fromSize) {
      const factor = toSize / fromSize;
      for (let y = 0; y < fromSize; y++) {
        for (let x = 0; x < fromSize; x++) {
          const color = pixels[y * fromSize + x];
          for (let dy = 0; dy < factor; dy++) {
            for (let dx = 0; dx < factor; dx++) {
              result[(y * factor + dy) * toSize + (x * factor + dx)] = color;
            }
          }
        }
      }
    } else {
      const factor = fromSize / toSize;
      for (let y = 0; y < toSize; y++) {
        for (let x = 0; x < toSize; x++) {
          result[y * toSize + x] = pixels[Math.floor(y * factor) * fromSize + Math.floor(x * factor)];
        }
      }
    }
    return result;
  }

  pushUndo(which, idx) {
    const src = which === 'ground' ? this.groundTiles[idx] : this.objectTiles[idx];
    this.undoStack.push({ which, idx, pixels: [...src] });
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  undo() {
    if (!this.undoStack.length) return;
    const { which, idx, pixels } = this.undoStack.pop();
    if (which === 'ground') {
      this.groundTiles[idx] = pixels;
      if (this.activeGroundIdx === idx) this.drawCanvas('ground');
    } else {
      this.objectTiles[idx] = pixels;
      if (this.activeObjectIdx === idx) this.drawCanvas('object');
    }
  }

  addTile(which) {
    const size = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    if (which === 'ground') {
      this.groundTiles.push(new Array(size * size).fill(0));
      this.activeGroundIdx = this.groundTiles.length - 1;
    } else {
      this.objectTiles.push(new Array(size * size).fill(0));
      this.activeObjectIdx = this.objectTiles.length - 1;
    }
    this.rerender();
  }

  deleteTile(which) {
    const tiles = which === 'ground' ? this.groundTiles : this.objectTiles;
    const activeIdx = which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx;
    if (tiles.length <= 1) return;
    tiles.splice(activeIdx, 1);
    const newIdx = Math.min(activeIdx, tiles.length - 1);
    if (which === 'ground') this.activeGroundIdx = newIdx;
    else this.activeObjectIdx = newIdx;
    this.rerender();
  }

  switchTile(which, idx) {
    if (which === 'ground') this.activeGroundIdx = idx;
    else this.activeObjectIdx = idx;
    this.rerender();
  }

  rerender() {
    this.render();
  }

  buildTabsHTML(which) {
    const tiles = which === 'ground' ? this.groundTiles : this.objectTiles;
    const activeIdx = which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx;
    const tabs = tiles.map((_, i) =>
      `<button class="tile-tab${i === activeIdx ? ' active' : ''}" data-which="${which}" data-idx="${i}">${i + 1}</button>`
    ).join('');
    return `<div class="tile-tabs">${tabs}<button class="tile-tab-add" data-which="${which}">+</button></div>`;
  }

  buildSizeSliderHTML(which) {
    const gridSize = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    const step = SIZE_STEPS.indexOf(gridSize) + 1;
    return `
      <div class="control-row size-row">
        <label>Size</label>
        <input type="range" class="size-slider" data-which="${which}"
               min="1" max="${SIZE_STEPS.length}" value="${step}" step="1" />
        <span class="size-label">${gridSize}×${gridSize}</span>
      </div>`;
  }

  render() {
    const gHasMultiple = this.groundTiles.length > 1;
    const oHasMultiple = this.objectTiles.length > 1;

    this.container.innerHTML = `
      <div id="editor">
        <h1>Sketch a Seed</h1>
        <div class="editor-panels">

          <div class="panel">
            <h2>Ground Tiles</h2>
            ${this.buildTabsHTML('ground')}
            <div class="pixel-editor-wrap">
              <canvas id="canvas-ground"
                width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"
                style="border:2px solid #334;cursor:crosshair;image-rendering:pixelated;">
              </canvas>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
              <button class="btn" id="btn-clear-ground">Clear</button>
              <button class="btn" id="btn-fill-ground">Fill</button>
              ${gHasMultiple ? '<button class="btn" id="btn-delete-ground">Delete</button>' : ''}
            </div>
            ${this.buildSizeSliderHTML('ground')}
          </div>

          <div class="panel">
            <h2>Color</h2>
            <div class="palette" id="palette"></div>
            <div style="margin-top:14px;">
              <button class="btn" id="btn-undo">↩ Undo</button>
            </div>
            <div class="density-hint">
              <span class="hint-label">Object density</span>
              <span class="hint-desc">How often objects appear on ground in the world</span>
            </div>
            <div class="control-row" style="margin-top:8px;">
              <input type="range" id="sparseness" min="0" max="100" value="${Math.round((1 - this.sparseness) * 100)}" />
              <span id="sparse-val">${Math.round((1 - this.sparseness) * 100)}%</span>
            </div>
          </div>

          <div class="panel">
            <h2>Object Tiles</h2>
            ${this.buildTabsHTML('object')}
            <div class="pixel-editor-wrap">
              <canvas id="canvas-object"
                width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"
                style="border:2px solid #334;cursor:crosshair;image-rendering:pixelated;">
              </canvas>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
              <button class="btn" id="btn-clear-object">Clear</button>
              ${oHasMultiple ? '<button class="btn" id="btn-delete-object">Delete</button>' : ''}
            </div>
            ${this.buildSizeSliderHTML('object')}
          </div>

        </div>

        <div style="display:flex;gap:12px;margin-top:4px;">
          <button class="btn primary" id="btn-preview">Preview World</button>
          <button class="btn primary" id="btn-generate">Generate Share Link</button>
        </div>

        <div class="seed-box" id="seed-box" style="display:none;">
          <label>Share this link with a friend</label>
          <input class="seed-link" id="seed-link" readonly />
          <div class="copy-hint">Click to copy</div>
        </div>
      </div>
    `;

    this.groundCanvas = document.getElementById('canvas-ground');
    this.objectCanvas = document.getElementById('canvas-object');
    this.groundCtx = this.groundCanvas.getContext('2d');
    this.objectCtx = this.objectCanvas.getContext('2d');

    this.buildPalette();
    this.bindCanvasEvents(this.groundCanvas, 'ground');
    this.bindCanvasEvents(this.objectCanvas, 'object');

    // Tile tab clicks
    document.querySelectorAll('.tile-tab').forEach(btn => {
      btn.onclick = () => this.switchTile(btn.dataset.which, parseInt(btn.dataset.idx));
    });
    document.querySelectorAll('.tile-tab-add').forEach(btn => {
      btn.onclick = () => this.addTile(btn.dataset.which);
    });

    // Size sliders
    document.querySelectorAll('.size-slider').forEach(slider => {
      slider.oninput = (e) => {
        const which = e.target.dataset.which;
        const newSize = SIZE_STEPS[parseInt(e.target.value) - 1];
        e.target.closest('.panel').querySelector('.size-label').textContent = `${newSize}×${newSize}`;
        this.changeGridSize(which, newSize);
      };
    });

    // Ground buttons
    document.getElementById('btn-clear-ground').onclick = () => {
      this.pushUndo('ground', this.activeGroundIdx);
      this.groundPixels.fill(0);
      this.drawCanvas('ground');
    };
    document.getElementById('btn-fill-ground').onclick = () => {
      this.pushUndo('ground', this.activeGroundIdx);
      this.groundPixels.fill(this.activeColor);
      this.drawCanvas('ground');
    };
    const delGround = document.getElementById('btn-delete-ground');
    if (delGround) delGround.onclick = () => this.deleteTile('ground');

    // Object buttons
    document.getElementById('btn-clear-object').onclick = () => {
      this.pushUndo('object', this.activeObjectIdx);
      this.objectPixels.fill(0);
      this.drawCanvas('object');
    };
    const delObject = document.getElementById('btn-delete-object');
    if (delObject) delObject.onclick = () => this.deleteTile('object');

    // Undo
    document.getElementById('btn-undo').onclick = () => this.undo();

    // Density slider
    document.getElementById('sparseness').oninput = (e) => {
      const density = parseInt(e.target.value);
      this.sparseness = 1 - density / 100;
      document.getElementById('sparse-val').textContent = density + '%';
    };

    // Preview / share
    document.getElementById('btn-preview').onclick = () => {
      window.open(`?seed=${this.buildSeed()}`, '_blank');
    };
    document.getElementById('btn-generate').onclick = () => {
      const seed = this.buildSeed();
      const url = `${window.location.origin}${window.location.pathname}?seed=${seed}`;
      document.getElementById('seed-box').style.display = 'flex';
      const input = document.getElementById('seed-link');
      input.value = url;
      input.onclick = () => {
        navigator.clipboard.writeText(url).then(() => {
          input.style.borderColor = '#52b788';
          setTimeout(() => input.style.borderColor = '', 1000);
        });
      };
    };

    this.drawCanvas('ground');
    this.drawCanvas('object');
  }

  prefillDefaults() {
    const g = 8;
    // 8×8 grass checkerboard
    for (let i = 0; i < g * g; i++) {
      const x = i % g, y = Math.floor(i / g);
      if ((x + y) % 3 === 0) this.groundTiles[0][i] = 1;
      else if ((x + y) % 3 === 1) this.groundTiles[0][i] = 2;
      else this.groundTiles[0][i] = 3;
    }
    // 8×8 small tree
    const tree = [
      [3,1],[4,1],
      [2,2],[3,2],[4,2],[5,2],
      [1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
      [2,4],[3,4],[4,4],[5,4],
      [3,5],[4,5],
      [3,6],[4,6],
    ];
    tree.forEach(([x, y]) => {
      if (x >= 0 && x < g && y >= 0 && y < g) {
        this.objectTiles[0][y * g + x] = y <= 4 ? 2 : 5;
      }
    });
    this.drawCanvas('ground');
    this.drawCanvas('object');
  }

  buildPalette() {
    const palette = document.getElementById('palette');
    PALETTE.forEach((color, i) => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch' + (i === this.activeColor ? ' active' : '');
      swatch.style.background = color;
      if (i === 0) {
        swatch.style.border = '2px solid #555';
        swatch.style.background = 'transparent';
        swatch.title = 'Transparent / Erase';
      }
      swatch.onclick = () => {
        this.activeColor = i;
        document.querySelectorAll('.swatch').forEach((s, j) => {
          s.classList.toggle('active', j === i);
        });
      };
      palette.appendChild(swatch);
    });
  }

  bindCanvasEvents(canvas, which) {
    const cellSize = this.cell(which);
    const gridSize = which === 'ground' ? this.groundGridSize : this.objectGridSize;

    const getPixel = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = Math.floor(((e.clientX - rect.left) * scaleX) / cellSize);
      const py = Math.floor(((e.clientY - rect.top) * scaleY) / cellSize);
      return [px, py];
    };

    const paint = (e) => {
      const [px, py] = getPixel(e);
      if (px < 0 || px >= gridSize || py < 0 || py >= gridSize) return;
      const pixels = which === 'ground' ? this.groundPixels : this.objectPixels;
      pixels[py * gridSize + px] = this.activeColor;
      this.drawCanvas(which);
    };

    canvas.addEventListener('mousedown', (e) => {
      this.painting = true;
      const idx = which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx;
      this.pushUndo(which, idx);
      paint(e);
    });
    canvas.addEventListener('mousemove', (e) => { if (this.painting) paint(e); });
    window.addEventListener('mouseup', () => { this.painting = false; });
  }

  drawCanvas(which) {
    const canvas = which === 'ground' ? this.groundCanvas : this.objectCanvas;
    const ctx = which === 'ground' ? this.groundCtx : this.objectCtx;
    const pixels = which === 'ground' ? this.groundPixels : this.objectPixels;
    const gridSize = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    const cellSize = CANVAS_SIZE / gridSize;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= gridSize; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, CANVAS_SIZE); ctx.stroke();
    }
    for (let y = 0; y <= gridSize; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(CANVAS_SIZE, y * cellSize); ctx.stroke();
    }

    pixels.forEach((colorIdx, i) => {
      if (colorIdx === 0) return;
      const x = i % gridSize;
      const y = Math.floor(i / gridSize);
      ctx.fillStyle = PALETTE[colorIdx];
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    });
  }

  buildSeed() {
    return encodeSeed({
      groundTiles: this.groundTiles,
      objectTiles: this.objectTiles,
      groundGridSize: this.groundGridSize,
      objectGridSize: this.objectGridSize,
      sparseness: this.sparseness,
      palette: PALETTE,
    });
  }
}

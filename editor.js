import { encodeSeed, decodeSeed } from './seed.js';
import { EXAMPLES } from './examples.js';
import { matchTheme } from './themes.js';
import { loadTilesets, deleteTileset, setLoadFlag, consumeLoadFlag } from './storage.js';

const CANVAS_SIZE = 400;
const SIZE_STEPS = [8, 16, 32, 64];

const PALETTE = [
  '#111111', // 0  eraser / transparent
  '#2d6a4f', // 1  dark green
  '#52b788', // 2  green
  '#95d5b2', // 3  light green
  '#b7e4c7', // 4  pale green
  '#8B6914', // 5  brown
  '#c9a84c', // 6  tan
  '#e9c46a', // 7  sand
  '#264653', // 8  dark teal
  '#2a9d8f', // 9  teal
  '#48cae4', // 10 sky blue
  '#90e0ef', // 11 light blue
  '#adb5bd', // 12 gray
  '#6c757d', // 13 mid gray
  '#3d3d3d', // 14 dark gray
  '#e76f51', // 15 orange-red
  '#f4a261', // 16 orange
  '#ffd166', // 17 yellow
  '#ffffff', // 18 white
];

const LABEL_OPTIONS = [
  { value: 'land',  emoji: '🌱', label: 'Land'  },
  { value: 'water', emoji: '💧', label: 'Water' },
  { value: 'shore', emoji: '🏖', label: 'Shore' },
  { value: 'sand',  emoji: '🏜', label: 'Sand'  },
];

export class Editor {
  constructor(container) {
    this.container = container;
    this.groundGridSize = 8;
    this.objectGridSize = 8;
    this.groundTiles  = [new Array(64).fill(0)];
    this.objectTiles  = [new Array(64).fill(0)];
    this.groundLabels = ['land'];
    this.objectLabels = ['land'];
    this.activeGroundIdx = 0;
    this.activeObjectIdx = 0;
    this.activeColor = 1;
    this.painting = false;
    this.sparseness = 0.15;
    this.undoStack = [];

    // Feature 5: load a saved tileset if flagged
    const loadSeed = consumeLoadFlag();
    if (loadSeed) {
      const data = decodeSeed(loadSeed);
      if (data) this.loadFromSeedData(data);
    }

    this.render();
    if (!loadSeed) this.prefillDefaults();
  }

  // ── Getters ────────────────────────────────────────────────────
  get groundPixels() { return this.groundTiles[this.activeGroundIdx]; }
  get objectPixels() { return this.objectTiles[this.activeObjectIdx]; }

  cell(which) {
    return CANVAS_SIZE / (which === 'ground' ? this.groundGridSize : this.objectGridSize);
  }

  // ── Feature 5: load seed data into editor ─────────────────────
  loadFromSeedData(data) {
    this.groundTiles    = data.gs;
    this.objectTiles    = data.os;
    this.groundGridSize = data.gg || 8;
    this.objectGridSize = data.og || 8;
    this.sparseness     = (data.s || 15) / 100;
    this.groundLabels   = data.gl || data.gs.map(() => 'land');
    this.objectLabels   = data.ol || data.os.map(() => 'land');
    this.activeGroundIdx = 0;
    this.activeObjectIdx = 0;
  }

  // ── Grid resize ────────────────────────────────────────────────
  changeGridSize(which, newSize) {
    const oldSize = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    if (newSize === oldSize) return;
    const tiles = which === 'ground' ? this.groundTiles : this.objectTiles;
    const scaled = tiles.map(p => this.scalePixels(p, oldSize, newSize));
    if (which === 'ground') { this.groundTiles = scaled; this.groundGridSize = newSize; }
    else                    { this.objectTiles = scaled; this.objectGridSize = newSize; }
    this.rerender();
  }

  scalePixels(pixels, fromSize, toSize) {
    const result = new Array(toSize * toSize).fill(0);
    if (toSize > fromSize) {
      const factor = toSize / fromSize;
      for (let y = 0; y < fromSize; y++)
        for (let x = 0; x < fromSize; x++) {
          const color = pixels[y * fromSize + x];
          for (let dy = 0; dy < factor; dy++)
            for (let dx = 0; dx < factor; dx++)
              result[(y * factor + dy) * toSize + (x * factor + dx)] = color;
        }
    } else {
      const factor = fromSize / toSize;
      for (let y = 0; y < toSize; y++)
        for (let x = 0; x < toSize; x++)
          result[y * toSize + x] = pixels[Math.floor(y * factor) * fromSize + Math.floor(x * factor)];
    }
    return result;
  }

  // ── Undo ───────────────────────────────────────────────────────
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

  // ── Tile tabs ──────────────────────────────────────────────────
  addTile(which) {
    const size = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    if (which === 'ground') {
      this.groundTiles.push(new Array(size * size).fill(0));
      this.groundLabels.push('land');
      this.activeGroundIdx = this.groundTiles.length - 1;
    } else {
      this.objectTiles.push(new Array(size * size).fill(0));
      this.objectLabels.push('land');
      this.activeObjectIdx = this.objectTiles.length - 1;
    }
    this.rerender();
  }

  deleteTile(which) {
    const tiles  = which === 'ground' ? this.groundTiles  : this.objectTiles;
    const labels = which === 'ground' ? this.groundLabels : this.objectLabels;
    const activeIdx = which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx;
    if (tiles.length <= 1) return;
    tiles.splice(activeIdx, 1);
    labels.splice(activeIdx, 1);
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

  rerender() { this.render(); }

  // ── HTML builders ──────────────────────────────────────────────
  buildTabsHTML(which) {
    const tiles     = which === 'ground' ? this.groundTiles     : this.objectTiles;
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

  // Feature 2: label pill selector
  buildLabelSelectorHTML(which) {
    const idx     = which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx;
    const labels  = which === 'ground' ? this.groundLabels    : this.objectLabels;
    const current = labels[idx] || 'land';
    const pills = LABEL_OPTIONS.map(opt =>
      `<button class="label-pill${current === opt.value ? ' active' : ''}"
               data-label="${opt.value}" data-which="${which}">
         ${opt.emoji} ${opt.label}
       </button>`
    ).join('');
    return `<div class="label-pills">${pills}</div>`;
  }

  // ── Main render ────────────────────────────────────────────────
  render() {
    const gHasMultiple = this.groundTiles.length > 1;
    const oHasMultiple = this.objectTiles.length > 1;
    const density = Math.round((1 - this.sparseness) * 100);

    this.container.innerHTML = `
      <div id="editor">
        <h1>Sketch a Seed 🌿</h1>
        <p class="tagline">Draw pixel tiles. Grow infinite worlds. Share with friends.</p>

        <div class="editor-panels">

          <!-- Step 1: Ground Tile -->
          <div class="panel">
            <span class="step-label">Step 1</span>
            <h2>Ground Tile</h2>
            ${this.buildTabsHTML('ground')}
            <div class="pixel-editor-wrap">
              <canvas id="canvas-ground" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"
                style="border:2px solid rgba(40,80,45,0.25);cursor:crosshair;image-rendering:pixelated;border-radius:8px;">
              </canvas>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
              <button class="btn" id="btn-clear-ground">Clear</button>
              <button class="btn" id="btn-fill-ground">Fill</button>
              ${gHasMultiple ? '<button class="btn" id="btn-delete-ground">Delete</button>' : ''}
            </div>
            ${this.buildLabelSelectorHTML('ground')}
            ${this.buildSizeSliderHTML('ground')}
          </div>

          <!-- Step 2: Colors & Density -->
          <div class="panel">
            <span class="step-label">Step 2</span>
            <h2>Colors &amp; Density</h2>
            <div class="palette" id="palette"></div>
            <div style="margin-top:12px;">
              <button class="btn" id="btn-undo">↩ Undo</button>
            </div>
            <div class="density-hint">
              <span class="hint-label">Object density</span>
              <span class="hint-desc">How crowded is your world with objects?</span>
            </div>
            <div class="control-row" style="margin-top:8px;">
              <input type="range" id="sparseness" min="0" max="100" value="${density}" />
              <span id="sparse-val">${density}%</span>
            </div>
            <div class="density-hint" style="margin-top:18px;">
              <span class="hint-label">World theme</span>
              <span class="hint-desc">Describe your world for suggestions</span>
            </div>
            <div class="theme-row">
              <input type="text" id="theme-input" class="theme-input" placeholder="forest, ocean, desert…" />
              <button class="btn" id="btn-theme">Apply</button>
            </div>
            <div class="theme-hint" id="theme-hint"></div>
          </div>

          <!-- Step 3: Object Tile -->
          <div class="panel">
            <span class="step-label">Step 3</span>
            <h2>Object Tile</h2>
            ${this.buildTabsHTML('object')}
            <div class="pixel-editor-wrap">
              <canvas id="canvas-object" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"
                style="border:2px solid rgba(40,80,45,0.25);cursor:crosshair;image-rendering:pixelated;border-radius:8px;">
              </canvas>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
              <button class="btn" id="btn-clear-object">Clear</button>
              ${oHasMultiple ? '<button class="btn" id="btn-delete-object">Delete</button>' : ''}
            </div>
            ${this.buildLabelSelectorHTML('object')}
            ${this.buildSizeSliderHTML('object')}
          </div>

        </div>

        <!-- Action buttons -->
        <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
          <button class="btn primary" id="btn-preview">Preview World ✨</button>
          <button class="btn primary share" id="btn-generate">Copy Share Link 🔗</button>
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
    this.groundCtx    = this.groundCanvas.getContext('2d');
    this.objectCtx    = this.objectCanvas.getContext('2d');

    this.buildPalette();
    this.bindCanvasEvents(this.groundCanvas, 'ground');
    this.bindCanvasEvents(this.objectCanvas, 'object');
    this.bindEditorEvents();

    this.drawCanvas('ground');
    this.drawCanvas('object');
    this.buildExamplesSection();
    this.buildSavedTilesetsSection();
    this.buildDevTools();
  }

  bindEditorEvents() {
    // Tile tabs
    document.querySelectorAll('.tile-tab').forEach(btn => {
      btn.onclick = () => this.switchTile(btn.dataset.which, parseInt(btn.dataset.idx));
    });
    document.querySelectorAll('.tile-tab-add').forEach(btn => {
      btn.onclick = () => this.addTile(btn.dataset.which);
    });

    // Feature 2: label pills
    document.querySelectorAll('.label-pill').forEach(btn => {
      btn.onclick = () => {
        const { which, label } = btn.dataset;
        const idx = which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx;
        if (which === 'ground') this.groundLabels[idx] = label;
        else this.objectLabels[idx] = label;
        document.querySelectorAll(`.label-pill[data-which="${which}"]`).forEach(p =>
          p.classList.toggle('active', p.dataset.label === label)
        );
      };
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

    // Ground tile buttons
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

    // Object tile buttons
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

    // Feature 4: theme prompt
    document.getElementById('btn-theme').onclick = () => this.applyTheme();
    document.getElementById('theme-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyTheme();
    });

    // Preview / share
    document.getElementById('btn-preview').onclick = () => {
      window.open(`#seed=${this.buildSeed()}`, '_blank');
    };
    document.getElementById('btn-generate').onclick = () => {
      const seed = this.buildSeed();
      const url  = `${window.location.origin}${window.location.pathname}#seed=${seed}`;
      document.getElementById('seed-box').style.display = 'flex';
      const input = document.getElementById('seed-link');
      input.value = url;
      input.onclick = () => {
        navigator.clipboard.writeText(url).then(() => {
          input.style.borderColor = '#4a7350';
          setTimeout(() => { input.style.borderColor = ''; }, 1000);
        });
      };
    };
  }

  // Feature 4: apply world theme preset
  applyTheme() {
    const text  = document.getElementById('theme-input').value;
    const theme = matchTheme(text);
    const hint  = document.getElementById('theme-hint');

    if (!theme) {
      hint.textContent = 'No match — try: forest, ocean, desert, meadow, snow, swamp, beach';
      hint.style.color = 'var(--rose)';
      return;
    }

    // Update density
    const newDensity = Math.round((1 - theme.densityHint) * 100);
    this.sparseness = theme.densityHint;
    document.getElementById('sparseness').value = newDensity;
    document.getElementById('sparse-val').textContent = newDensity + '%';

    // Flash palette highlights
    const swatches = document.querySelectorAll('.swatch');
    theme.paletteHighlight.forEach(i => {
      if (!swatches[i]) return;
      swatches[i].style.transition = 'transform 0.2s, box-shadow 0.2s';
      swatches[i].style.transform  = 'scale(1.45)';
      swatches[i].style.boxShadow  = '0 0 0 3px var(--sage)';
      setTimeout(() => {
        swatches[i].style.transform = '';
        swatches[i].style.boxShadow = '';
      }, 1600);
    });

    // Show hint
    hint.textContent = `${theme.name} ✓  ${theme.hint}`;
    hint.style.color = 'var(--sage)';
  }

  // ── Sections appended after main render ───────────────────────

  buildExamplesSection() {
    const editorEl = document.getElementById('editor');
    const section  = document.createElement('div');
    section.className = 'examples-section';
    section.innerHTML = `
      <div class="section-label">✨ Explore example worlds</div>
      <div class="example-cards" id="example-cards"></div>
    `;
    editorEl.appendChild(section);

    const container = section.querySelector('#example-cards');
    EXAMPLES.forEach(ex => {
      const seed = encodeSeed({
        groundTiles: ex.groundTiles, objectTiles: ex.objectTiles,
        groundGridSize: ex.gridSize, objectGridSize: ex.gridSize,
        sparseness: ex.sparseness,  palette: PALETTE,
      });
      const url  = `${window.location.origin}${window.location.pathname}#seed=${seed}`;
      const card = document.createElement('div');
      card.className = 'example-card';
      card.innerHTML = `
        <div class="example-emoji">${ex.emoji}</div>
        <h3>${ex.name}</h3>
        <p>${ex.description}</p>
        <div class="ingredients">
          🌿 Ground: ${ex.groundIngredient}<br>
          ✨ Object: ${ex.objectIngredient}
        </div>
        <button class="try-btn">Open screensaver →</button>
      `;
      card.querySelector('.try-btn').onclick = () => window.open(url, '_blank');
      container.appendChild(card);
    });
  }

  // Feature 5: saved tilesets gallery
  buildSavedTilesetsSection() {
    const tilesets = loadTilesets();
    if (!tilesets.length) return;

    const editorEl = document.getElementById('editor');
    const section  = document.createElement('div');
    section.className = 'saved-section';
    section.innerHTML = `
      <div class="section-label">🗂 My Saved Tilesets</div>
      <div class="example-cards" id="saved-cards"></div>
    `;
    editorEl.appendChild(section);

    const container = section.querySelector('#saved-cards');
    tilesets.forEach(ts => {
      const date = new Date(ts.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const card = document.createElement('div');
      card.className = 'saved-card';
      card.innerHTML = `
        <div class="saved-card-header">
          <h3>${ts.name}</h3>
          <button class="saved-delete-btn" title="Remove">✕</button>
        </div>
        <p class="saved-date">Saved ${date}</p>
        <button class="try-btn">Load into Editor</button>
      `;
      card.querySelector('.try-btn').onclick = () => {
        setLoadFlag(ts.seed);
        window.location.reload();
      };
      card.querySelector('.saved-delete-btn').onclick = () => {
        deleteTileset(ts.id);
        card.remove();
        if (!container.querySelector('.saved-card')) section.remove();
      };
      container.appendChild(card);
    });
  }

  // Feature 6: dev export tool
  buildDevTools() {
    const editorEl = document.getElementById('editor');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;justify-content:center;margin-top:10px;';
    const btn = document.createElement('button');
    btn.className = 'dev-btn';
    btn.textContent = '📋 Copy as Example';
    btn.onclick = () => this.showDevModal();
    wrap.appendChild(btn);
    editorEl.appendChild(wrap);
  }

  showDevModal() {
    const obj = {
      name: 'My Example',
      emoji: '🌿',
      description: '',
      groundIngredient: '',
      objectIngredient: '',
      groundTiles: this.groundTiles,
      objectTiles: this.objectTiles,
      gridSize: this.groundGridSize,
      sparseness: this.sparseness,
    };
    const code = JSON.stringify(obj, null, 2);

    const modal = document.createElement('div');
    modal.className = 'dev-modal';
    modal.innerHTML = `
      <div class="dev-modal-inner">
        <h3>📋 Copy as Example</h3>
        <p>Paste this object inside the <code>EXAMPLES</code> array in <code>examples.js</code>:</p>
        <textarea class="dev-textarea" readonly>${code}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button class="btn dev-copy-btn">Copy to Clipboard</button>
          <button class="btn" id="dev-close">Close</button>
        </div>
      </div>`;
    modal.querySelector('#dev-close').onclick = () => modal.remove();
    modal.querySelector('.dev-copy-btn').onclick = (e) => {
      navigator.clipboard.writeText(code).then(() => {
        e.target.textContent = '✓ Copied!';
        setTimeout(() => { e.target.textContent = 'Copy to Clipboard'; }, 2000);
      });
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }

  // ── Palette ────────────────────────────────────────────────────
  buildPalette() {
    const palette = document.getElementById('palette');
    PALETTE.forEach((color, i) => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch' + (i === this.activeColor ? ' active' : '');
      swatch.style.background = color;
      if (i === 0) {
        swatch.classList.add('eraser');
        swatch.title = 'Transparent / Erase';
      }
      swatch.onclick = () => {
        this.activeColor = i;
        document.querySelectorAll('.swatch').forEach((s, j) =>
          s.classList.toggle('active', j === i)
        );
      };
      palette.appendChild(swatch);
    });
  }

  // ── Canvas painting ────────────────────────────────────────────
  bindCanvasEvents(canvas, which) {
    const getPixel = (e) => {
      const rect    = canvas.getBoundingClientRect();
      const scaleX  = canvas.width / rect.width;
      const scaleY  = canvas.height / rect.height;
      const cellSz  = this.cell(which);
      return [
        Math.floor(((e.clientX - rect.left) * scaleX) / cellSz),
        Math.floor(((e.clientY - rect.top)  * scaleY) / cellSz),
      ];
    };
    const gridSize = () => which === 'ground' ? this.groundGridSize : this.objectGridSize;

    const paint = (e) => {
      const [px, py] = getPixel(e);
      const g = gridSize();
      if (px < 0 || px >= g || py < 0 || py >= g) return;
      const pixels = which === 'ground' ? this.groundPixels : this.objectPixels;
      pixels[py * g + px] = this.activeColor;
      this.drawCanvas(which);
    };

    canvas.addEventListener('mousedown', (e) => {
      this.painting = true;
      this.pushUndo(which, which === 'ground' ? this.activeGroundIdx : this.activeObjectIdx);
      paint(e);
    });
    canvas.addEventListener('mousemove', (e) => { if (this.painting) paint(e); });
    window.addEventListener('mouseup', () => { this.painting = false; });
  }

  drawCanvas(which) {
    const canvas   = which === 'ground' ? this.groundCanvas : this.objectCanvas;
    const ctx      = which === 'ground' ? this.groundCtx    : this.objectCtx;
    const pixels   = which === 'ground' ? this.groundPixels : this.objectPixels;
    const gridSize = which === 'ground' ? this.groundGridSize : this.objectGridSize;
    const cellSize = CANVAS_SIZE / gridSize;

    ctx.fillStyle = '#1d2b1e';
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
      ctx.fillStyle = PALETTE[colorIdx];
      ctx.fillRect((i % gridSize) * cellSize, Math.floor(i / gridSize) * cellSize, cellSize, cellSize);
    });
  }

  // ── Seed build ─────────────────────────────────────────────────
  buildSeed() {
    return encodeSeed({
      groundTiles:    this.groundTiles,
      objectTiles:    this.objectTiles,
      groundGridSize: this.groundGridSize,
      objectGridSize: this.objectGridSize,
      sparseness:     this.sparseness,
      palette:        PALETTE,
      groundLabels:   this.groundLabels,
      objectLabels:   this.objectLabels,
    });
  }

  // ── Default prefill ────────────────────────────────────────────
  prefillDefaults() {
    const g = 8;
    for (let i = 0; i < g * g; i++) {
      const x = i % g, y = Math.floor(i / g);
      if      ((x + y) % 3 === 0) this.groundTiles[0][i] = 1;
      else if ((x + y) % 3 === 1) this.groundTiles[0][i] = 2;
      else                         this.groundTiles[0][i] = 3;
    }
    const tree = [
      [3,1],[4,1],
      [2,2],[3,2],[4,2],[5,2],
      [1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
      [2,4],[3,4],[4,4],[5,4],
      [3,5],[4,5],[3,6],[4,6],
    ];
    tree.forEach(([x, y]) => {
      if (x >= 0 && x < g && y >= 0 && y < g)
        this.objectTiles[0][y * g + x] = y <= 4 ? 2 : 5;
    });
    this.drawCanvas('ground');
    this.drawCanvas('object');
  }
}

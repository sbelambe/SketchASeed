import { decodeSeed } from './seed.js';
import { WorldRenderer } from './worldRenderer.js';
import { saveTileset } from './storage.js';

export class Screensaver {
  constructor(container, seedString) {
    this.container = container;

    const data = decodeSeed(seedString);

    if (!data) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                    flex-direction:column;gap:16px;font-family:'Nunito',sans-serif;color:#4a6950;background:#c2d9c4;">
          <div style="font-size:2.5rem;">🌿</div>
          <div style="font-size:1rem;font-weight:700;color:#1a2e1c;">Hmm, that seed looks odd.</div>
          <div style="font-size:0.85rem;">The link might be broken or incomplete.</div>
          <a href="/" style="color:#4a7350;font-size:0.85rem;font-weight:700;text-decoration:none;">← Draw your own world</a>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div id="screensaver">
        <canvas id="world-canvas"></canvas>
        <button class="ss-back-btn" id="btn-back">← Back</button>
        <button class="ss-save-btn" id="btn-save">💾 Save Tileset</button>
        <div class="ss-overlay">Sketch a Seed 🌿</div>
      </div>`;

    const canvas = document.getElementById('world-canvas');
    this.sizeCanvas(canvas);
    window.addEventListener('resize', () => this.sizeCanvas(canvas));

    document.getElementById('btn-back').onclick = () => {
      if (window.opener) window.close();
      else window.location.href = window.location.pathname;
    };

    document.getElementById('btn-save').onclick = () => this.showSaveModal(seedString);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (window.opener) window.close();
        else window.location.href = window.location.pathname;
      }
    });

    this.renderer = new WorldRenderer(canvas, data);
    this.renderer.start();
  }

  showSaveModal(seed) {
    const modal = document.createElement('div');
    modal.className = 'save-modal';
    modal.innerHTML = `
      <div class="save-modal-inner">
        <h3>💾 Save Tileset</h3>
        <p>Give this world a name so you can find it later:</p>
        <input type="text" id="save-name-input" placeholder="My Mossy Forest…" maxlength="50" autofocus />
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
          <button class="btn" id="save-cancel">Cancel</button>
          <button class="btn primary share" id="save-confirm">Save</button>
        </div>
      </div>`;

    modal.querySelector('#save-cancel').onclick = () => modal.remove();
    modal.querySelector('#save-confirm').onclick = () => {
      const name = modal.querySelector('#save-name-input').value.trim() || 'Untitled World';
      saveTileset(name, seed);
      modal.remove();
      this.showToast(`"${name}" saved! Load it from the home page.`);
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.querySelector('#save-name-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') modal.querySelector('#save-confirm').click();
    });
    document.body.appendChild(modal);
    setTimeout(() => modal.querySelector('#save-name-input').focus(), 50);
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'ss-toast';
    toast.textContent = msg;
    document.getElementById('screensaver').appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  sizeCanvas(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (this.renderer) this.renderer.draw();
  }
}

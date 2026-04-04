import { decodeSeed } from './seed.js';
import { WorldRenderer } from './worldRenderer.js';

export class Screensaver {
  constructor(container, seedString) {
    this.container = container;

    const data = decodeSeed(seedString);

    if (!data) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                    flex-direction:column;gap:16px;font-family:'Courier New',monospace;color:#556;">
          <div style="font-size:2rem;">⚠</div>
          <div style="letter-spacing:3px;text-transform:uppercase;font-size:0.8rem;">Invalid seed</div>
          <a href="/" style="color:#8888aa;font-size:0.7rem;letter-spacing:2px;">← Create your own</a>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div id="screensaver">
        <canvas id="world-canvas"></canvas>
        <button class="ss-back-btn" id="btn-back">← Back</button>
        <div class="ss-overlay">Sketch a Seed</div>
      </div>`;

    const canvas = document.getElementById('world-canvas');
    this.sizeCanvas(canvas);
    window.addEventListener('resize', () => this.sizeCanvas(canvas));

    document.getElementById('btn-back').onclick = () => {
      window.location.href = window.location.pathname;
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.location.href = window.location.pathname;
    });

    this.renderer = new WorldRenderer(canvas, data);
    this.renderer.start();
  }

  sizeCanvas(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (this.renderer) this.renderer.draw();
  }
}

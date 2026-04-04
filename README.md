# Sketch a Seed

Draw pixel tiles → generate infinite PCG worlds → share with friends.

## How it works

1. **Editor mode** (no URL params): Draw a 16×16 ground tile and object tile using a pixel editor. Set object density. Click "Generate Share Link".
2. **Screensaver mode** (`?seed=...`): The entire world is encoded in the URL. Friends open the link and see an infinite, slowly drifting world built from your drawings.

## Tech

- **Pure vanilla JS** — ES modules, no bundler needed
- **Wave Function Collapse** — `src/wfc.js` — 3 tile types (empty, ground, object) with adjacency rules
- **Chunk-based infinite world** — `src/worldRenderer.js` — generates and caches 16×16 tile chunks, evicts distant ones
- **URL-encoded seed** — `src/seed.js` — all pixel data + settings compressed into a base64 URL param

## Run

```bash
npm install
npm run dev
# Open http://localhost:3000
```

Or just open `index.html` via any static file server (CORS required for ES modules).

## File structure

```
SketchaSeed/
  index.html          ← entry point
  styles.css          ← all styles
  src/
    main.js           ← routes to editor or screensaver based on URL
    editor.js         ← pixel drawing UI
    screensaver.js    ← screensaver display mode
    worldRenderer.js  ← chunk-based canvas renderer
    wfc.js            ← Wave Function Collapse tile generator
    seed.js           ← encode/decode world data to/from URL
```

## Extending

### Add more tile types
In `wfc.js`, add `TILE_WATER = 3` etc., update `ADJACENCY`, and update `WorldRenderer` to handle it.

### Add more user drawings
In `editor.js`, add more canvas panels (water tile, rock tile, etc.) and pass them through `seed.js` + `worldRenderer.js`.

### Tweak WFC feel
Adjust `weights` in `wfc.js` to change how often each tile type appears.

### Add zoom
In `worldRenderer.js`, add a `scale` factor and multiply all draw coordinates by it.

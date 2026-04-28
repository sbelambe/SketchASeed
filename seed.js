/**
 * Encode world data into a compact URL-safe string.
 * v2 format: { v:2, gs, os, gg, og, s, p, gl?, ol? }
 *   gs  = array of ground tile pixel arrays
 *   os  = array of object tile pixel arrays
 *   gg  = ground grid size (8, 16, 32, 64)
 *   og  = object grid size
 *   s   = sparseness (0-100)
 *   p   = palette
 *   gl  = groundLabels array (optional, omitted if all 'land')
 *   ol  = objectLabels array (optional, omitted if all 'land')
 */

export function encodeSeed({ groundTiles, objectTiles, groundGridSize, objectGridSize, sparseness, palette, groundLabels, objectLabels }) {
  const data = {
    v: 2,
    gs: groundTiles,
    os: objectTiles,
    gg: groundGridSize,
    og: objectGridSize,
    s: Math.round(sparseness * 100),
    p: palette,
  };
  if (groundLabels && groundLabels.some(l => l && l !== 'land')) data.gl = groundLabels;
  if (objectLabels && objectLabels.some(l => l && l !== 'land')) data.ol = objectLabels;

  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSeed(seed) {
  try {
    const b64 = seed.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);

    // Normalize v1 → v2 shape
    if (data.v === 1) {
      data.gs = [data.g];
      data.os = [data.o];
      data.gg = 16;
      data.og = 16;
    }

    if (!data.gg) data.gg = 16;
    if (!data.og) data.og = 16;

    // Default labels if absent
    if (!data.gl) data.gl = data.gs.map(() => 'land');
    if (!data.ol) data.ol = data.os.map(() => 'land');

    return data;
  } catch (e) {
    console.error('Failed to decode seed:', e);
    return null;
  }
}

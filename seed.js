/**
 * Encode world data into a compact URL-safe string.
 * v2 format: { v:2, gs, os, gg, og, s, p }
 *   gs = array of ground tile pixel arrays
 *   os = array of object tile pixel arrays
 *   gg = ground grid size (8, 16, 32, 64)
 *   og = object grid size
 *   s  = sparseness (0-100)
 *   p  = palette
 *
 * v1 (legacy): single g/o arrays, no grid sizes — normalized on decode.
 */

export function encodeSeed({ groundTiles, objectTiles, groundGridSize, objectGridSize, sparseness, palette }) {
  const data = {
    v: 2,
    gs: groundTiles,
    os: objectTiles,
    gg: groundGridSize,
    og: objectGridSize,
    s: Math.round(sparseness * 100),
    p: palette,
  };
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

    // Default grid sizes for v2 seeds that predate this field
    if (!data.gg) data.gg = 16;
    if (!data.og) data.og = 16;

    return data;
  } catch (e) {
    console.error('Failed to decode seed:', e);
    return null;
  }
}

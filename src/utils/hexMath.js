// All the flat-top hex geometry lives here. Nothing in this file knows
// about React or app state — it's pure math, so it's easy to unit-test
// or reuse (e.g. in the minimap, which needs the same conversions at a
// different scale).

export const MIN_HEX_SIZE = 12;
export const MAX_HEX_SIZE = 90;

export function key(c, r) {
  return `${c},${r}`;
}

export function parseKey(k) {
  const [c, r] = k.split(',').map(Number);
  return { c, r };
}

// Largest hex radius that fits `cols` x `rows` hexes inside the given
// pixel box, leaving `padding` px of margin.
export function calcHexSize(cols, rows, availWidth, availHeight, padding = 48) {
  const w = availWidth - padding;
  const h = availHeight - padding;
  const sizeFromWidth = w / (1.5 * (cols - 1) + 2);
  const sizeFromHeight = h / (Math.sqrt(3) * (rows + 0.5));
  let size = Math.min(sizeFromWidth, sizeFromHeight);
  if (!isFinite(size) || isNaN(size)) size = 32;
  return Math.max(MIN_HEX_SIZE, Math.min(MAX_HEX_SIZE, size));
}

export function hexToPixel(c, r, hexSize) {
  const h = Math.sqrt(3) * hexSize;
  const horizSpacing = hexSize * 1.5;
  const x = hexSize + c * horizSpacing;
  const y = h / 2 + r * h + (c % 2 === 1 ? h / 2 : 0);
  return { x, y };
}

export function gridPixelSize(cols, rows, hexSize) {
  const w = hexSize * 2;
  const h = Math.sqrt(3) * hexSize;
  const horizSpacing = w * 0.75;
  return {
    width: horizSpacing * (cols - 1) + w + 20,
    height: h * rows + h / 2 + 20,
  };
}

// Vertices of a flat-top hex centred at (cx, cy). `sizeOverride` lets
// callers draw an inset silhouette (e.g. the faction-emblem clip path).
export function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}

export function normalizeColor(c) {
  return (c || '').toLowerCase();
}

export function hexToRgba(hex, opacity) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const a = opacity == null ? 1 : opacity;
  return `rgba(${r},${g},${b},${a})`;
}

// The six neighbours of (c, r) in the odd-q offset layout used by
// hexToPixel above (odd columns shoved down by half a hex height).
// Used for territory connectivity — flood-filling from a faction's
// home-base hex through adjacent same-coloured hexes.
export function hexNeighbors(c, r) {
  if (c % 2 === 0) {
    return [
      [c, r - 1], [c, r + 1],
      [c - 1, r - 1], [c - 1, r],
      [c + 1, r - 1], [c + 1, r],
    ];
  }
  return [
    [c, r - 1], [c, r + 1],
    [c - 1, r], [c - 1, r + 1],
    [c + 1, r], [c + 1, r + 1],
  ];
}

export function toHexColor(c) {
  if (c && c.startsWith('#') && c.length === 7) return c;
  return '#202325';
}

// Fisher-Yates. Used by reward randomisation to shuffle both the
// eligible hex list and the reward "bag" before pairing them up.
export function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

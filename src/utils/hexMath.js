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

// Inverse of hexToPixel: which (existing) hex is closest to a given
// point, for snapping a mouse release to a hex — e.g. finishing a
// dragged movement arrow. Just a nearest-centre search rather than
// real point-in-hexagon math; the grid's hexes are spaced far enough
// apart relative to their size that "nearest centre" and "which hex
// contains this point" agree for every point that's actually within
// some hex, and the maxDist cutoff rejects points that are in neither
// (e.g. a release out past the edge of the grid).
export function pixelToHex(x, y, cols, rows, hexSize, isValid) {
  let bestKey = null;
  let bestDist = Infinity;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (isValid && !isValid(c, r)) continue;
      const p = hexToPixel(c, r, hexSize);
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = `${c},${r}`;
      }
    }
  }
  return bestDist <= hexSize * 1.05 ? bestKey : null;
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

// Blends a hex colour toward white (positive amount) or black (negative
// amount) — used to derive an effect's brighter/darker glow tones and
// white-hot core from a single GM-chosen base colour instead of
// hardcoding unrelated shades. Returns a hex string (not rgb(...)) so
// the result can still be fed through hexToRgba for alpha layers.
// Shared by HexTile's Battle Effect explosions and ArtilleryStrike's
// launch/impact bursts and shell.
export function lightenColor(hex, amount) {
  const clean = (hex || '').replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const adjust = (ch) => Math.max(0, Math.min(255, Math.round(ch + (amount >= 0 ? (255 - ch) : ch) * amount)));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}

// Converts our odd-q offset coordinates (see hexNeighbors below) to
// cube coordinates, which is what makes "is this hex within radius N
// of the centre" a plain distance check instead of a maze of offset
// special-casing. Used by isInHexagonShape for the Hexagon map shape.
export function oddQToCube(c, r) {
  const x = c;
  const z = r - (c - (c & 1)) / 2;
  const y = -x - z;
  return { x, y, z };
}

export function hexDistance(c1, r1, c2, r2) {
  const a = oddQToCube(c1, r1);
  const b = oddQToCube(c2, r2);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

// A "hexagon of hexagons" needs an odd diameter to have a true centre
// hex and stay symmetric — this snaps whatever size the GM typed (or
// an average of an uneven cols/rows pair) to the nearest clean size.
export function cleanHexagonDiameter(n) {
  let v = Math.round(n);
  if (v % 2 === 0) v += 1;
  return Math.max(3, Math.min(39, v));
}

// Whether offset cell (c, r) falls inside a hexagon-shaped map of the
// given `diameter`, centred in a diameter x diameter bounding box of
// offset coordinates (see SET_GRID_SIZE/SET_MAP_SHAPE in the reducer).
export function isInHexagonShape(c, r, diameter) {
  const radius = (diameter - 1) / 2;
  return hexDistance(c, r, radius, radius) <= radius;
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

// Geometry for a "war room" movement arrow between two hex centres —
// pulled back from both centres so it doesn't run through whatever's
// sitting there (faction medallions, reward icons, quest badges), with
// a triangular arrowhead sized off the hex so it scales with the grid.
// Used by HexMapCanvas for the movement-line overlay.
export function arrowGeometry(fromPt, toPt, hexSize) {
  const dx = toPt.x - fromPt.x;
  const dy = toPt.y - fromPt.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  const startPad = hexSize * 0.4;
  const endPad = hexSize * 0.55;
  const headLen = Math.min(hexSize * 0.36, dist * 0.3);
  const headWidth = hexSize * 0.22;

  const start = { x: fromPt.x + ux * startPad, y: fromPt.y + uy * startPad };
  const tip = { x: toPt.x - ux * endPad, y: toPt.y - uy * endPad };
  const shaftEnd = { x: tip.x - ux * headLen, y: tip.y - uy * headLen };
  const perpX = -uy;
  const perpY = ux;
  const left = { x: shaftEnd.x + perpX * headWidth, y: shaftEnd.y + perpY * headWidth };
  const right = { x: shaftEnd.x - perpX * headWidth, y: shaftEnd.y - perpY * headWidth };

  return {
    shaft: `${start.x},${start.y} ${shaftEnd.x},${shaftEnd.y}`,
    head: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
    start,
    tip,
  };
}

// Geometry for the Artillery Strike effect (ArtilleryStrike.jsx) — a
// quadratic-bezier arc from one hex centre to another that bows upward
// (screen "up", not perpendicular to the shot line) like a real
// ballistic arc, with both the arc's height and the shell's flight
// time scaling with how far the shot has to travel so a cross-map shot
// visibly lobs higher and takes longer than a next-door one.
export function artilleryArc(fromPt, toPt, hexSize) {
  const dx = toPt.x - fromPt.x;
  const dy = toPt.y - fromPt.y;
  const dist = Math.hypot(dx, dy) || 1;
  const mx = (fromPt.x + toPt.x) / 2;
  const my = (fromPt.y + toPt.y) / 2;
  const height = Math.min(hexSize * 5, Math.max(hexSize * 0.9, dist * 0.4));
  const controlPt = { x: mx, y: my - height };
  const path = `M ${fromPt.x},${fromPt.y} Q ${controlPt.x},${controlPt.y} ${toPt.x},${toPt.y}`;
  const flightMs = Math.round(Math.min(2400, Math.max(550, 420 + dist * 1.15)));
  return { path, dist, height, flightMs };
}

// Builds `values`/`keyTimes` strings for a burst/flourish that should
// play out over [startFrac, startFrac+durFrac] of a longer, indefinitely
// looping animation `dur` — the same idea as HexTile's Battle Effect
// explosions ("2.5s-5.5s full cycle, most of it idle"), just
// parameterised so an effect's individual flourishes (a burst, a flash,
// a fade) can share one cycle with the rest of its animation instead of
// each running on its own independent clock. `localValues`/
// `localKeyTimes` describe the flourish's own shape on a 0-1 timeline
// (0 = it starts, 1 = its own end). Shared by ArtilleryStrike.jsx and
// OrbitalLaserStrike.jsx.
export function cycleKeyframes(localValues, localKeyTimes, startFrac, durFrac) {
  const values = [];
  const keyTimes = [];
  if (startFrac > 0) {
    values.push(localValues[0]);
    keyTimes.push(0);
  }
  localKeyTimes.forEach((kt, i) => {
    values.push(localValues[i]);
    keyTimes.push(Math.min(1, startFrac + kt * durFrac));
  });
  const endFrac = startFrac + durFrac;
  if (endFrac < 1) {
    values.push(localValues[localValues.length - 1]);
    keyTimes.push(1);
  }
  return { values: values.join(';'), keyTimes: keyTimes.join(';') };
}

// Standard ray-casting point-in-polygon test. Used by the Lasso Select
// tool (HexMapCanvas) to decide which hex centres fall inside the
// freeform loop the GM just dragged out.
export function pointInPolygon(pt, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersects = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
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

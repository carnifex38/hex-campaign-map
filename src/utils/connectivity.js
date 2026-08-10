// Territory connectivity. A palette entry becomes a "tracked" faction
// once it has both an owner (player name) and a home-base icon
// assigned (see ColorPanel's Legend Key). For those factions, every
// hex painted in their colour must trace an unbroken path of
// same-coloured, adjacent hexes back to a hex carrying their home-base
// icon — otherwise it's cut off from resupply and renders disconnected.
//
// Palette entries with no owner/home icon (Unclaimed, Objective,
// Impassable, or anything the user hasn't set up yet) are never
// checked, so they never render as disconnected.
import { normalizeColor, hexNeighbors } from './hexMath.js';
import { resolveHexColor } from '../state/mapReducer.js';

export function findDisconnectedHexes(state) {
  const disconnected = new Set();

  const trackedPalette = state.palette.filter((p) => p.owner && p.homeIconId);
  if (trackedPalette.length === 0) return disconnected;

  // Resolve each hex's *current* colour through its paletteId (if any)
  // rather than trusting the literal string it was painted with — a
  // swatch edited after painting must not silently strand hexes outside
  // their faction's tracked territory. See mapReducer's resolveHexColor.
  const hexesByColor = new Map();
  for (const [k, entry] of Object.entries(state.hexData)) {
    const color = resolveHexColor(state, entry);
    if (!color) continue;
    const norm = normalizeColor(color);
    if (!hexesByColor.has(norm)) hexesByColor.set(norm, new Set());
    hexesByColor.get(norm).add(k);
  }

  for (const p of trackedPalette) {
    const colorHexes = hexesByColor.get(normalizeColor(p.color));
    if (!colorHexes || colorHexes.size === 0) continue;

    const homeKeys = [...colorHexes].filter((k) => {
      const entry = state.hexData[k];
      return entry && entry.factionIcon === p.homeIconId;
    });

    if (homeKeys.length === 0) {
      // No home base placed for this owner yet — nothing of their
      // colour can be "connected" until one is.
      colorHexes.forEach((k) => disconnected.add(k));
      continue;
    }

    const reached = new Set(homeKeys);
    const queue = [...homeKeys];
    while (queue.length) {
      const cur = queue.pop();
      const [c, r] = cur.split(',').map(Number);
      for (const [nc, nr] of hexNeighbors(c, r)) {
        const nk = `${nc},${nr}`;
        if (!colorHexes.has(nk) || reached.has(nk)) continue;
        reached.add(nk);
        queue.push(nk);
      }
    }

    colorHexes.forEach((k) => {
      if (!reached.has(k)) disconnected.add(k);
    });
  }

  return disconnected;
}

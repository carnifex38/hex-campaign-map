// Territory connectivity. A palette entry becomes a "tracked" faction
// once it has both an owner (player name) and a home-base icon
// assigned (see ColorPanel's Legend Key). For those factions, every
// hex painted in their colour must trace an unbroken path of
// adjacent hexes back to a hex carrying a home-base icon — otherwise
// it's cut off from resupply and renders disconnected.
//
// Palette entries with no owner/home icon (Unclaimed, Objective,
// Impassable, or anything the user hasn't set up yet) are never
// checked, so they never render as disconnected.
//
// Teams: two tracked entries share one connectivity *network* if they
// have the same owner (a player's own multiple factions) or if their
// owners are on the same team (see ColorPanel's Teams section / the
// `teams` map in state). Within a network, adjacency between ANY of
// its member colours counts — so a teammate can cut through, or link
// up, another teammate's territory and the whole network still reads
// as connected, as long as it traces back to any member's home base.
// An owner with no team is their own singleton network, same as before.
import { normalizeColor, hexNeighbors } from './hexMath.js';
import { resolveHexColor } from '../state/mapReducer.js';

export function findDisconnectedHexes(state) {
  const disconnected = new Set();

  const trackedPalette = state.palette.filter((p) => p.owner && p.homeIconId);
  if (trackedPalette.length === 0) return disconnected;

  // Group tracked palette entries into networks keyed by team (or, for
  // team-less owners, by the owner themselves).
  const groups = new Map(); // key -> { paletteEntries: [...], colorNorms: Set, homeIconIds: Set }
  for (const p of trackedPalette) {
    const team = state.teams[p.owner];
    const key = team ? `team:${team}` : `owner:${p.owner}`;
    let group = groups.get(key);
    if (!group) {
      group = { colorNorms: new Set(), homeIconIds: new Set() };
      groups.set(key, group);
    }
    group.colorNorms.add(normalizeColor(p.color));
    group.homeIconIds.add(p.homeIconId);
  }

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

  for (const group of groups.values()) {
    // Every hex painted in any of this network's member colours.
    const networkHexes = new Set();
    for (const norm of group.colorNorms) {
      const set = hexesByColor.get(norm);
      if (set) set.forEach((k) => networkHexes.add(k));
    }
    if (networkHexes.size === 0) continue;

    // Home bases: any hex in the network carrying any member's home icon.
    const homeKeys = [...networkHexes].filter((k) => {
      const entry = state.hexData[k];
      return entry && entry.factionIcon && group.homeIconIds.has(entry.factionIcon);
    });

    if (homeKeys.length === 0) {
      // No home base placed for this network yet — nothing of its
      // colours can be "connected" until one is.
      networkHexes.forEach((k) => disconnected.add(k));
      continue;
    }

    const reached = new Set(homeKeys);
    const queue = [...homeKeys];
    while (queue.length) {
      const cur = queue.pop();
      const [c, r] = cur.split(',').map(Number);
      for (const [nc, nr] of hexNeighbors(c, r)) {
        const nk = `${nc},${nr}`;
        if (!networkHexes.has(nk) || reached.has(nk)) continue;
        reached.add(nk);
        queue.push(nk);
      }
    }

    networkHexes.forEach((k) => {
      if (!reached.has(k)) disconnected.add(k);
    });
  }

  return disconnected;
}

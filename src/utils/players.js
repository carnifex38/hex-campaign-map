// Derives one summary card per player from the palette. A "player"
// only exists if at least one palette entry (faction/colour) has an
// Owner assigned — see ColorPanel's Legend Key. A single player can
// own more than one palette entry (e.g. two Imperium sub-factions),
// so entries are grouped by owner name and their colours pooled.
import { normalizeColor } from './hexMath.js';
import { findDisconnectedHexes } from './connectivity.js';
import { resolveHexColor } from '../state/mapReducer.js';

export function buildPlayerSummaries(state) {
  const owners = new Map(); // owner name -> { name, factions: [...], colorNorms: Set }

  state.palette.forEach((p) => {
    const owner = (p.owner || '').trim();
    if (!owner) return;
    if (!owners.has(owner)) owners.set(owner, { name: owner, factions: [], colorNorms: new Set() });
    const rec = owners.get(owner);
    rec.factions.push(p);
    rec.colorNorms.add(normalizeColor(p.color));
  });

  if (owners.size === 0) return [];

  const disconnected = findDisconnectedHexes(state);

  const summaries = [...owners.values()].map((rec) => {
    let totalPoints = 0;
    let connectedCount = 0;
    let disconnectedCount = 0;
    // Individual reward instances (not just counts) so the player tab
    // can show each one's hex ref + GM benefit text, and so selecting a
    // hex on the map can highlight the exact matching row and vice versa.
    const bankedRewards = [];
    const defendedRewards = [];
    const armyCounts = {};

    for (const [k, entry] of Object.entries(state.hexData)) {
      if (!entry) continue;
      const color = resolveHexColor(state, entry);
      if (!color || !rec.colorNorms.has(normalizeColor(color))) continue;

      const pts = entry.meta && entry.meta.points !== undefined ? Number(entry.meta.points) : 0;
      if (!Number.isNaN(pts)) totalPoints += pts;

      // GM-assigned "objective defender" (game-setup step, see
      // ColorPanel/RewardPanel) keeps their own starting objective on
      // the map, but doesn't bank its reward until someone else
      // captures the tile out from under them.
      if (entry.reward) {
        const defender = (entry.meta && entry.meta.objectiveOwner) || null;
        const benefit = (entry.meta && entry.meta.rewardBenefit) || '';
        const stillHeldByDefender = defender && defender === rec.name;
        const item = { hexKey: k, rewardTypeId: entry.reward, benefit, defender };
        if (stillHeldByDefender) defendedRewards.push(item);
        else bankedRewards.push(item);
      }
      if (entry.factionIcon) armyCounts[entry.factionIcon] = (armyCounts[entry.factionIcon] || 0) + 1;
      (entry.icons || []).forEach((id) => {
        armyCounts[id] = (armyCounts[id] || 0) + 1;
      });

      if (disconnected.has(k)) disconnectedCount += 1;
      else connectedCount += 1;
    }

    return {
      name: rec.name,
      factions: rec.factions,
      sectorCount: connectedCount + disconnectedCount,
      connectedCount,
      disconnectedCount,
      totalPoints,
      bankedRewards,
      defendedRewards,
      armyCounts,
    };
  });

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

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
    // Resolved quest markers on hexes this player currently controls —
    // Addressed copies its award over here (this is the "reward for
    // completing it" the player actually sees); Missed does the same
    // for a penalty scoped to just this player (campaign-scoped misses
    // go to state.campaignEffects instead, see QuestPanel).
    const questAwards = [];
    const questPenalties = [];
    const armyCounts = {};

    for (const [k, entry] of Object.entries(state.hexData)) {
      if (!entry) continue;
      const color = resolveHexColor(state, entry);
      const colorMatches = !!(color && rec.colorNorms.has(normalizeColor(color)));

      if (colorMatches) {
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

      // Quest attribution is independent of hex colour: if the GM
      // explicitly assigned the quest to a player (see HexInfoPopup's
      // "Assign To Player"), that always wins — this is what lets a
      // quest on an unclaimed/neutral hex, or one meant for someone
      // other than whoever's colour is currently painted there, still
      // resolve to the right person. With no explicit assignment it
      // falls back to the old behaviour (whoever controls the hex).
      if (entry.quest) {
        const q = entry.quest;
        const belongsToThisPlayer = q.targetPlayer ? q.targetPlayer === rec.name : colorMatches;
        if (belongsToThisPlayer) {
          if (q.status === 'addressed' && q.awardText && q.awardText.trim()) {
            questAwards.push({ hexKey: k, text: q.awardText, color: q.color });
          } else if (q.status === 'missed' && q.penaltyScope === 'player' && q.penaltyText && q.penaltyText.trim()) {
            questPenalties.push({ hexKey: k, text: q.penaltyText, color: q.color });
          }
        }
      }
    }

    return {
      name: rec.name,
      team: state.teams[rec.name] || null,
      factions: rec.factions,
      sectorCount: connectedCount + disconnectedCount,
      connectedCount,
      disconnectedCount,
      totalPoints,
      bankedRewards,
      defendedRewards,
      questAwards,
      questPenalties,
      armyCounts,
      // Hand-typed by the GM directly in this player's tab (see
      // PlayerTab's Manual Rewards section) — independent of the Reward
      // System and Quest Markers entirely, so it's just read straight
      // off state here rather than accumulated from hexData above.
      manualRewards: state.manualPlayerRewards[rec.name] || [],
    };
  });

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

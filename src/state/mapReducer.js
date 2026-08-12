import { DEFAULT_PALETTE } from '../data/palette.js';
import { DEFAULT_REWARD_TYPES } from '../data/defaultRewardTypes.js';
import { iconById, iconKind } from '../data/legionIcons.js';
import { normalizeColor, cleanHexagonDiameter, isInHexagonShape } from '../utils/hexMath.js';

let paletteIdCounter = DEFAULT_PALETTE.length;
let rewardTypeIdCounter = DEFAULT_REWARD_TYPES.length;
let campaignEffectIdCounter = 0;
let movementLineIdCounter = 0;

export const DEFAULT_QUEST_COLOR = '#b8963e'; // matches --gold
export const MOVEMENT_LINE_COLOR = '#d6392f'; // the "war room" red

export const initialState = {
  cols: 12,
  rows: 8,
  hexData: {}, // key -> { color, icons: [iconId,...], factionIcon, reward, quest, meta }
  colorOpacity: {}, // normalised colour -> opacity (0-1), shared by every hex using it
  palette: DEFAULT_PALETTE,
  selected: {}, // key -> true, for O(1) toggle/lookup
  activeColor: '#7a1e1e', // which colour the opacity slider controls
  factionIconOpacity: 0.9, // applies to every placed faction emblem, map-wide
  factionIconScale: {}, // iconId -> scale (1 = default), map-wide per faction
  showCapturedRewardOutlines: true, // toggle for the "taken from" defender-colour ring, see RewardPanel
  mapShape: 'rectangle', // 'rectangle' | 'hexagon' — see SET_MAP_SHAPE, Header's Map Shape dropdown
  activeFactionIcon: null, // which faction's scale slider is currently "aimed at"
  rewardTypes: DEFAULT_REWARD_TYPES,
  teams: {}, // owner (player name) -> team number 1-10. No entry = unassigned.
  campaignEffects: [], // [{ id, text }] — GM-managed campaign-wide modifiers, see QuestPanel.
  movementLines: [], // [{ id, fromKey, toKey }] — see MovementControls.jsx
  movementMode: 'none', // 'none' | 'draw' | 'erase'
  lassoMode: false, // Lasso Select tool — mutually exclusive with movementMode, see SET_LASSO_MODE/SET_MOVEMENT_MODE
  // Hexes multiple factions' arrows are pointing at simultaneously,
  // waiting on the GM to pick a winner — see INITIALIZE_MOVEMENT and
  // SectorContestModal.jsx. [{ hexKey, contenders: [{ color, paletteId, lineIds }] }]
  pendingContests: [],
};

// ---- small selectors, exported so components don't reach into state
// shape directly (keeps the shape free to change later) ----
export function getOpacity(state, color) {
  const v = state.colorOpacity[normalizeColor(color)];
  return v != null ? v : 1;
}
export function getFactionScale(state, iconId) {
  const v = state.factionIconScale[iconId];
  return v != null ? v : 1;
}
export function selectedKeys(state) {
  return Object.keys(state.selected);
}
export function isSelected(state, k) {
  return !!state.selected[k];
}
export function hexEntry(state, k) {
  return state.hexData[k];
}
export function rewardTypeById(state, id) {
  return state.rewardTypes.find((rt) => rt.id === id);
}
// The "controller" of a hex is whichever legend/palette entry owns its
// assigned colour — this is what the info popup shows as Controlled By.
export function paletteEntryForColor(state, color) {
  if (!color) return null;
  const norm = normalizeColor(color);
  return state.palette.find((p) => normalizeColor(p.color) === norm) || null;
}

// Painting a hex from a Legend Key swatch stamps both the resolved
// colour AND that palette entry's id (see APPLY_COLOR). Resolving
// through the id keeps a hex in sync if the GM later fine-tunes that
// swatch's exact shade in the Legend Key — otherwise the hex would keep
// its old literal colour string forever, silently falling out of that
// faction's tracked territory (ownership, connectivity, player totals
// all match on colour). Hexes painted with the Custom picker have no
// paletteId and stay a plain untracked colour, which is correct — no
// owner claims a colour nobody assigned.
export function paletteEntryForHex(state, entry) {
  if (!entry) return null;
  if (entry.paletteId) {
    const p = state.palette.find((pp) => pp.id === entry.paletteId);
    if (p) return p;
  }
  return paletteEntryForColor(state, entry.color);
}

export function resolveHexColor(state, entry) {
  if (!entry) return null;
  const p = entry.paletteId ? state.palette.find((pp) => pp.id === entry.paletteId) : null;
  return p ? p.color : entry.color || null;
}

// Team 1-10, or null for unassigned (the default — every owner is
// their own unallied network). See utils/connectivity.js for how this
// merges teammates' territories into one shared supply network.
export function teamForOwner(state, owner) {
  if (!owner) return null;
  return state.teams[owner] || null;
}

function ensureEntry(hexData, k) {
  const existing = hexData[k];
  if (existing) return existing;
  return { color: null, paletteId: null, icons: [], factionIcon: null, reward: null, quest: null, meta: {} };
}

function metaHasContent(meta) {
  if (!meta) return false;
  return Object.values(meta).some((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

// A hex entry that has nothing set is dropped so hexData doesn't
// accumulate empty placeholders as the user paints/clears.
function isEmptyEntry(e) {
  return !e.color && !e.paletteId && !e.factionIcon && !e.reward && !e.quest && (!e.icons || e.icons.length === 0) && !metaHasContent(e.meta);
}

function pruneEntry(hexData, k) {
  const e = hexData[k];
  if (!e) return hexData;
  if (!isEmptyEntry(e)) return hexData;
  const next = { ...hexData };
  delete next[k];
  return next;
}

export function mapReducer(state, action) {
  switch (action.type) {
    case 'SET_GRID_SIZE': {
      let cols = Math.max(1, Math.min(40, action.cols));
      let rows = Math.max(1, Math.min(40, action.rows));
      // A Hexagon-shaped map needs equal, odd cols/rows to stay
      // centred and symmetric — round whatever the GM typed to the
      // nearest clean size instead of leaving it lopsided (Header
      // only shows a single "Diameter" field in this mode anyway, but
      // this covers programmatic callers too).
      if (state.mapShape === 'hexagon') {
        const diameter = cleanHexagonDiameter((cols + rows) / 2);
        cols = diameter;
        rows = diameter;
      }
      // Preserve data only for hexes that still exist at the new size
      // (and, in Hexagon mode, still fall inside the hexagon mask).
      const hexData = {};
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (state.mapShape === 'hexagon' && !isInHexagonShape(c, r, cols)) continue;
          const k = `${c},${r}`;
          if (state.hexData[k]) hexData[k] = state.hexData[k];
        }
      }
      return { ...state, cols, rows, hexData, selected: {} };
    }

    // Rectangle <-> Hexagon. Switching to Hexagon snaps the current
    // grid size to the nearest clean odd diameter (see
    // cleanHexagonDiameter) and drops any hex data sitting outside
    // that hexagon's footprint; switching back to Rectangle just
    // restores the ordinary cols x rows grid at its current size —
    // nothing outside the hexagon existed to prune.
    case 'SET_MAP_SHAPE': {
      const mapShape = action.shape === 'hexagon' ? 'hexagon' : 'rectangle';
      if (mapShape === state.mapShape) return state;
      let { cols, rows, hexData } = state;
      if (mapShape === 'hexagon') {
        const diameter = cleanHexagonDiameter((cols + rows) / 2);
        cols = diameter;
        rows = diameter;
        hexData = {};
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (!isInHexagonShape(c, r, cols)) continue;
            const k = `${c},${r}`;
            if (state.hexData[k]) hexData[k] = state.hexData[k];
          }
        }
      }
      return { ...state, mapShape, cols, rows, hexData, selected: {} };
    }

    case 'SELECT_HEX': {
      const { key: k, additive } = action;
      let selected;
      if (additive) {
        selected = { ...state.selected };
        if (selected[k]) delete selected[k];
        else selected[k] = true;
      } else {
        selected = { [k]: true };
      }
      const entry = state.hexData[k];
      const resolvedColor = entry ? resolveHexColor(state, entry) : null;
      const activeColor = resolvedColor || state.activeColor;
      const activeFactionIcon = entry && entry.factionIcon ? entry.factionIcon : state.activeFactionIcon;
      return { ...state, selected, activeColor, activeFactionIcon };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selected: {} };

    // ---------------- Hex meta (pts / mission objective / notes) ----------------
    case 'UPDATE_HEX_META': {
      const { key: k, changes } = action;
      let hexData = { ...state.hexData };
      const entry = ensureEntry(hexData, k);
      hexData[k] = { ...entry, meta: { ...entry.meta, ...changes } };
      hexData = pruneEntry(hexData, k);
      return { ...state, hexData };
    }

    // GM game-setup step: mark which player originally holds/defends an
    // objective hex. That player keeps the tile shown as "theirs" but
    // does NOT bank its reward — only a different player who later
    // captures the tile (changes its colour) does. See utils/players.js.
    case 'SET_OBJECTIVE_OWNER': {
      const { owner } = action;
      let hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        const entry = ensureEntry(hexData, k);
        hexData[k] = { ...entry, meta: { ...entry.meta, objectiveOwner: owner || null } };
        hexData = pruneEntry(hexData, k);
      }
      return { ...state, hexData };
    }

    // ---------------- Teams (players can ally up 1-10, or stay unassigned) ----------------
    case 'SET_PLAYER_TEAM': {
      const { owner, team } = action;
      if (!owner) return state;
      const teams = { ...state.teams };
      if (team) teams[owner] = team;
      else delete teams[owner];
      return { ...state, teams };
    }

    // ---------------- Colour / territory ----------------
    case 'APPLY_COLOR': {
      // paletteId is set when painting from a Legend Key swatch, so the
      // hex's colour stays live if that swatch is edited later (see
      // paletteEntryForHex/resolveHexColor above). The Custom colour
      // picker passes no paletteId — that paint stays a fixed, untracked
      // colour, which is correct since no faction owns it.
      const { color, paletteId } = action;
      const hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        const existing = hexData[k] || {};
        hexData[k] = {
          color,
          paletteId: paletteId || null,
          icons: existing.icons || [],
          factionIcon: existing.factionIcon || null,
          reward: existing.reward || null,
          quest: existing.quest || null,
          meta: existing.meta || {},
        };
      }
      return { ...state, hexData, activeColor: color };
    }

    case 'SET_COLOR_OPACITY': {
      const { color, opacity } = action;
      return {
        ...state,
        colorOpacity: { ...state.colorOpacity, [normalizeColor(color)]: opacity },
      };
    }

    case 'CLEAR_HEX_COLOR': {
      let hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        if (hexData[k]) hexData[k] = { ...hexData[k], color: null, paletteId: null };
        hexData = pruneEntry(hexData, k);
      }
      return { ...state, hexData };
    }

    case 'RESET_ALL_COLORS': {
      let hexData = {};
      for (const k of Object.keys(state.hexData)) {
        const e = { ...state.hexData[k], color: null, paletteId: null };
        const empty = isEmptyEntry(e);
        if (!empty) hexData[k] = e;
      }
      return { ...state, hexData, colorOpacity: {}, selected: {} };
    }

    // ---------------- Legend / palette ----------------
    case 'ADD_PALETTE_ENTRY': {
      paletteIdCounter += 1;
      const entry = { id: 'p' + paletteIdCounter, name: 'New Entry', color: '#7a1e1e', owner: '', homeIconId: null };
      return { ...state, palette: [...state.palette, entry] };
    }
    case 'UPDATE_PALETTE_ENTRY': {
      const { id, changes } = action;
      const palette = state.palette.map((p) => (p.id === id ? { ...p, ...changes } : p));

      // Renaming an owner should carry their team membership along with
      // them, as long as no other palette entry is still using the old
      // name (so we don't rip a team assignment out from under someone
      // else who happens to share it) and the new name doesn't already
      // have its own team assigned.
      let teams = state.teams;
      if (changes.owner !== undefined) {
        const before = state.palette.find((p) => p.id === id);
        const oldOwner = before ? (before.owner || '').trim() : '';
        const newOwner = (changes.owner || '').trim();
        const oldStillUsed = palette.some((p) => (p.owner || '').trim() === oldOwner);
        if (oldOwner && newOwner && oldOwner !== newOwner && !oldStillUsed && teams[oldOwner] && !teams[newOwner]) {
          teams = { ...teams };
          teams[newOwner] = teams[oldOwner];
          delete teams[oldOwner];
        }
      }

      return { ...state, palette, teams };
    }
    case 'REMOVE_PALETTE_ENTRY':
      return { ...state, palette: state.palette.filter((p) => p.id !== action.id) };

    // ---------------- Icons (unit-type + faction emblems) ----------------
    case 'ADD_ICON': {
      const { iconId } = action;
      const def = iconById(iconId);
      if (!def) return state;
      const kind = iconKind(def);

      if (kind === 'faction') {
        const hexData = { ...state.hexData };
        for (const k of Object.keys(state.selected)) {
          hexData[k] = { ...ensureEntry(hexData, k), factionIcon: iconId };
        }
        return { ...state, hexData, activeFactionIcon: iconId };
      }

      const hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        const entry = ensureEntry(hexData, k);
        hexData[k] = { ...entry, icons: [...entry.icons, iconId] };
      }
      return { ...state, hexData };
    }

    case 'SET_ACTIVE_FACTION_ICON':
      return { ...state, activeFactionIcon: action.iconId };

    case 'REMOVE_UNIT_ICON': {
      const { key: k, iconId } = action;
      const entry = state.hexData[k];
      if (!entry) return state;
      const icons = [...entry.icons];
      const idx = icons.indexOf(iconId);
      if (idx !== -1) icons.splice(idx, 1);
      let hexData = { ...state.hexData, [k]: { ...entry, icons } };
      hexData = pruneEntry(hexData, k);
      return { ...state, hexData };
    }

    case 'CLEAR_UNIT_ICONS': {
      let hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        if (hexData[k]) hexData[k] = { ...hexData[k], icons: [] };
        hexData = pruneEntry(hexData, k);
      }
      return { ...state, hexData };
    }

    case 'CLEAR_FACTION_ICON': {
      let hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        if (hexData[k]) hexData[k] = { ...hexData[k], factionIcon: null };
        hexData = pruneEntry(hexData, k);
      }
      return { ...state, hexData };
    }

    case 'RESET_ALL_ICONS': {
      let hexData = {};
      for (const k of Object.keys(state.hexData)) {
        const e = { ...state.hexData[k], icons: [], factionIcon: null };
        const empty = isEmptyEntry(e);
        if (!empty) hexData[k] = e;
      }
      return { ...state, hexData };
    }

    case 'SET_FACTION_OPACITY':
      return { ...state, factionIconOpacity: action.opacity };

    case 'SET_SHOW_CAPTURED_REWARD_OUTLINES':
      return { ...state, showCapturedRewardOutlines: action.show };

    case 'SET_FACTION_SCALE':
      return {
        ...state,
        factionIconScale: { ...state.factionIconScale, [action.iconId]: action.scale },
      };

    // ---------------- Reward system ----------------
    case 'ADD_REWARD_TYPE': {
      rewardTypeIdCounter += 1;
      const rt = { id: 'rt' + rewardTypeIdCounter, name: 'New Reward', iconId: action.iconId, frequency: 1, enabled: true, benefit: '' };
      return { ...state, rewardTypes: [...state.rewardTypes, rt] };
    }
    case 'UPDATE_REWARD_TYPE': {
      const { id, changes } = action;
      return {
        ...state,
        rewardTypes: state.rewardTypes.map((rt) => (rt.id === id ? { ...rt, ...changes } : rt)),
      };
    }
    case 'REMOVE_REWARD_TYPE':
      return { ...state, rewardTypes: state.rewardTypes.filter((rt) => rt.id !== action.id) };

    case 'PLACE_REWARD': {
      const { rewardTypeId } = action;
      // The reward type's own "Benefit / Bonus" text (set once in the
      // Reward System panel) seeds each hex's Benefit field so the GM
      // doesn't have to retype the same grant on every tile it's
      // placed on — a hex that already carries its own custom text
      // (from a previous edit) keeps that instead of being overwritten.
      const rt = state.rewardTypes.find((r) => r.id === rewardTypeId);
      const hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        const existing = ensureEntry(hexData, k);
        const meta = existing.meta || {};
        const nextMeta =
          rt && rt.benefit && !meta.rewardBenefit ? { ...meta, rewardBenefit: rt.benefit } : meta;
        hexData[k] = { ...existing, reward: rewardTypeId, meta: nextMeta };
      }
      return { ...state, hexData };
    }

    case 'CLEAR_REWARDS': {
      let hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        if (hexData[k]) hexData[k] = { ...hexData[k], reward: null };
        hexData = pruneEntry(hexData, k);
      }
      return { ...state, hexData };
    }

    case 'RESET_ALL_REWARDS': {
      let hexData = {};
      for (const k of Object.keys(state.hexData)) {
        const e = { ...state.hexData[k], reward: null };
        const empty = isEmptyEntry(e);
        if (!empty) hexData[k] = e;
      }
      return { ...state, hexData };
    }

    case 'RANDOMIZE_REWARDS': {
      const { eligibleKeys, bag } = action; // pre-shuffled by the thunk in MapContext
      const hexData = { ...state.hexData };
      const count = Math.min(eligibleKeys.length, bag.length);
      for (let i = 0; i < count; i++) {
        const k = eligibleKeys[i];
        const rewardTypeId = bag[i];
        const rt = state.rewardTypes.find((r) => r.id === rewardTypeId);
        const existing = ensureEntry(hexData, k);
        const meta = existing.meta || {};
        const nextMeta =
          rt && rt.benefit && !meta.rewardBenefit ? { ...meta, rewardBenefit: rt.benefit } : meta;
        hexData[k] = { ...existing, reward: rewardTypeId, meta: nextMeta };
      }
      return { ...state, hexData };
    }

    // ---------------- Quest markers (exclamation-point event hexes) ----------------
    // A quest marker is its own thing, separate from the Reward system:
    // it's a live "!" glow+pulse on the map until the GM resolves it as
    // Addressed (the player gets the award) or Missed (the penalty
    // applies — to just that player, or logged as a Campaign Effect).
    case 'PLACE_QUEST_MARKER': {
      const { color } = action;
      const hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        const entry = ensureEntry(hexData, k);
        hexData[k] = {
          ...entry,
          quest: {
            color: color || DEFAULT_QUEST_COLOR,
            status: 'active',
            iconId: null, // null = default "!" badge, 'none' = plain badge, else a REWARD_ICONS id
            awardText: '',
            penaltyText: '',
            penaltyScope: 'player',
            // Who "This player" refers to for the award/penalty. Left
            // null it falls back to whoever currently controls the
            // hex's colour — set it explicitly so a quest on an
            // unclaimed/neutral hex (or one meant for someone other
            // than the current colour owner) still resolves to someone.
            targetPlayer: null,
          },
        };
      }
      return { ...state, hexData };
    }

    case 'UPDATE_HEX_QUEST': {
      const { key: k, changes } = action;
      const entry = state.hexData[k];
      if (!entry || !entry.quest) return state;
      const hexData = { ...state.hexData, [k]: { ...entry, quest: { ...entry.quest, ...changes } } };
      return { ...state, hexData };
    }

    case 'CLEAR_QUEST_MARKER': {
      let hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        if (hexData[k]) hexData[k] = { ...hexData[k], quest: null };
        hexData = pruneEntry(hexData, k);
      }
      return { ...state, hexData };
    }

    case 'RESOLVE_QUEST': {
      // outcome: 'addressed' (award) or 'missed' (penalty). A missed
      // quest scoped to the whole campaign auto-logs a Campaign Effect
      // from the GM's penalty text, so it's visible to everyone even
      // though it isn't tied to one player's hex.
      const { key: k, outcome } = action;
      const entry = state.hexData[k];
      if (!entry || !entry.quest) return state;

      // Lock in who this resolves to, right now, so the outcome stays
      // with the player who actually addressed (or missed) it — a
      // later capture of the hex must never silently hand the
      // award/penalty to whoever holds it after the fact. If the GM
      // never set an explicit "Assign To Player", freeze it to
      // whoever currently controls the hex; if nobody does, it stays
      // unassigned (same as before — see the warning in HexInfoPopup).
      let targetPlayer = entry.quest.targetPlayer;
      if (!targetPlayer) {
        const controller = paletteEntryForHex(state, entry);
        targetPlayer = controller && controller.owner ? controller.owner : null;
      }

      const quest = { ...entry.quest, status: outcome, targetPlayer };
      const hexData = { ...state.hexData, [k]: { ...entry, quest } };

      let campaignEffects = state.campaignEffects;
      if (outcome === 'missed' && quest.penaltyScope === 'campaign') {
        campaignEffectIdCounter += 1;
        const text = quest.penaltyText.trim() || `A quest at ${k} went unaddressed.`;
        campaignEffects = [...campaignEffects, { id: 'ce' + campaignEffectIdCounter, text }];
      }

      return { ...state, hexData, campaignEffects };
    }

    // ---------------- Campaign effects (GM-managed, map-wide) ----------------
    case 'ADD_CAMPAIGN_EFFECT': {
      const text = (action.text || '').trim();
      if (!text) return state;
      campaignEffectIdCounter += 1;
      return { ...state, campaignEffects: [...state.campaignEffects, { id: 'ce' + campaignEffectIdCounter, text }] };
    }

    case 'REMOVE_CAMPAIGN_EFFECT':
      return { ...state, campaignEffects: state.campaignEffects.filter((e) => e.id !== action.id) };

    // ---------------- Movement lines (war-room arrows between hexes) ----------------
    // Toggling a mode on while the other is active switches straight
    // over; clicking the same mode's button again turns it off. Either
    // way any half-drawn arrow (a picked start hex with no destination
    // yet) is abandoned — see MovementControls.jsx.
    case 'SET_MOVEMENT_MODE': {
      const mode = action.mode === state.movementMode ? 'none' : action.mode;
      return { ...state, movementMode: mode, lassoMode: false };
    }

    // Lasso Select tool — mutually exclusive with the movement-line
    // tools above (same reason: only one drag-gesture tool can own the
    // canvas's mousedown/move/up at a time). Toggling it on turns
    // whichever movement tool was active off, and vice versa.
    case 'SET_LASSO_MODE':
      return { ...state, lassoMode: !state.lassoMode, movementMode: 'none' };

    // Select every hex the Lasso tool's freeform loop enclosed. Bare
    // click-drag replaces the selection with just those hexes; holding
    // Ctrl/Cmd unions them into whatever was already selected (unlike
    // SELECT_HEX's per-hex toggle, toggling a whole batch at once
    // would be more confusing than useful here).
    case 'SELECT_HEXES': {
      const { keys, additive } = action;
      const selected = additive ? { ...state.selected } : {};
      keys.forEach((k) => { selected[k] = true; });
      return { ...state, selected };
    }

    // Erase-mode hex click: drop any line touching this hex. (Drawing
    // is a drag gesture now, handled client-side in HexMapCanvas and
    // committed in one shot via CREATE_MOVEMENT_LINE below — see the
    // comment there for why.)
    case 'MOVEMENT_HEX_CLICK': {
      const { key: k } = action;
      if (state.movementMode !== 'erase') return state;
      const movementLines = state.movementLines.filter((l) => l.fromKey !== k && l.toKey !== k);
      return { ...state, movementLines };
    }

    // Fires once, on mouseup, at the end of a drag-to-draw gesture —
    // both endpoints are already known (the drag itself picked and
    // snapped them), so unlike the old click-click flow this doesn't
    // need any "pending start" state in between.
    case 'CREATE_MOVEMENT_LINE': {
      const { fromKey, toKey } = action;
      if (!fromKey || !toKey || fromKey === toKey) return state;
      // The arrow has to start from a hex that's actually claimed —
      // "a controlling sector" — so dragging off an empty/unclaimed
      // hex produces nothing.
      const color = resolveHexColor(state, state.hexData[fromKey]);
      if (!color) return state;
      const alreadyExists = state.movementLines.some((l) => l.fromKey === fromKey && l.toKey === toKey);
      if (alreadyExists) return state;
      movementLineIdCounter += 1;
      const movementLines = [...state.movementLines, { id: 'mv' + movementLineIdCounter, fromKey, toKey }];
      return { ...state, movementLines };
    }

    case 'REMOVE_MOVEMENT_LINE':
      return { ...state, movementLines: state.movementLines.filter((l) => l.id !== action.id) };

    // "Claim Sector" — resolves every drawn arrow at once. A hex with
    // arrows from only one faction is claimed immediately (repainted
    // to that faction's colour, arrows consumed). A hex with arrows
    // from more than one distinct faction colour is left untouched and
    // queued as a contest for the GM to settle in SectorContestModal —
    // arrows into that hex are the reference for it, so nothing about
    // it is graded as "won" until RESOLVE_SECTOR_CONTEST fires.
    case 'INITIALIZE_MOVEMENT': {
      const byDest = new Map(); // toKey -> Map(colourNorm -> { color, paletteId, lineIds })
      for (const line of state.movementLines) {
        const fromEntry = state.hexData[line.fromKey];
        const color = resolveHexColor(state, fromEntry);
        if (!color) continue; // shouldn't happen — draw requires a controlled start
        const norm = normalizeColor(color);
        if (!byDest.has(line.toKey)) byDest.set(line.toKey, new Map());
        const group = byDest.get(line.toKey);
        if (!group.has(norm)) group.set(norm, { color, paletteId: fromEntry.paletteId || null, lineIds: [] });
        group.get(norm).lineIds.push(line.id);
      }

      let hexData = { ...state.hexData };
      let movementLines = state.movementLines;
      const pendingContests = [...state.pendingContests];

      for (const [toKey, group] of byDest.entries()) {
        const contenders = [...group.values()];
        if (contenders.length === 1) {
          const winner = contenders[0];
          const existing = ensureEntry(hexData, toKey);
          hexData[toKey] = { ...existing, color: winner.color, paletteId: winner.paletteId };
          const spentIds = winner.lineIds;
          movementLines = movementLines.filter((l) => !spentIds.includes(l.id));
        } else if (!pendingContests.some((c) => c.hexKey === toKey)) {
          pendingContests.push({ hexKey: toKey, contenders });
        }
      }

      return { ...state, hexData, movementLines, pendingContests };
    }

    case 'RESOLVE_SECTOR_CONTEST': {
      const { hexKey, colorNorm } = action;
      const contest = state.pendingContests.find((c) => c.hexKey === hexKey);
      if (!contest) return state;
      const winner = contest.contenders.find((c) => normalizeColor(c.color) === colorNorm);
      if (!winner) return state;

      const hexData = { ...state.hexData };
      const existing = ensureEntry(hexData, hexKey);
      hexData[hexKey] = { ...existing, color: winner.color, paletteId: winner.paletteId };

      const spentIds = contest.contenders.flatMap((c) => c.lineIds);
      const movementLines = state.movementLines.filter((l) => !spentIds.includes(l.id));
      const pendingContests = state.pendingContests.filter((c) => c.hexKey !== hexKey);

      return { ...state, hexData, movementLines, pendingContests };
    }

    // Leaves the hex and its arrows untouched, just takes it off the
    // GM's queue for now — clicking Claim Sector again later will put
    // it right back if those arrows are still there.
    case 'SKIP_SECTOR_CONTEST':
      return { ...state, pendingContests: state.pendingContests.filter((c) => c.hexKey !== action.hexKey) };

    default:
      return state;
  }
}

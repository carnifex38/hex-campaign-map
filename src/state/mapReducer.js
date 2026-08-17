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

// Purely-visual per-hex effects (HexTile.jsx renders each one; no game
// meaning). Listed here once so HexInfoPopup's picker and HexTile's
// renderer switch both read off the same set instead of duplicating
// ids/labels — add new effects to this list first.
export const HEX_EFFECTS = [
  { id: 'explosions', label: 'Battle (Explosions)' },
  { id: 'shield', label: 'Force Shield' },
  // Needs two hexes (an origin and a target), not one — see
  // SET_HEX_EFFECT below and ReadoutPanel's dedicated 2-hex selector.
  // Excluded from HexInfoPopup's single-hex picker and ReadoutPanel's
  // bulk N-hex dropdown; ARTILLERY_ONLY_EFFECT_ID exists so both of
  // those can filter it out by reference instead of a hardcoded string.
  { id: 'artillery', label: 'Artillery Strike' },
];

export const ARTILLERY_EFFECT_ID = 'artillery';

// Pulled out so RESET_DISPLAY_SETTINGS can restore exactly these
// values without having to duplicate them (or reset unrelated state by
// spreading the whole of initialState back in) — see DisplaySettingsPanel's
// Reset button.
export const DEFAULT_DISPLAY_SETTINGS = {
  hexLineColor: '#46402f', // matches the original fixed --hex-stroke value
  hexLineWidth: 1.5,
  hexTextColor: '#cfc9b8', // matches --bone
  hexTextOpacity: 0.35,
  hexTextSize: 8.5,
  mapOpacity: 1, // dims the whole rendered grid (hexes, lines, overlays) uniformly

  // ---- Battlefield Effects tuning (HexTile.jsx's Force Shield /
  // Battle-Explosions renderers) — same map-wide "adjust the look"
  // idea as the hex line/text controls above, just aimed at the two
  // effects instead of the grid itself. ----
  shieldColor: '#46aaff',
  shieldGlowStrength: 1, // 0-2 multiplier on the rim/facet glow's blur + opacity
  shieldFalloff: 0.4, // 0.1-0.8 — how far out the see-through centre reaches before fading in
  shieldOpacityStrength: 1, // 0-2 multiplier on facet/rim opacity
  shieldStencilOpacity: 0, // 0-1 — how much shows through the radial stencil's centre; 0 = fully hidden, 1 = stencil off
  explosionColor: '#ff8a3d',
  artillerySpeed: 1, // 0.25-3 multiplier on shell flight time (higher = faster shell, shorter time in the air)
  artilleryFrequency: 1, // 0.25-3 multiplier on fire rate (higher = shorter pause between shots)
};

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
  // Hand-typed rewards the GM grants a player directly, independent of
  // the Reward System and Quest Markers — owner name -> [string, ...].
  // See PlayerTab's Manual Rewards section.
  manualPlayerRewards: {},
  campaignEffects: [], // [{ id, text }] — GM-managed campaign-wide modifiers, see QuestPanel.
  movementLines: [], // [{ id, fromKey, toKey }] — see MovementControls.jsx
  movementMode: 'none', // 'none' | 'draw' | 'erase'
  lassoMode: false, // Lasso Select tool — mutually exclusive with movementMode, see SET_LASSO_MODE/SET_MOVEMENT_MODE

  // ---- Display Settings (DisplaySettingsPanel.jsx) — map-wide visual
  // tuning, separate from game content. More knobs land here over time. ----
  displaySettingsOpen: false,
  ...DEFAULT_DISPLAY_SETTINGS,
  // Hexes multiple factions' arrows are pointing at simultaneously,
  // waiting on the GM to pick a winner — see INITIALIZE_MOVEMENT and
  // SectorContestModal.jsx. [{ hexKey, contenders: [{ color, paletteId, lineIds }] }]
  pendingContests: [],

  // ---- New Game Setup wizard (GameSetupWizard.jsx) — its own step
  // state/draft player list lives in the component (transient, cheap
  // to lose); only the coordination flags HexMapCanvas actually needs
  // to intercept map clicks live here. ----
  gameSetupOpen: false,
  // Set while the GM has "armed" a player in Step 2 for territory
  // placement: { paletteId, color, homeIconId, radius, playerName } |
  // null. HexMapCanvas checks this before treating a hex click as
  // ordinary selection — see PLACE_TERRITORY.
  gameSetupArmedPlacement: null,
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
  return { color: null, paletteId: null, icons: [], factionIcon: null, reward: null, quest: null, hexEffect: null, artilleryTarget: null, meta: {} };
}

function metaHasContent(meta) {
  if (!meta) return false;
  return Object.values(meta).some((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

// A hex entry that has nothing set is dropped so hexData doesn't
// accumulate empty placeholders as the user paints/clears.
function isEmptyEntry(e) {
  return !e.color && !e.paletteId && !e.factionIcon && !e.reward && !e.quest && !e.hexEffect && (!e.icons || e.icons.length === 0) && !metaHasContent(e.meta);
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

    // ---------------- Manual Player Rewards (PlayerTab.jsx) — GM hand-
    // grants a reward directly to a player, independent of the Reward
    // System (icon placements on hexes) and Quest Markers. ----------------
    case 'ADD_MANUAL_PLAYER_REWARD': {
      const { player } = action;
      if (!player) return state;
      const list = state.manualPlayerRewards[player] || [];
      return { ...state, manualPlayerRewards: { ...state.manualPlayerRewards, [player]: [...list, ''] } };
    }
    case 'UPDATE_MANUAL_PLAYER_REWARD': {
      const { player, index, text } = action;
      if (!player) return state;
      const list = [...(state.manualPlayerRewards[player] || [])];
      if (index < 0 || index >= list.length) return state;
      list[index] = text;
      return { ...state, manualPlayerRewards: { ...state.manualPlayerRewards, [player]: list } };
    }
    case 'REMOVE_MANUAL_PLAYER_REWARD': {
      const { player, index } = action;
      if (!player) return state;
      const list = (state.manualPlayerRewards[player] || []).filter((_, i) => i !== index);
      return { ...state, manualPlayerRewards: { ...state.manualPlayerRewards, [player]: list } };
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
          hexEffect: existing.hexEffect || null,
          artilleryTarget: existing.artilleryTarget || null,
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

    // ---------------- Display Settings ----------------
    case 'TOGGLE_DISPLAY_SETTINGS':
      return { ...state, displaySettingsOpen: !state.displaySettingsOpen };
    case 'SET_HEX_LINE_COLOR':
      return { ...state, hexLineColor: action.color };
    case 'SET_HEX_LINE_WIDTH':
      return { ...state, hexLineWidth: action.width };
    case 'SET_HEX_TEXT_COLOR':
      return { ...state, hexTextColor: action.color };
    case 'SET_HEX_TEXT_OPACITY':
      return { ...state, hexTextOpacity: action.opacity };
    case 'SET_HEX_TEXT_SIZE':
      return { ...state, hexTextSize: action.size };
    case 'SET_MAP_OPACITY':
      return { ...state, mapOpacity: action.opacity };
    case 'SET_SHIELD_COLOR':
      return { ...state, shieldColor: action.color };
    case 'SET_SHIELD_GLOW_STRENGTH':
      return { ...state, shieldGlowStrength: action.value };
    case 'SET_SHIELD_FALLOFF':
      return { ...state, shieldFalloff: action.value };
    case 'SET_SHIELD_OPACITY_STRENGTH':
      return { ...state, shieldOpacityStrength: action.value };
    case 'SET_SHIELD_STENCIL_OPACITY':
      return { ...state, shieldStencilOpacity: action.value };
    case 'SET_EXPLOSION_COLOR':
      return { ...state, explosionColor: action.color };
    case 'SET_ARTILLERY_SPEED':
      return { ...state, artillerySpeed: action.value };
    case 'SET_ARTILLERY_FREQUENCY':
      return { ...state, artilleryFrequency: action.value };
    case 'RESET_DISPLAY_SETTINGS':
      return { ...state, ...DEFAULT_DISPLAY_SETTINGS };

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

    // "Clean All" — wipes every hex back to blank (colour, icons,
    // faction emblem, reward, quest, battlefield effect, GM notes —
    // everything a hex can carry) plus the map-wide overlays tied to
    // that content (movement lines, any sector contest waiting to be
    // resolved, campaign effects). Deliberately leaves the *setup*
    // alone — grid size/shape, the Legend Key/palette, team
    // assignments, reward type definitions, display settings, and
    // each player's Manual Rewards ledger — so the GM doesn't have to
    // reconfigure the campaign from scratch just to clear the board.
    case 'CLEAN_ALL':
      return {
        ...state,
        hexData: {},
        selected: {},
        colorOpacity: {},
        movementLines: [],
        pendingContests: [],
        campaignEffects: [],
        movementMode: 'none',
        lassoMode: false,
      };

    // ---------------- New Game Setup wizard ----------------
    case 'OPEN_GAME_SETUP':
      return { ...state, gameSetupOpen: true, gameSetupArmedPlacement: null };
    case 'CLOSE_GAME_SETUP':
      return { ...state, gameSetupOpen: false, gameSetupArmedPlacement: null };
    case 'SET_GAME_SETUP_ARMED_PLACEMENT':
      return { ...state, gameSetupArmedPlacement: action.placement };

    // Step 2 (Territory Placement): paints every hex in the
    // GM-sized blob around `centerKey` with one player's colour, and
    // drops their chosen home-base emblem on the centre hex only — the
    // "wraps around the faction icon" look, and what makes
    // utils/connectivity.js treat the whole blob as one connected
    // network right away. `keys` is pre-computed by the thunk in
    // MapContext (needs cols/rows + the hex-distance maths); this case
    // just applies it, same division of labour as RANDOMIZE_REWARDS.
    case 'PLACE_TERRITORY': {
      const { keys, centerKey, color, paletteId, homeIconId } = action;
      const keySet = new Set(keys);
      let hexData = { ...state.hexData };
      // Overwrite, don't accumulate: if this player already has
      // territory somewhere (a re-placement, picking them again after
      // an earlier click), drop every hex of theirs that isn't part of
      // the new blob first, rather than leaving the old blob painted
      // alongside the new one. Old territory hexes that happen to
      // still fall inside the *new* blob (a "moved one hex over"
      // placement, where old and new overlap heavily) aren't dropped,
      // but their home-base emblem still needs clearing here — the
      // loop below only ever sets it fresh on the new centre, so
      // without this the old centre hex would keep showing a second
      // copy of the icon even though it's no longer the centre.
      if (paletteId) {
        const next = {};
        for (const k of Object.keys(hexData)) {
          const e = hexData[k];
          if (e && e.paletteId === paletteId) {
            if (!keySet.has(k)) continue;
            next[k] = e.factionIcon ? { ...e, factionIcon: null } : e;
            continue;
          }
          next[k] = e;
        }
        hexData = next;
      }
      for (const k of keys) {
        const existing = hexData[k] || {};
        hexData[k] = {
          color,
          paletteId: paletteId || null,
          icons: existing.icons || [],
          factionIcon: k === centerKey ? (homeIconId || null) : (existing.factionIcon || null),
          reward: existing.reward || null,
          quest: existing.quest || null,
          hexEffect: existing.hexEffect || null,
          artilleryTarget: existing.artilleryTarget || null,
          meta: existing.meta || {},
        };
      }
      return { ...state, hexData, activeColor: color };
    }

    // End of Step 1 (Players & Teams): trims the Legend Key down to
    // just "Unclaimed" plus whichever palette entries the GM actually
    // assigned to a player this session — every other leftover default
    // faction (or one from a previous campaign) is dropped so the list
    // stays clean instead of accumulating unused colours. Also drops
    // any team assignment that's left pointing at an owner name that
    // no longer has a palette entry.
    case 'PRUNE_UNUSED_PALETTE': {
      const keepIds = new Set(action.keepIds);
      const palette = state.palette.filter((p) => p.name === 'Unclaimed' || keepIds.has(p.id));
      const validOwners = new Set(palette.filter((p) => p.owner).map((p) => p.owner));
      const teams = Object.fromEntries(Object.entries(state.teams).filter(([owner]) => validOwners.has(owner)));
      return { ...state, palette, teams };
    }

    // Step 3 (Rewards): bulk-applies a pre-rolled list of reward
    // placements — one dispatch covers every player at once, so
    // "Place Rewards Randomly" is a single undo step. `defender`, when
    // set, marks that player as the objective's starting defender
    // (same SET_OBJECTIVE_OWNER concept RewardPanel already uses) so
    // the reward reads as "defended, not yet banked" until someone
    // else captures the tile.
    case 'PLACE_DEFENDING_REWARDS': {
      const { placements } = action;
      const hexData = { ...state.hexData };
      for (const { key: k, rewardTypeId, defender } of placements) {
        const existing = ensureEntry(hexData, k);
        const meta = defender ? { ...existing.meta, objectiveOwner: defender } : existing.meta;
        hexData[k] = { ...existing, reward: rewardTypeId, meta };
      }
      return { ...state, hexData };
    }

    // Powers the wizard's Cancel button — a full state snapshot taken
    // when the wizard opened (see GameSetupWizard) gets restored
    // wholesale, undoing every commit the GM made while stepping
    // through it. Deliberately a plain, undoable action like everything
    // else here (not history-exempt) — an accidental Cancel is just one
    // Ctrl+Z away from being undone itself.
    case 'REPLACE_STATE':
      return action.state;

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

    // ---------------- Hex Effects (purely visual — see HexTile's and
    // ArtilleryStrike's renderers for each one). No game-state meaning
    // at all, just a look the GM can put on a hex — a live battle, a
    // shield, a passing shot, etc. `effect` is one of HEX_EFFECTS' ids
    // or null (none). Applies to every currently selected hex — except
    // 'artillery', which needs an origin *and* a target rather than a
    // uniform per-hex look, so it's handled as a special case below
    // instead of falling through to the general loop. ----------------
    case 'SET_HEX_EFFECT': {
      const { effect } = action;
      const keys = Object.keys(state.selected);

      if (effect === ARTILLERY_EFFECT_ID) {
        // Needs exactly an origin and a target — whichever hex was
        // selected first is the origin, whichever second is the target
        // (see SELECT_HEX's insertion-order preservation). Anything
        // else selected makes the pairing ambiguous, so this is a
        // no-op rather than guessing; ReadoutPanel only ever offers
        // this control once selection is down to exactly two anyway.
        if (keys.length !== 2) return state;
        const [originKey, targetKey] = keys;
        let hexData = { ...state.hexData };
        const originEntry = ensureEntry(hexData, originKey);
        hexData[originKey] = { ...originEntry, hexEffect: ARTILLERY_EFFECT_ID, artilleryTarget: targetKey };
        return { ...state, hexData };
      }

      let hexData = { ...state.hexData };
      for (const k of keys) {
        const entry = ensureEntry(hexData, k);
        hexData[k] = { ...entry, hexEffect: effect || null, artilleryTarget: null };
        hexData = pruneEntry(hexData, k);
      }
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

import { DEFAULT_PALETTE } from '../data/palette.js';
import { DEFAULT_REWARD_TYPES } from '../data/defaultRewardTypes.js';
import { iconById, iconKind } from '../data/legionIcons.js';
import { normalizeColor } from '../utils/hexMath.js';

let paletteIdCounter = DEFAULT_PALETTE.length;
let rewardTypeIdCounter = DEFAULT_REWARD_TYPES.length;

export const initialState = {
  cols: 12,
  rows: 8,
  hexData: {}, // key -> { color, icons: [iconId,...], factionIcon, reward, meta }
  colorOpacity: {}, // normalised colour -> opacity (0-1), shared by every hex using it
  palette: DEFAULT_PALETTE,
  selected: {}, // key -> true, for O(1) toggle/lookup
  activeColor: '#7a1e1e', // which colour the opacity slider controls
  factionIconOpacity: 0.9, // applies to every placed faction emblem, map-wide
  factionIconScale: {}, // iconId -> scale (1 = default), map-wide per faction
  activeFactionIcon: null, // which faction's scale slider is currently "aimed at"
  rewardTypes: DEFAULT_REWARD_TYPES,
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

function ensureEntry(hexData, k) {
  const existing = hexData[k];
  if (existing) return existing;
  return { color: null, paletteId: null, icons: [], factionIcon: null, reward: null, meta: {} };
}

function metaHasContent(meta) {
  if (!meta) return false;
  return Object.values(meta).some((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

// A hex entry that has nothing set is dropped so hexData doesn't
// accumulate empty placeholders as the user paints/clears.
function isEmptyEntry(e) {
  return !e.color && !e.paletteId && !e.factionIcon && !e.reward && (!e.icons || e.icons.length === 0) && !metaHasContent(e.meta);
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
      const cols = Math.max(1, Math.min(40, action.cols));
      const rows = Math.max(1, Math.min(40, action.rows));
      // Preserve data only for hexes that still exist at the new size.
      const hexData = {};
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const k = `${c},${r}`;
          if (state.hexData[k]) hexData[k] = state.hexData[k];
        }
      }
      return { ...state, cols, rows, hexData, selected: {} };
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
      return {
        ...state,
        palette: state.palette.map((p) => (p.id === id ? { ...p, ...changes } : p)),
      };
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

    case 'SET_FACTION_SCALE':
      return {
        ...state,
        factionIconScale: { ...state.factionIconScale, [action.iconId]: action.scale },
      };

    // ---------------- Reward system ----------------
    case 'ADD_REWARD_TYPE': {
      rewardTypeIdCounter += 1;
      const rt = { id: 'rt' + rewardTypeIdCounter, name: 'New Reward', iconId: action.iconId, frequency: 1, enabled: true };
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
      const hexData = { ...state.hexData };
      for (const k of Object.keys(state.selected)) {
        hexData[k] = { ...ensureEntry(hexData, k), reward: rewardTypeId };
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
        hexData[k] = { ...ensureEntry(hexData, k), reward: bag[i] };
      }
      return { ...state, hexData };
    }

    default:
      return state;
  }
}

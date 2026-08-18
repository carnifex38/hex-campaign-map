import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { mapReducer, initialState, getOpacity, getFactionScale, rewardTypeById, paletteEntryForColor, paletteEntryForHex, resolveHexColor, teamForOwner } from './mapReducer.js';
import { shuffleArray, key, hexDistance, isInHexagonShape } from '../utils/hexMath.js';
import { findDisconnectedHexes } from '../utils/connectivity.js';

const MapStateContext = createContext(null);
const MapDispatchContext = createContext(null);
const MapHistoryContext = createContext(null);

// Action types that change UI focus/tooling rather than actual map
// content — selection, which movement tool is active, which faction's
// scale slider is "aimed at". These still run through mapReducer as
// normal, but don't get their own Undo/Redo step: undoing a colour
// paint shouldn't also have to undo three clicks of hex selection that
// happened along the way, and nobody expects "which tool is active" to
// be something Ctrl+Z steps back through.
const HISTORY_EXEMPT_ACTIONS = new Set([
  'SELECT_HEX',
  'SELECT_HEXES',
  'CLEAR_SELECTION',
  'SET_MOVEMENT_MODE',
  'SET_LASSO_MODE',
  'SET_ACTIVE_FACTION_ICON',
  'TOGGLE_DISPLAY_SETTINGS',
  'OPEN_GAME_SETUP',
  'CLOSE_GAME_SETUP',
  'SET_GAME_SETUP_ARMED_PLACEMENT',
]);

const MAX_HISTORY = 100;

// Wraps mapReducer with undo/redo bookkeeping: { past: [...older states], present, future: [...states undone] }.
// UNDO/REDO themselves are handled here; every other action is applied
// via the real reducer and then either recorded (pushed onto `past`,
// clearing `future`) or, for HISTORY_EXEMPT_ACTIONS, applied in place
// without touching the history stacks at all.
function historyReducer(history, action) {
  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const present = history.past[history.past.length - 1];
    const past = history.past.slice(0, -1);
    return { past, present, future: [history.present, ...history.future] };
  }
  if (action.type === 'REDO') {
    if (history.future.length === 0) return history;
    const present = history.future[0];
    const future = history.future.slice(1);
    return { past: [...history.past, history.present], present, future };
  }

  const nextPresent = mapReducer(history.present, action);
  if (nextPresent === history.present) return history; // genuine no-op, don't record

  if (HISTORY_EXEMPT_ACTIONS.has(action.type)) {
    return { ...history, present: nextPresent };
  }

  const past = [...history.past, history.present];
  if (past.length > MAX_HISTORY) past.shift();
  return { past, present: nextPresent, future: [] };
}

export function MapProvider({ children }) {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: initialState, future: [] });
  const historyInfo = useMemo(
    () => ({ canUndo: history.past.length > 0, canRedo: history.future.length > 0 }),
    [history.past.length, history.future.length]
  );
  return (
    <MapStateContext.Provider value={history.present}>
      <MapDispatchContext.Provider value={dispatch}>
        <MapHistoryContext.Provider value={historyInfo}>
          {children}
        </MapHistoryContext.Provider>
      </MapDispatchContext.Provider>
    </MapStateContext.Provider>
  );
}

// { canUndo, canRedo } — for enabling/disabling Undo/Redo buttons etc.
export function useMapHistory() {
  const ctx = useContext(MapHistoryContext);
  if (!ctx) throw new Error('useMapHistory must be used inside <MapProvider>');
  return ctx;
}

export function useMapState() {
  const ctx = useContext(MapStateContext);
  if (!ctx) throw new Error('useMapState must be used inside <MapProvider>');
  return ctx;
}

export function useMapDispatch() {
  const ctx = useContext(MapDispatchContext);
  if (!ctx) throw new Error('useMapDispatch must be used inside <MapProvider>');
  return ctx;
}

// Bundles dispatch with the handful of actions that need to read state
// before dispatching (multi-step / randomised actions). Everything
// else is a thin `dispatch({ type: ... })` wrapper for readability at
// the call site — add new ones here as the app grows.
export function useMapActions() {
  const state = useMapState();
  const dispatch = useMapDispatch();

  return useMemo(
    () => ({
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),

      setGridSize: (cols, rows) => dispatch({ type: 'SET_GRID_SIZE', cols, rows }),
      setMapShape: (shape) => dispatch({ type: 'SET_MAP_SHAPE', shape }),
      selectHex: (key, additive) => dispatch({ type: 'SELECT_HEX', key, additive }),
      selectHexes: (keys, additive) => dispatch({ type: 'SELECT_HEXES', keys, additive }),
      clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),
      updateHexMeta: (key, changes) => dispatch({ type: 'UPDATE_HEX_META', key, changes }),
      setObjectiveOwner: (owner) => dispatch({ type: 'SET_OBJECTIVE_OWNER', owner }),
      setPlayerTeam: (owner, team) => dispatch({ type: 'SET_PLAYER_TEAM', owner, team: team || null }),

      addManualPlayerReward: (player) => dispatch({ type: 'ADD_MANUAL_PLAYER_REWARD', player }),
      updateManualPlayerReward: (player, index, text) => dispatch({ type: 'UPDATE_MANUAL_PLAYER_REWARD', player, index, text }),
      removeManualPlayerReward: (player, index) => dispatch({ type: 'REMOVE_MANUAL_PLAYER_REWARD', player, index }),

      applyColor: (color, paletteId) => dispatch({ type: 'APPLY_COLOR', color, paletteId: paletteId || null }),
      setColorOpacity: (color, opacity) => dispatch({ type: 'SET_COLOR_OPACITY', color, opacity }),
      clearHexColor: () => dispatch({ type: 'CLEAR_HEX_COLOR' }),
      resetAllColors: () => dispatch({ type: 'RESET_ALL_COLORS' }),

      addPaletteEntry: () => dispatch({ type: 'ADD_PALETTE_ENTRY' }),
      updatePaletteEntry: (id, changes) => dispatch({ type: 'UPDATE_PALETTE_ENTRY', id, changes }),
      removePaletteEntry: (id) => dispatch({ type: 'REMOVE_PALETTE_ENTRY', id }),

      addIcon: (iconId) => dispatch({ type: 'ADD_ICON', iconId }),
      setActiveFactionIcon: (iconId) => dispatch({ type: 'SET_ACTIVE_FACTION_ICON', iconId }),
      removeUnitIcon: (key, iconId) => dispatch({ type: 'REMOVE_UNIT_ICON', key, iconId }),
      clearUnitIcons: () => dispatch({ type: 'CLEAR_UNIT_ICONS' }),
      clearFactionIcon: () => dispatch({ type: 'CLEAR_FACTION_ICON' }),
      resetAllIcons: () => dispatch({ type: 'RESET_ALL_ICONS' }),
      setFactionOpacity: (opacity) => dispatch({ type: 'SET_FACTION_OPACITY', opacity }),
      setShowCapturedRewardOutlines: (show) => dispatch({ type: 'SET_SHOW_CAPTURED_REWARD_OUTLINES', show }),
      setFactionScale: (iconId, scale) => dispatch({ type: 'SET_FACTION_SCALE', iconId, scale }),

      toggleDisplaySettings: () => dispatch({ type: 'TOGGLE_DISPLAY_SETTINGS' }),
      setHexLineColor: (color) => dispatch({ type: 'SET_HEX_LINE_COLOR', color }),
      setHexLineWidth: (width) => dispatch({ type: 'SET_HEX_LINE_WIDTH', width }),
      setHexTextColor: (color) => dispatch({ type: 'SET_HEX_TEXT_COLOR', color }),
      setHexTextOpacity: (opacity) => dispatch({ type: 'SET_HEX_TEXT_OPACITY', opacity }),
      setHexTextSize: (size) => dispatch({ type: 'SET_HEX_TEXT_SIZE', size }),
      setMapOpacity: (opacity) => dispatch({ type: 'SET_MAP_OPACITY', opacity }),
      setShieldColor: (color) => dispatch({ type: 'SET_SHIELD_COLOR', color }),
      setShieldGlowStrength: (value) => dispatch({ type: 'SET_SHIELD_GLOW_STRENGTH', value }),
      setShieldFalloff: (value) => dispatch({ type: 'SET_SHIELD_FALLOFF', value }),
      setShieldOpacityStrength: (value) => dispatch({ type: 'SET_SHIELD_OPACITY_STRENGTH', value }),
      setShieldStencilOpacity: (value) => dispatch({ type: 'SET_SHIELD_STENCIL_OPACITY', value }),
      setExplosionColor: (color) => dispatch({ type: 'SET_EXPLOSION_COLOR', color }),
      setArtillerySpeed: (value) => dispatch({ type: 'SET_ARTILLERY_SPEED', value }),
      setArtilleryFrequency: (value) => dispatch({ type: 'SET_ARTILLERY_FREQUENCY', value }),
      setRadarColor: (color) => dispatch({ type: 'SET_RADAR_COLOR', color }),
      resetDisplaySettings: () => dispatch({ type: 'RESET_DISPLAY_SETTINGS' }),
      cleanAll: () => dispatch({ type: 'CLEAN_ALL' }),

      openGameSetup: () => dispatch({ type: 'OPEN_GAME_SETUP' }),
      closeGameSetup: () => dispatch({ type: 'CLOSE_GAME_SETUP' }),
      setGameSetupArmedPlacement: (placement) => dispatch({ type: 'SET_GAME_SETUP_ARMED_PLACEMENT', placement }),
      replaceState: (nextState) => dispatch({ type: 'REPLACE_STATE', state: nextState }),
      pruneUnusedPalette: (keepIds) => dispatch({ type: 'PRUNE_UNUSED_PALETTE', keepIds }),

      // Step 2 of the New Game Setup wizard: paints every hex within
      // `radius` of `centerKey` (cube-distance, same maths as the
      // Hexagon map shape's mask) with one player's colour, dropping
      // their home-base emblem on just the centre hex. Needs cols/rows
      // + the hexagon-shape mask (when active) from state, so it's a
      // thunk here rather than reducer logic — see PLACE_TERRITORY.
      placeTerritory: (centerKey, radius, color, paletteId, homeIconId) => {
        const [ccStr, crStr] = centerKey.split(',');
        const cc = Number(ccStr);
        const cr = Number(crStr);
        const keys = [];
        for (let c = 0; c < state.cols; c++) {
          for (let r = 0; r < state.rows; r++) {
            if (state.mapShape === 'hexagon' && !isInHexagonShape(c, r, state.cols)) continue;
            if (hexDistance(c, r, cc, cr) <= radius) keys.push(key(c, r));
          }
        }
        dispatch({ type: 'PLACE_TERRITORY', keys, centerKey, color, paletteId, homeIconId });
      },

      // Step 3 of the New Game Setup wizard: one random pass of
      // defending rewards across every player's territory at once —
      // territory is derived live from hexData (whichever hexes carry
      // that player's paletteId), same "territory = painted colour"
      // rule the rest of the app already uses, not a separately
      // tracked region. Always skips the player's own home-base hex
      // (has factionIcon set) and any hex that already has a reward.
      // `players`: [{ name, paletteId }].
      placeDefendingRewards: (players, giveDefender) => {
        const activeTypes = state.rewardTypes.filter((rt) => rt.enabled !== false && (rt.frequency || 0) > 0);
        if (activeTypes.length === 0) return { ok: false, reason: 'no-active-types' };

        const placements = [];
        players.forEach((p) => {
          const territoryKeys = Object.keys(state.hexData).filter((k) => {
            const e = state.hexData[k];
            return e && e.paletteId === p.paletteId && !e.reward && !e.factionIcon;
          });
          if (territoryKeys.length === 0) return;

          const bag = [];
          activeTypes.forEach((rt) => {
            for (let i = 0; i < rt.frequency; i++) bag.push(rt.id);
          });

          const shuffledKeys = shuffleArray(territoryKeys);
          const shuffledBag = shuffleArray(bag);
          const count = Math.min(shuffledKeys.length, shuffledBag.length);
          for (let i = 0; i < count; i++) {
            placements.push({ key: shuffledKeys[i], rewardTypeId: shuffledBag[i], defender: giveDefender ? p.name : null });
          }
        });

        if (placements.length === 0) return { ok: false, reason: 'no-eligible-hexes' };
        dispatch({ type: 'PLACE_DEFENDING_REWARDS', placements });
        return { ok: true, placed: placements.length };
      },

      addRewardType: (iconId) => dispatch({ type: 'ADD_REWARD_TYPE', iconId }),
      updateRewardType: (id, changes) => dispatch({ type: 'UPDATE_REWARD_TYPE', id, changes }),
      removeRewardType: (id) => dispatch({ type: 'REMOVE_REWARD_TYPE', id }),
      placeReward: (rewardTypeId) => dispatch({ type: 'PLACE_REWARD', rewardTypeId }),
      clearRewards: () => dispatch({ type: 'CLEAR_REWARDS' }),
      resetAllRewards: () => dispatch({ type: 'RESET_ALL_REWARDS' }),

      placeQuestMarker: (color) => dispatch({ type: 'PLACE_QUEST_MARKER', color }),
      updateHexQuest: (key, changes) => dispatch({ type: 'UPDATE_HEX_QUEST', key, changes }),
      clearQuestMarker: () => dispatch({ type: 'CLEAR_QUEST_MARKER' }),
      resolveQuest: (key, outcome) => dispatch({ type: 'RESOLVE_QUEST', key, outcome }),
      setHexEffect: (effect) => dispatch({ type: 'SET_HEX_EFFECT', effect }),
      addCampaignEffect: (text) => dispatch({ type: 'ADD_CAMPAIGN_EFFECT', text }),
      removeCampaignEffect: (id) => dispatch({ type: 'REMOVE_CAMPAIGN_EFFECT', id }),

      setMovementMode: (mode) => dispatch({ type: 'SET_MOVEMENT_MODE', mode }),
      setLassoMode: () => dispatch({ type: 'SET_LASSO_MODE' }),
      movementHexClick: (key) => dispatch({ type: 'MOVEMENT_HEX_CLICK', key }),
      createMovementLine: (fromKey, toKey) => dispatch({ type: 'CREATE_MOVEMENT_LINE', fromKey, toKey }),
      removeMovementLine: (id) => dispatch({ type: 'REMOVE_MOVEMENT_LINE', id }),
      initializeMovement: () => dispatch({ type: 'INITIALIZE_MOVEMENT' }),
      resolveSectorContest: (hexKey, colorNorm) => dispatch({ type: 'RESOLVE_SECTOR_CONTEST', hexKey, colorNorm }),
      skipSectorContest: (hexKey) => dispatch({ type: 'SKIP_SECTOR_CONTEST', hexKey }),

      // Randomisation needs to read current selection + reward types to
      // build the shuffled pool, so it lives here rather than in the
      // (pure) reducer. Returns a result object the caller can use to
      // show feedback (alerts, toasts, whatever the UI wants).
      randomizeRewards: () => {
        const selectedKeys = Object.keys(state.selected);
        if (selectedKeys.length === 0) return { ok: false, reason: 'no-selection' };

        const activeTypes = state.rewardTypes.filter((rt) => rt.enabled !== false && (rt.frequency || 0) > 0);
        if (activeTypes.length === 0) return { ok: false, reason: 'no-active-types' };

        const eligible = selectedKeys.filter((k) => !state.hexData[k] || !state.hexData[k].reward);
        if (eligible.length === 0) return { ok: false, reason: 'no-eligible-hexes' };

        const bag = [];
        activeTypes.forEach((rt) => {
          for (let i = 0; i < rt.frequency; i++) bag.push(rt.id);
        });

        const eligibleKeys = shuffleArray(eligible);
        const shuffledBag = shuffleArray(bag);
        dispatch({ type: 'RANDOMIZE_REWARDS', eligibleKeys, bag: shuffledBag });
        return { ok: true, placed: Math.min(eligibleKeys.length, shuffledBag.length) };
      },
    }),
    [state, dispatch]
  );
}

// Re-exported so components can do `useMapSelectors().getOpacity(color)`
// without importing from state/mapReducer.js directly.
export function useMapSelectors() {
  const state = useMapState();
  return useMemo(() => {
    const disconnected = findDisconnectedHexes(state);
    return {
      getOpacity: (color) => getOpacity(state, color),
      getFactionScale: (iconId) => getFactionScale(state, iconId),
      rewardTypeById: (id) => rewardTypeById(state, id),
      paletteEntryForColor: (color) => paletteEntryForColor(state, color),
      paletteEntryForHex: (entry) => paletteEntryForHex(state, entry),
      resolveHexColor: (entry) => resolveHexColor(state, entry),
      teamForOwner: (owner) => teamForOwner(state, owner),
      isDisconnected: (key) => disconnected.has(key),
    };
  }, [state]);
}

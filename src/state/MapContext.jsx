import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { mapReducer, initialState, getOpacity, getFactionScale, rewardTypeById, paletteEntryForColor, paletteEntryForHex, resolveHexColor } from './mapReducer.js';
import { shuffleArray } from '../utils/hexMath.js';
import { findDisconnectedHexes } from '../utils/connectivity.js';

const MapStateContext = createContext(null);
const MapDispatchContext = createContext(null);

export function MapProvider({ children }) {
  const [state, dispatch] = useReducer(mapReducer, initialState);
  return (
    <MapStateContext.Provider value={state}>
      <MapDispatchContext.Provider value={dispatch}>
        {children}
      </MapDispatchContext.Provider>
    </MapStateContext.Provider>
  );
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
      setGridSize: (cols, rows) => dispatch({ type: 'SET_GRID_SIZE', cols, rows }),
      selectHex: (key, additive) => dispatch({ type: 'SELECT_HEX', key, additive }),
      clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),
      updateHexMeta: (key, changes) => dispatch({ type: 'UPDATE_HEX_META', key, changes }),
      setObjectiveOwner: (owner) => dispatch({ type: 'SET_OBJECTIVE_OWNER', owner }),

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
      setFactionScale: (iconId, scale) => dispatch({ type: 'SET_FACTION_SCALE', iconId, scale }),

      addRewardType: (iconId) => dispatch({ type: 'ADD_REWARD_TYPE', iconId }),
      updateRewardType: (id, changes) => dispatch({ type: 'UPDATE_REWARD_TYPE', id, changes }),
      removeRewardType: (id) => dispatch({ type: 'REMOVE_REWARD_TYPE', id }),
      placeReward: (rewardTypeId) => dispatch({ type: 'PLACE_REWARD', rewardTypeId }),
      clearRewards: () => dispatch({ type: 'CLEAR_REWARDS' }),
      resetAllRewards: () => dispatch({ type: 'RESET_ALL_REWARDS' }),

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
      isDisconnected: (key) => disconnected.has(key),
    };
  }, [state]);
}

import React from 'react';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { iconById } from '../../data/legionIcons.js';
import { HEX_EFFECTS, ARTILLERY_EFFECT_ID } from '../../state/mapReducer.js';

// The bulk N-hex Battle Effect dropdown applies uniformly to every
// selected hex — Artillery Strike needs an origin *and* a target
// instead, so it's excluded here and offered as its own selector below
// once selection is down to exactly two.
const BULK_HEX_EFFECTS = HEX_EFFECTS.filter((fx) => fx.id !== ARTILLERY_EFFECT_ID);

function groupIcons(iconsArr) {
  const counts = {};
  (iconsArr || []).forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

export default function ReadoutPanel() {
  const state = useMapState();
  const actions = useMapActions();
  const { getOpacity, rewardTypeById, resolveHexColor } = useMapSelectors();
  const selectedKeys = Object.keys(state.selected);

  return (
    <div style={{ padding: '16px 18px 0' }}>
      <div className="panel-title">Auspex Readout</div>

      {selectedKeys.length === 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)' }}>No hex selected.</div>
          <div className="hint-text" style={{ borderLeft: '2px solid var(--steel-line)', paddingLeft: 10 }}>
            Select any hex to edit it. Hold Ctrl/Cmd and click to select multiple hexes at once.
          </div>
        </>
      )}

      {selectedKeys.length === 1 && (() => {
        const k = selectedKeys[0];
        const [c, r] = k.split(',');
        const entry = state.hexData[k];
        const resolvedColor = entry ? resolveHexColor(entry) : null;
        const colorLabel = resolvedColor ? resolvedColor.toUpperCase() : 'UNSET';
        const opacityLabel = resolvedColor ? `${Math.round(getOpacity(resolvedColor) * 100)}%` : '\u2014';
        const factionLabel = entry && entry.factionIcon ? (iconById(entry.factionIcon) || {}).label : 'None';
        const counts = groupIcons(entry ? entry.icons : []);
        const iconIds = Object.keys(counts);
        const iconLabel = iconIds.length
          ? iconIds.map((id) => `${(iconById(id) || { label: id }).label} \u00d7${counts[id]}`).join(', ')
          : 'None';
        const rewardLabel = entry && entry.reward ? (rewardTypeById(entry.reward) || {}).name : 'None';

        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)', lineHeight: 1.8 }}>
            <div><b style={{ color: 'var(--bone)' }}>Grid Ref:</b> COL {c} / ROW {r}</div>
            <div><b style={{ color: 'var(--bone)' }}>Status:</b> {resolvedColor ? 'ASSIGNED' : 'UNCLAIMED'}</div>
            <div><b style={{ color: 'var(--bone)' }}>Colour:</b> {colorLabel}</div>
            <div><b style={{ color: 'var(--bone)' }}>Opacity:</b> {opacityLabel}</div>
            <div><b style={{ color: 'var(--bone)' }}>Faction:</b> {factionLabel || 'None'}</div>
            <div><b style={{ color: 'var(--bone)' }}>Icons:</b> {iconLabel}</div>
            <div><b style={{ color: 'var(--bone)' }}>Reward:</b> {rewardLabel || 'None'}</div>
          </div>
        );
      })()}

      {selectedKeys.length > 1 && (() => {
        const assigned = selectedKeys.filter((k) => resolveHexColor(state.hexData[k])).length;
        const factions = selectedKeys.filter((k) => state.hexData[k] && state.hexData[k].factionIcon).length;
        const icons = selectedKeys.reduce((s, k) => s + ((state.hexData[k] && state.hexData[k].icons) || []).length, 0);
        const rewards = selectedKeys.filter((k) => state.hexData[k] && state.hexData[k].reward).length;

        // Bulk Battle Effect control — SET_HEX_EFFECT already applies to
        // every selected hex in one dispatch, this was just never exposed
        // anywhere but the single-hex popup. Shows "Mixed" when the
        // selection doesn't already agree on one effect, same idea as a
        // typical multi-select "mixed value" dropdown.
        const effectsPresent = new Set(selectedKeys.map((k) => (state.hexData[k] && state.hexData[k].hexEffect) || ''));
        const mixed = effectsPresent.size > 1;
        const effectValue = mixed ? '' : [...effectsPresent][0];

        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)', lineHeight: 1.8 }}>
            <div><b style={{ color: 'var(--bone)' }}>Selection:</b> {selectedKeys.length} hexes</div>
            <div><b style={{ color: 'var(--bone)' }}>Assigned:</b> {assigned}</div>
            <div><b style={{ color: 'var(--bone)' }}>Unclaimed:</b> {selectedKeys.length - assigned}</div>
            <div><b style={{ color: 'var(--bone)' }}>Faction Emblems:</b> {factions}</div>
            <div><b style={{ color: 'var(--bone)' }}>Icons Placed:</b> {icons}</div>
            <div><b style={{ color: 'var(--bone)' }}>Rewards Placed:</b> {rewards}</div>

            <div className="field" style={{ marginTop: 10 }}>
              <label style={{ fontSize: 9 }}>
                Battle Effect ({selectedKeys.length} hexes){mixed ? ' — mixed' : ''}
              </label>
              <select
                value={effectValue}
                onChange={(e) => actions.setHexEffect(e.target.value || null)}
                style={{ width: '100%' }}
              >
                <option value="">None{mixed ? ' (clear all)' : ''}</option>
                {BULK_HEX_EFFECTS.map((fx) => (
                  <option key={fx.id} value={fx.id}>{fx.label}{mixed ? ' (apply to all)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Artillery Strike — needs exactly two hexes: whichever
                was selected first is the origin, whichever second is
                the target (see SELECT_HEX — insertion order into
                state.selected). Picking it here just sets it, the same
                as picking Force Shield/Explosions above does — it
                starts playing immediately and keeps looping, nothing
                to trigger separately, nothing to clean up. */}
            {selectedKeys.length === 2 && (() => {
              const [originKey, targetKey] = selectedKeys;
              const originEntry = state.hexData[originKey];
              const active = !!(originEntry && originEntry.hexEffect === ARTILLERY_EFFECT_ID && originEntry.artilleryTarget === targetKey);
              return (
                <div className="field" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--steel-line)' }}>
                  <label style={{ fontSize: 9 }}>Artillery Strike</label>
                  <div style={{ fontSize: 10.5, marginBottom: 6 }}>
                    Origin: Hex {originKey.replace(',', ' / ')} &rarr; Target: Hex {targetKey.replace(',', ' / ')}
                  </div>
                  <select
                    value={active ? ARTILLERY_EFFECT_ID : ''}
                    onChange={(e) => actions.setHexEffect(e.target.value || null)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Off</option>
                    <option value={ARTILLERY_EFFECT_ID}>Firing (looping)</option>
                  </select>
                </div>
              );
            })()}
            {selectedKeys.length > 2 && (
              <div style={{ marginTop: 8, color: 'var(--gold-dim)', fontSize: 10 }}>
                Artillery Strike needs exactly 2 hexes selected (origin, then target) — drop down to 2 to set it.
              </div>
            )}

            <div style={{ marginTop: 8, color: 'var(--gold-dim)', fontSize: 10 }}>Ctrl+click to add or remove hexes from the selection, or use Lasso Select to grab a whole area at once.</div>
          </div>
        );
      })()}
    </div>
  );
}

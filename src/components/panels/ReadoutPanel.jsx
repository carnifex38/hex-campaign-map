import React from 'react';
import { useMapState, useMapSelectors } from '../../state/MapContext.jsx';
import { iconById } from '../../data/legionIcons.js';

function groupIcons(iconsArr) {
  const counts = {};
  (iconsArr || []).forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

export default function ReadoutPanel() {
  const state = useMapState();
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
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)', lineHeight: 1.8 }}>
            <div><b style={{ color: 'var(--bone)' }}>Selection:</b> {selectedKeys.length} hexes</div>
            <div><b style={{ color: 'var(--bone)' }}>Assigned:</b> {assigned}</div>
            <div><b style={{ color: 'var(--bone)' }}>Unclaimed:</b> {selectedKeys.length - assigned}</div>
            <div><b style={{ color: 'var(--bone)' }}>Faction Emblems:</b> {factions}</div>
            <div><b style={{ color: 'var(--bone)' }}>Icons Placed:</b> {icons}</div>
            <div><b style={{ color: 'var(--bone)' }}>Rewards Placed:</b> {rewards}</div>
            <div style={{ marginTop: 8, color: 'var(--gold-dim)', fontSize: 10 }}>Ctrl+click to add or remove hexes from the selection.</div>
          </div>
        );
      })()}
    </div>
  );
}

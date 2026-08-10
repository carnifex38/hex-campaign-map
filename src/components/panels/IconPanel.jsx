import React, { useMemo } from 'react';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { ALL_ICONS, iconById } from '../../data/legionIcons.js';

function groupIcons(iconsArr) {
  const counts = {};
  (iconsArr || []).forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

export default function IconPanel() {
  const state = useMapState();
  const actions = useMapActions();
  const { getFactionScale } = useMapSelectors();
  const selectedKeys = Object.keys(state.selected);
  const hasSelection = selectedKeys.length > 0;

  const groups = useMemo(() => [...new Set(ALL_ICONS.map((ic) => ic.group))], []);
  const activeFactionDef = state.activeFactionIcon ? iconById(state.activeFactionIcon) : null;

  const onIconClick = (iconId) => {
    actions.addIcon(iconId);
  };

  return (
    <div style={{ padding: 18 }}>
      <div className="panel-title">Icons</div>

      {groups.map((groupName) => (
        <div key={groupName}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--bone-dim)', margin: '10px 0 6px' }}>
            {groupName}
          </div>
          <div className="swatch-grid">
            {ALL_ICONS.filter((ic) => ic.group === groupName).map((ic) => (
              <div key={ic.id} className="swatch" title={ic.label} onClick={() => onIconClick(ic.id)}>
                <img src={ic.url} alt={ic.label} draggable={false} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {!hasSelection && (
        <div className="hint-text">
          Select hex(es) to place icons on them &mdash; unit-type markers stack, a legion emblem fills the whole hex.
        </div>
      )}

      <div className="opacity-row">
        <div className="opacity-head">
          <label>Faction Emblem Opacity (applies map-wide)</label>
          <span className="value">{Math.round(state.factionIconOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round(state.factionIconOpacity * 100)}
          onChange={(e) => actions.setFactionOpacity(Number(e.target.value) / 100)}
        />
      </div>

      <div className="opacity-row">
        <div className="opacity-head">
          <label>Faction Emblem Size &mdash; {activeFactionDef ? activeFactionDef.label : 'None selected'}</label>
          <span className="value">{Math.round(getFactionScale(state.activeFactionIcon) * 100)}%</span>
        </div>
        <input
          type="range"
          min="40"
          max="180"
          value={Math.round(getFactionScale(state.activeFactionIcon) * 100)}
          onChange={(e) => actions.setFactionScale(state.activeFactionIcon, Number(e.target.value) / 100)}
        />
        <div className="hint-text" style={{ margin: '4px 0 0' }}>
          Applies to every hex using this faction's emblem, map-wide. Click a legion icon above to pick which one this controls.
        </div>
      </div>

      {selectedKeys.length === 1 && <SingleHexIconList hexKey={selectedKeys[0]} />}

      {hasSelection && (
        <>
          <button className="btn-clear" onClick={actions.clearFactionIcon}>Remove Faction Emblem (Selection)</button>
          <button className="btn-clear" onClick={actions.clearUnitIcons}>Remove Unit Icons (Selection)</button>
        </>
      )}
    </div>
  );
}

function SingleHexIconList({ hexKey }) {
  const state = useMapState();
  const actions = useMapActions();
  const entry = state.hexData[hexKey];
  const factionDef = entry && entry.factionIcon ? iconById(entry.factionIcon) : null;
  const counts = groupIcons(entry ? entry.icons : []);
  const unitIds = Object.keys(counts);

  return (
    <div className="section">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--bone-dim)', marginBottom: 6 }}>
        Faction Emblem
      </div>
      {factionDef ? (
        <Chip
          iconUrl={factionDef.url}
          label={factionDef.label}
          onRemove={actions.clearFactionIcon}
        />
      ) : (
        <div className="hint-text" style={{ margin: 0 }}>No faction emblem assigned.</div>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--bone-dim)', margin: '14px 0 6px' }}>
        Unit Icons
      </div>
      {unitIds.length === 0 && <div className="hint-text" style={{ margin: 0 }}>No unit icons placed on this hex.</div>}
      {unitIds.map((id) => {
        const def = iconById(id);
        if (!def) return null;
        return (
          <Chip
            key={id}
            iconUrl={def.url}
            label={def.label}
            count={counts[id]}
            onRemove={() => actions.removeUnitIcon(hexKey, id)}
          />
        );
      })}
    </div>
  );
}

function Chip({ iconUrl, label, count, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f1112', border: '1px solid var(--steel-line)', borderRadius: 3, padding: '5px 7px', marginBottom: 6 }}>
      <img src={iconUrl} alt={label} style={{ width: 18, height: 18, flexShrink: 0, filter: 'invert(1)' }} />
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{label}</span>
      {count != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)' }}>&times;{count}</span>}
      <button
        onClick={onRemove}
        title="Remove"
        style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--steel-line)', color: 'var(--bone-dim)', fontSize: 11, padding: 0, borderRadius: 2, cursor: 'pointer' }}
      >
        &minus;
      </button>
    </div>
  );
}

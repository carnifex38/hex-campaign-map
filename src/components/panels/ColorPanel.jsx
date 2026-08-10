import React, { useMemo } from 'react';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { toHexColor } from '../../utils/hexMath.js';
import { ALL_ICONS, iconKind } from '../../data/legionIcons.js';

const HOME_ICON_OPTIONS = ALL_ICONS.filter((ic) => iconKind(ic) === 'faction');

export default function ColorPanel() {
  const state = useMapState();
  const actions = useMapActions();
  const { getOpacity } = useMapSelectors();
  const hasSelection = Object.keys(state.selected).length > 0;
  const opacity = getOpacity(state.activeColor);

  return (
    <div style={{ padding: 18 }}>
      <div className="panel-title">Faction Palette</div>

      {!hasSelection && (
        <div className="hint-text">Select a hex (or several with Ctrl+click) to paint it.</div>
      )}

      {hasSelection && (
        <>
          <div className="swatch-grid">
            {state.palette.map((p) => (
              <div
                key={p.id}
                className={`swatch${state.activeColor.toLowerCase() === p.color.toLowerCase() ? ' active' : ''}`}
                style={{ background: p.color }}
                title={p.name}
                onClick={() => actions.applyColor(p.color, p.id)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bone-dim)', textTransform: 'uppercase' }}>Custom</label>
            <input
              type="color"
              value={toHexColor(state.activeColor)}
              onChange={(e) => actions.applyColor(e.target.value)}
              style={{ width: 36, height: 30, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
            />
          </div>

          <div className="opacity-row">
            <div className="opacity-head">
              <label>Opacity (applies to this colour everywhere)</label>
              <span className="value">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(e) => actions.setColorOpacity(state.activeColor, Number(e.target.value) / 100)}
            />
          </div>

          <button className="btn-clear" onClick={actions.clearHexColor}>Clear Selected Hex(es)</button>
        </>
      )}

      <div className="section">
        <div className="panel-title">Legend Key</div>
        <div className="hint-text" style={{ marginTop: -4 }}>
          Give a colour an Owner and a Home Base emblem to track its supply
          line: any tile of that colour not connected, hex-by-hex, back to
          a hex carrying the home emblem renders darkened and hatched.
        </div>
        {state.palette.map((p) => (
          <LegendRow key={p.id} entry={p} onUpdate={actions.updatePaletteEntry} onRemove={actions.removePaletteEntry} />
        ))}
        <button
          style={{ marginTop: 8, width: '100%', background: 'transparent', border: '1px dashed var(--steel-line)', color: 'var(--gold-dim)', padding: 7, fontSize: 11 }}
          onClick={actions.addPaletteEntry}
        >
          + Add Legend Entry
        </button>
      </div>
    </div>
  );
}

function LegendRow({ entry, onUpdate, onRemove }) {
  const tracked = !!(entry.owner && entry.homeIconId);
  return (
    <div
      style={{
        border: '1px solid var(--steel-line)',
        borderRadius: 3,
        padding: 6,
        marginBottom: 7,
        background: tracked ? 'rgba(184,150,62,0.06)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={toHexColor(entry.color)}
          onChange={(e) => onUpdate(entry.id, { color: e.target.value })}
          style={{ width: 22, height: 22, border: '1px solid rgba(0,0,0,0.4)', borderRadius: 3, background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
        />
        <input
          type="text"
          value={entry.name}
          onChange={(e) => onUpdate(entry.id, { name: e.target.value })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          onClick={() => onRemove(entry.id)}
          title="Remove entry"
          style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--steel-line)', color: 'var(--bone-dim)', fontSize: 12, padding: 0, borderRadius: 2, cursor: 'pointer' }}
        >
          &times;
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <input
          type="text"
          placeholder="Owner / player"
          value={entry.owner || ''}
          onChange={(e) => onUpdate(entry.id, { owner: e.target.value })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <select
          value={entry.homeIconId || ''}
          onChange={(e) => onUpdate(entry.id, { homeIconId: e.target.value || null })}
          style={{ flex: 1, minWidth: 0 }}
        >
          <option value="">No home base</option>
          {HOME_ICON_OPTIONS.map((ic) => (
            <option key={ic.id} value={ic.id}>{ic.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

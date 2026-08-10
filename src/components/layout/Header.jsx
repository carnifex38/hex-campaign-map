import React, { useState } from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';
import DropdownMenu from './DropdownMenu.jsx';

export default function Header() {
  const state = useMapState();
  const actions = useMapActions();
  const [cols, setCols] = useState(state.cols);
  const [rows, setRows] = useState(state.rows);

  const applyGridSize = () => actions.setGridSize(Number(cols) || 1, Number(rows) || 1);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '14px 22px',
        background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
        borderBottom: '2px solid var(--bronze)',
        boxShadow: '0 2px 14px rgba(0,0,0,0.5)',
        flexWrap: 'wrap',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ color: 'var(--gold)', fontSize: 20 }}>&#10023;</span>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 20,
              letterSpacing: 3,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            Cartograph-Pattern Tactical Grid
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 2, color: 'var(--bone-dim)', textTransform: 'uppercase' }}>
            Mk. II Battlefield Cogitator &mdash; Sector Mapping Unit
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div className="field">
          <label>Across</label>
          <input type="number" min="1" max="40" value={cols} onChange={(e) => setCols(e.target.value)} />
        </div>
        <div className="field">
          <label>Down</label>
          <input type="number" min="1" max="40" value={rows} onChange={(e) => setRows(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={applyGridSize}>Render Grid</button>

        <DropdownMenu
          label="Map Actions"
          items={[
            { label: 'Reset Colours', onClick: actions.resetAllColors },
            { label: 'Clear All Icons', onClick: actions.resetAllIcons },
            { label: 'Clear All Rewards', onClick: actions.resetAllRewards, danger: true },
          ]}
        />
      </div>
    </header>
  );
}

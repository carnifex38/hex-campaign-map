import React, { useEffect, useState } from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';
import DropdownMenu from './DropdownMenu.jsx';

export default function Header() {
  const state = useMapState();
  const actions = useMapActions();
  const [cols, setCols] = useState(state.cols);
  const [rows, setRows] = useState(state.rows);
  const isHexagon = state.mapShape === 'hexagon';

  // The grid can resize itself out from under these local inputs —
  // e.g. switching to Hexagon shape snaps cols/rows to a clean
  // symmetric size on its own — so keep them in sync with state
  // rather than only ever pushing local edits outward.
  useEffect(() => {
    setCols(state.cols);
    setRows(state.rows);
  }, [state.cols, state.rows]);

  const applyGridSize = () => actions.setGridSize(Number(cols) || 1, Number(rows) || 1);
  const handleColsChange = (value) => {
    setCols(value);
    if (isHexagon) setRows(value); // Diameter drives both in Hexagon mode
  };

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
          <label>Map Shape</label>
          <select value={state.mapShape} onChange={(e) => actions.setMapShape(e.target.value)}>
            <option value="rectangle">Rectangle</option>
            <option value="hexagon">Hexagon</option>
          </select>
        </div>
        <div className="field">
          <label>{isHexagon ? 'Diameter' : 'Across'}</label>
          <input type="number" min="3" max="40" value={cols} onChange={(e) => handleColsChange(e.target.value)} />
        </div>
        {!isHexagon && (
          <div className="field">
            <label>Down</label>
            <input type="number" min="1" max="40" value={rows} onChange={(e) => setRows(e.target.value)} />
          </div>
        )}
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

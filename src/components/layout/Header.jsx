import React, { useEffect, useState } from 'react';
import { useMapState, useMapActions, useMapHistory } from '../../state/MapContext.jsx';
import DropdownMenu from './DropdownMenu.jsx';

export default function Header() {
  const state = useMapState();
  const actions = useMapActions();
  const { canUndo, canRedo } = useMapHistory();
  const [cols, setCols] = useState(state.cols);
  const [rows, setRows] = useState(state.rows);
  const isHexagon = state.mapShape === 'hexagon';

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo — global,
  // since undo/redo should work no matter which panel has focus. Skips
  // while a text field has focus so it doesn't hijack the browser's
  // own undo inside whatever the GM is typing (mission text, quest
  // award/penalty notes, etc.) — same guard HexMapCanvas uses for its
  // mousedown handler, and for the same reason.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const isRedo = k === 'y' || e.shiftKey;
      e.preventDefault();
      if (isRedo) actions.redo();
      else actions.undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions]);

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
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-ghost"
            onClick={actions.undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{ padding: '9px 11px', opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
          >
            <UndoIcon />
          </button>
          <button
            className="btn-ghost"
            onClick={actions.redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            style={{ padding: '9px 11px', opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'default' }}
          >
            <RedoIcon />
          </button>
        </div>
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
            { label: 'Clean All', onClick: actions.cleanAll, danger: true, title: 'Wipes every hex — colours, icons, rewards, quests, battlefield effects — plus movement lines and campaign effects. Grid size, Legend Key, teams, and reward/display setup are left alone.' },
          ]}
        />

        <DropdownMenu
          label="Game Session"
          items={[
            { label: 'New Game Setup', onClick: actions.openGameSetup, title: 'Step-by-step wizard: players & teams, territory placement, then defending rewards.' },
          ]}
        />

        <button
          className="btn-ghost"
          onClick={actions.toggleDisplaySettings}
          title="Display Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: state.displaySettingsOpen ? 'var(--gold)' : 'var(--bone-dim)',
            borderColor: state.displaySettingsOpen ? 'var(--gold-dim)' : 'var(--steel-line)',
          }}
        >
          <GearIcon />
          Display Settings
        </button>
      </div>
    </header>
  );
}

function GearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 7H15C18.3137 7 21 9.68629 21 13C21 16.3137 18.3137 19 15 19H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 3L6 7L10 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M17 7H9C5.68629 7 3 9.68629 3 13C3 16.3137 5.68629 19 9 19H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3L18 7L14 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

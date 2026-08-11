import React from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';

// Bottom-left "war room" toolbar: draw a red movement arrow by
// clicking and dragging from one controlled hex to another (it snaps
// to whichever hex you release on — see HexMapCanvas's drag handlers),
// or erase existing ones. The mode itself lives in the reducer since
// HexMapCanvas needs it to intercept ordinary hex interaction while a
// tool is active — same reason `selected` and `activeColor` already
// live there instead of as local component state. It also disables
// map panning for as long as a tool is active, so dragging out an
// arrow doesn't drag the map instead — see useZoomPan's `disabled`.
export default function MovementControls() {
  const state = useMapState();
  const actions = useMapActions();

  const drawActive = state.movementMode === 'draw';
  const eraseActive = state.movementMode === 'erase';

  const btnStyle = (active, accent) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: active ? 'rgba(214,57,47,0.12)' : 'var(--panel-raised)',
    border: `1px solid ${active ? accent : 'var(--steel-line)'}`,
    color: active ? accent : 'var(--bone-dim)',
    padding: '7px 10px',
    fontSize: 10.5,
  });

  const lineCount = state.movementLines.length;
  const contestCount = state.pendingContests.length;

  let hint = null;
  if (drawActive) {
    hint = 'Click and drag from a hex your faction controls to another hex, then release to draw the line.';
  } else if (eraseActive) {
    hint = 'Click a line, or either of its two hexes, to remove it.';
  } else if (contestCount > 0) {
    hint = `${contestCount} sector${contestCount === 1 ? '' : 's'} contested — resolve the popup to finish claiming.`;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
      }}
    >
      {hint && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: 'var(--bone-dim)',
            background: 'rgba(12,13,14,0.85)',
            border: '1px solid var(--steel-line)',
            borderRadius: 3,
            padding: '5px 8px',
            maxWidth: 220,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn-ghost"
          style={btnStyle(drawActive, 'var(--blood-bright)')}
          onClick={() => actions.setMovementMode('draw')}
          title="Click and drag from a controlled hex to another hex to draw a movement line"
        >
          <ArrowIcon color={drawActive ? 'var(--blood-bright)' : 'var(--bone-dim)'} />
          Movement Line
        </button>
        <button
          className="btn-ghost"
          style={btnStyle(eraseActive, 'var(--gold)')}
          onClick={() => actions.setMovementMode('erase')}
          title="Erase movement lines"
        >
          <EraserIcon color={eraseActive ? 'var(--gold)' : 'var(--bone-dim)'} />
          Eraser
        </button>
        <button
          className="btn-ghost"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(127,191,127,0.12)',
            border: '1px solid #7fbf7f',
            color: '#7fbf7f',
            padding: '7px 10px',
            fontSize: 10.5,
            opacity: lineCount === 0 ? 0.45 : 1,
            cursor: lineCount === 0 ? 'default' : 'pointer',
          }}
          onClick={() => lineCount > 0 && actions.initializeMovement()}
          title="Resolve every drawn arrow: uncontested hexes are claimed immediately, contested ones prompt for a winner"
        >
          <FlagIcon color="#7fbf7f" />
          Claim Sector
          {lineCount > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.8 }}>({lineCount})</span>
          )}
        </button>
      </div>
    </div>
  );
}

function ArrowIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <line x1="4" y1="20" x2="18" y2="6" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 5 L19 5 L19 14" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function FlagIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <line x1="5" y1="3" x2="5" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 4 L19 7 L5 12 Z" fill={color} />
    </svg>
  );
}

function EraserIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="12" width="13" height="8" rx="1.5" transform="rotate(-40 3 12)" stroke={color} strokeWidth="2" />
      <line x1="9" y1="20" x2="21" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

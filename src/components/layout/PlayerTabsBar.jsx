import React, { useMemo } from 'react';
import { useMapState } from '../../state/MapContext.jsx';
import { buildPlayerSummaries } from '../../utils/players.js';
import PlayerTab from './PlayerTab.jsx';

// A tab per player, only rendered once at least one faction/colour in
// the Legend Key has an Owner assigned (see ColorPanel.jsx). Renders
// nothing at all otherwise — no empty bar taking up space.
export default function PlayerTabsBar() {
  const state = useMapState();
  const players = useMemo(() => buildPlayerSummaries(state), [state]);

  if (players.length === 0) return null;

  const selectedKeys = Object.keys(state.selected);
  const selectedHexKey = selectedKeys.length === 1 ? selectedKeys[0] : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 22px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--steel-line)',
        flexWrap: 'wrap',
        zIndex: 4,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: 1.5,
          color: 'var(--bone-dim)',
          textTransform: 'uppercase',
          marginRight: 4,
        }}
      >
        Commanders:
      </span>
      {players.map((p) => (
        <PlayerTab key={p.name} player={p} selectedHexKey={selectedHexKey} />
      ))}
    </div>
  );
}

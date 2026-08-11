import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMapState } from '../../state/MapContext.jsx';
import { buildPlayerSummaries } from '../../utils/players.js';
import PlayerTab from './PlayerTab.jsx';

// A tab per player, only rendered once at least one faction/colour in
// the Legend Key has an Owner assigned (see ColorPanel.jsx). Renders
// nothing at all otherwise — no empty bar taking up space.
//
// Only one player's dropdown is open at a time (state lives here, not
// per-tab), and it's always anchored to the left edge of this bar
// rather than to whichever button opened it — otherwise a commander
// further along the row would pop its card out over the map as more
// players get added. See PlayerTab's dropdown positioning.
export default function PlayerTabsBar() {
  const state = useMapState();
  const players = useMemo(() => buildPlayerSummaries(state), [state]);
  const [openName, setOpenName] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!openName) return undefined;
    const onClickAway = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenName(null);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [openName]);

  if (players.length === 0) return null;

  const selectedKeys = Object.keys(state.selected);
  const selectedHexKey = selectedKeys.length === 1 ? selectedKeys[0] : null;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
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
        <PlayerTab
          key={p.name}
          player={p}
          selectedHexKey={selectedHexKey}
          isOpen={openName === p.name}
          onToggle={() => setOpenName((cur) => (cur === p.name ? null : p.name))}
          onRelevant={() => setOpenName(p.name)}
        />
      ))}
    </div>
  );
}

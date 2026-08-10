import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { iconById } from '../../data/legionIcons.js';
import { rewardIconById } from '../../data/rewardIcons.js';

// One "commander tab" button + its dropdown detail card. Self-contained
// open/close state and click-away handling, same pattern as
// DropdownMenu.jsx, but the content here is a data readout rather than
// a list of actions.
//
// Cross-highlighting with the map: `selectedHexKey` comes from the
// single currently-selected hex (see PlayerTabsBar). If it matches one
// of this player's reward hexes, the tab glows, auto-opens, and the
// matching row is highlighted. Clicking a reward row does the reverse —
// it selects that hex, which highlights it on the map via HexTile's
// existing selection outline and opens HexInfoPopup there.
export default function PlayerTab({ player, selectedHexKey }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const actions = useMapActions();
  const { rewardTypeById } = useMapSelectors();

  const rewardHexKeys = useMemo(() => {
    const s = new Set();
    player.bankedRewards.forEach((r) => s.add(r.hexKey));
    player.defendedRewards.forEach((r) => s.add(r.hexKey));
    return s;
  }, [player]);

  const isRelevant = !!(selectedHexKey && rewardHexKeys.has(selectedHexKey));

  useEffect(() => {
    if (isRelevant) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHexKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  const swatchColor = player.factions[0] ? player.factions[0].color : '#7a1e1e';
  const armyEntries = Object.entries(player.armyCounts);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        className="btn-ghost"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          borderColor: open || isRelevant ? 'var(--gold-dim)' : undefined,
          color: open || isRelevant ? 'var(--bone)' : undefined,
          boxShadow: isRelevant ? '0 0 0 1px var(--gold)' : undefined,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: swatchColor,
            border: '1px solid rgba(0,0,0,0.4)',
            flexShrink: 0,
          }}
        />
        {player.name}
        <span style={{ opacity: 0.6, fontSize: 9 }}>&#9662;</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            width: 310,
            background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
            border: '1px solid var(--steel-line)',
            borderTop: '2px solid var(--gold)',
            borderRadius: 3,
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
            zIndex: 30,
            padding: 14,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <div className="panel-title" style={{ marginBottom: 10 }}>{player.name}</div>

          <Row label="Faction(s)">
            {player.factions.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: f.color, border: '1px solid rgba(0,0,0,0.4)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)' }}>{f.name}</span>
              </div>
            ))}
          </Row>

          <Row label="Points">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)' }}>{player.totalPoints}</span>
          </Row>

          <Row label="Sectors Controlled">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)' }}>
              {player.sectorCount} total &middot; {player.connectedCount} connected
              {player.disconnectedCount > 0 && (
                <span style={{ color: 'var(--blood-bright)' }}> &middot; {player.disconnectedCount} cut off</span>
              )}
            </span>
          </Row>

          <Row label="Army">
            {armyEntries.length === 0 && <Empty text="No units placed." />}
            {armyEntries.map(([iconId, count]) => {
              const def = iconById(iconId);
              if (!def) return null;
              return (
                <div key={iconId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <img src={def.url} alt={def.label} style={{ width: 14, height: 14, flexShrink: 0, filter: 'invert(1)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--bone)' }}>{def.label} &times;{count}</span>
                </div>
              );
            })}
          </Row>

          <Row label="Rewards Banked" last={player.defendedRewards.length === 0}>
            {player.bankedRewards.length === 0 && <Empty text="No rewards banked." />}
            {player.bankedRewards.map((item) => (
              <RewardRow
                key={item.hexKey}
                item={item}
                rewardTypeById={rewardTypeById}
                highlighted={item.hexKey === selectedHexKey}
                onSelect={() => actions.selectHex(item.hexKey, false)}
              />
            ))}
          </Row>

          {player.defendedRewards.length > 0 && (
            <Row label="Defending (Not Yet Banked)" last>
              {player.defendedRewards.map((item) => (
                <RewardRow
                  key={item.hexKey}
                  item={item}
                  rewardTypeById={rewardTypeById}
                  highlighted={item.hexKey === selectedHexKey}
                  onSelect={() => actions.selectHex(item.hexKey, false)}
                  dim
                />
              ))}
              <div className="hint-text" style={{ margin: '4px 0 0' }}>
                Still under their own defence &mdash; must be captured by another player to be banked.
              </div>
            </Row>
          )}
        </div>
      )}
    </div>
  );
}

function RewardRow({ item, rewardTypeById, highlighted, onSelect, dim }) {
  const rt = rewardTypeById(item.rewardTypeId);
  const iconDef = rt ? rewardIconById(rt.iconId) : null;
  const [c, r] = item.hexKey.split(',');

  return (
    <div
      onClick={onSelect}
      title="Click to highlight this hex on the map"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '5px 6px',
        marginBottom: 4,
        borderRadius: 3,
        cursor: 'pointer',
        background: highlighted ? 'rgba(184,150,62,0.16)' : 'transparent',
        border: highlighted ? '1px solid var(--gold)' : '1px solid transparent',
      }}
    >
      {iconDef && (
        <svg
          width={12}
          height={12}
          viewBox="0 0 512 512"
          style={{ fill: dim ? 'var(--bone-dim)' : 'var(--gold)', flexShrink: 0, marginTop: 1 }}
          dangerouslySetInnerHTML={{ __html: iconDef.markup }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: dim ? 'var(--bone-dim)' : 'var(--bone)' }}>
            {rt ? rt.name : 'Unknown'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold-dim)' }}>@ {c},{r}</span>
        </div>
        {item.benefit && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--bone-dim)', marginTop: 2, lineHeight: 1.4 }}>
            {item.benefit}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 12, paddingBottom: last ? 0 : 10, borderBottom: last ? 'none' : '1px solid var(--steel-line)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: 1.5, color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div className="hint-text" style={{ margin: 0 }}>{text}</div>;
}

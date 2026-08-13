import React, { useEffect, useMemo, useState } from 'react';
import { useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { iconById } from '../../data/legionIcons.js';
import { rewardIconById } from '../../data/rewardIcons.js';

// One "commander tab" button. Open/close state and click-away handling
// live in the parent PlayerTabsBar (only one dropdown open at a time),
// so this component just renders the button and, when told to, the
// dropdown card itself.
//
// The dropdown is deliberately NOT positioned relative to this button —
// see the `left: 16` below, which resolves against PlayerTabsBar's own
// (relatively-positioned) container instead. That keeps every player's
// card anchored to the same spot on the left (inset by 16px, the same
// edge margin HexInfoPopup uses, so it isn't flush against the screen
// edge) regardless of how far right their tab sits in the row, so
// adding more players never pushes a card further out over the map.
//
// Cross-highlighting with the map: `selectedHexKey` comes from the
// single currently-selected hex (see PlayerTabsBar). If it matches one
// of this player's reward hexes, the tab glows, auto-opens (via
// onRelevant), and the matching row is highlighted. Clicking a reward
// row does the reverse — it selects that hex, which highlights it on
// the map via HexTile's existing selection outline and opens
// HexInfoPopup there.
export default function PlayerTab({ player, selectedHexKey, isOpen, onToggle, onRelevant }) {
  const actions = useMapActions();
  const { rewardTypeById } = useMapSelectors();

  // Which Manual Reward row (by index) is currently editable, if any —
  // only one at a time. Everything else in that list renders locked
  // (plain text) until its own edit button is clicked. Purely local UI
  // state, not persisted — a fresh "+ Add Reward" always starts in
  // edit mode since it's blank.
  const [editingRewardIndex, setEditingRewardIndex] = useState(null);

  const rewardHexKeys = useMemo(() => {
    const s = new Set();
    player.bankedRewards.forEach((r) => s.add(r.hexKey));
    player.defendedRewards.forEach((r) => s.add(r.hexKey));
    player.questAwards.forEach((r) => s.add(r.hexKey));
    player.questPenalties.forEach((r) => s.add(r.hexKey));
    return s;
  }, [player]);

  const isRelevant = !!(selectedHexKey && rewardHexKeys.has(selectedHexKey));

  useEffect(() => {
    if (isRelevant) onRelevant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHexKey]);

  const swatchColor = player.factions[0] ? player.factions[0].color : '#7a1e1e';
  const armyEntries = Object.entries(player.armyCounts);

  // Manual Rewards (below) is always rendered, so it's always the true
  // last section now — nothing above it needs `last` treatment anymore.

  return (
    <div>
      <button
        className="btn-ghost"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          borderColor: isOpen || isRelevant ? 'var(--gold-dim)' : undefined,
          color: isOpen || isRelevant ? 'var(--bone)' : undefined,
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
        {player.team && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--gold)',
              border: '1px solid var(--gold-dim)',
              borderRadius: 2,
              padding: '1px 4px',
              lineHeight: 1.4,
            }}
          >
            T{player.team}
          </span>
        )}
        <span style={{ opacity: 0.6, fontSize: 9 }}>&#9662;</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            marginTop: 16,
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

          <Row label="Team">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: player.team ? 'var(--gold)' : 'var(--bone-dim)' }}>
              {player.team ? `Team ${player.team}` : 'Unassigned'}
            </span>
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

          <Row label="Rewards Banked">
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
            <Row label="Defending (Not Yet Banked)">
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

          {/* Quest awards — copied over automatically the moment the GM
              marks a quest on one of this player's hexes Addressed. See
              QuestPanel / HexInfoPopup for where those get written. */}
          {player.questAwards.length > 0 && (
            <Row label="Quest Awards">
              {player.questAwards.map((item) => (
                <QuestRow
                  key={item.hexKey}
                  item={item}
                  highlighted={item.hexKey === selectedHexKey}
                  onSelect={() => actions.selectHex(item.hexKey, false)}
                />
              ))}
            </Row>
          )}

          {player.questPenalties.length > 0 && (
            <Row label="Quest Penalties">
              {player.questPenalties.map((item) => (
                <QuestRow
                  key={item.hexKey}
                  item={item}
                  highlighted={item.hexKey === selectedHexKey}
                  onSelect={() => actions.selectHex(item.hexKey, false)}
                  dim
                />
              ))}
            </Row>
          )}

          {/* Hand-typed by the GM right here, independent of the Reward
              System and Quest Markers entirely — for one-off grants
              that don't fit either of those flows. */}
          <Row label="Manual Rewards (GM)" last>
            {player.manualRewards.length === 0 && <Empty text="None granted yet." />}
            {player.manualRewards.map((reward, i) => (
              <ManualRewardRow
                key={i}
                reward={reward}
                editing={editingRewardIndex === i}
                onStartEdit={() => setEditingRewardIndex(i)}
                onChange={(text) => actions.updateManualPlayerReward(player.name, i, text)}
                onFinalize={() => setEditingRewardIndex(null)}
                onRemove={() => {
                  actions.removeManualPlayerReward(player.name, i);
                  setEditingRewardIndex(null);
                }}
              />
            ))}
            <button
              className="btn-ghost"
              onClick={() => {
                setEditingRewardIndex(player.manualRewards.length);
                actions.addManualPlayerReward(player.name);
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Add Reward
            </button>
          </Row>
        </div>
      )}
    </div>
  );
}

// One Manual Reward entry — locked (plain text + a recoloured "−" that
// opens it back up for editing) until its own edit button is clicked,
// or editable (a live input + a red "×" that removes it outright).
// Only Enter finalizes/locks it back up — deliberately *not* on blur:
// clicking the "×" blurs the input a beat before its own click lands,
// and finalizing on that blur swaps the "×" out for the locked row's
// "−" out from under the click before it registers, so the remove
// never actually fires. Enter-only sidesteps that race entirely.
function ManualRewardRow({ reward, editing, onStartEdit, onChange, onFinalize, onRemove }) {
  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input
          type="text"
          autoFocus
          value={reward}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            onFinalize();
          }}
          placeholder="e.g. 50 Requisition Points, Rare Relic..."
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          onClick={onRemove}
          title="Remove this reward"
          style={{
            width: 18,
            height: 18,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--blood-bright)',
            color: 'var(--blood-bright)',
            fontSize: 12,
            lineHeight: 1,
            padding: 0,
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '5px 2px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: reward ? 'var(--gold)' : 'var(--bone-dim)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {reward || '(empty)'}
      </div>
      <button
        onClick={onStartEdit}
        title="Edit this reward"
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid var(--gold-dim)',
          color: 'var(--gold-dim)',
          fontSize: 13,
          lineHeight: 1,
          padding: 0,
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        &minus;
      </button>
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

function QuestRow({ item, highlighted, onSelect, dim }) {
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
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: item.color,
          border: '1px solid rgba(0,0,0,0.4)',
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold-dim)' }}>@ {c},{r}</span>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: dim ? 'var(--bone-dim)' : 'var(--bone)', marginTop: 2, lineHeight: 1.4 }}>
          {item.text}
        </div>
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

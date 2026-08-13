import React from 'react';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { REWARD_ICONS, rewardIconById } from '../../data/rewardIcons.js';
import { DEFAULT_QUEST_COLOR, HEX_EFFECTS } from '../../state/mapReducer.js';

const textAreaStyle = {
  width: '100%',
  resize: 'vertical',
  background: '#0f1112',
  border: '1px solid var(--steel-line)',
  color: 'var(--bone)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  padding: '6px 8px',
  borderRadius: 2,
};

// Shown whenever exactly one hex is selected — a read/edit card for
// that tile's mission-relevant info (points, objective, controller,
// reward). Deliberately hidden for multi-select; ReadoutPanel already
// covers the "N hexes selected" summary case in the sidebar.
export default function HexInfoPopup() {
  const state = useMapState();
  const actions = useMapActions();
  const { rewardTypeById, paletteEntryForHex, resolveHexColor, isDisconnected } = useMapSelectors();

  const selectedKeys = Object.keys(state.selected);
  if (selectedKeys.length !== 1) return null;

  const k = selectedKeys[0];
  const [c, r] = k.split(',');
  const entry = state.hexData[k] || {};
  const meta = entry.meta || {};

  const controller = paletteEntryForHex(entry);
  const resolvedColor = resolveHexColor(entry);
  const tracked = !!(controller && controller.owner && controller.homeIconId);
  const cutOff = tracked && isDisconnected(k);

  const defender = meta.objectiveOwner || null;
  const controllerOwner = controller && controller.owner ? controller.owner : null;
  const stillDefended = !!(entry.reward && defender && defender === controllerOwner);
  const rewardType = entry.reward ? rewardTypeById(entry.reward) : null;
  const rewardIcon = rewardType ? rewardIconById(rewardType.iconId) : null;

  const setMeta = (changes) => actions.updateHexMeta(k, changes);

  // Every known player, for the quest's "Assign To Player" override —
  // same source ColorPanel's Teams section and RewardPanel use. This
  // popup only ever mounts once a single hex is selected, so there's
  // no early-return-before-a-hook concern; a plain computation (rather
  // than useMemo) keeps it that way and avoids the palette array being
  // small enough that memoising it buys nothing anyway.
  const playerNameSet = new Set();
  state.palette.forEach((p) => {
    if (p.owner && p.owner.trim()) playerNameSet.add(p.owner.trim());
  });
  const playerNames = [...playerNameSet].sort();

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 260,
        background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
        border: '1px solid var(--steel-line)',
        borderTop: '2px solid var(--gold)',
        borderRadius: 3,
        boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--steel-line)',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              letterSpacing: 1.5,
              color: 'var(--gold)',
              textTransform: 'uppercase',
            }}
          >
            {meta.missionName ? meta.missionName : `Hex ${c},${r}`}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--bone-dim)' }}>
            GRID REF: COL {c} / ROW {r}
          </div>
        </div>
        <button
          className="btn-ghost"
          onClick={() => actions.clearSelection()}
          title="Close"
          style={{ padding: '3px 8px', fontSize: 11, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Controller */}
        <div className="field">
          <label>Controlled By</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.4)',
                background: resolvedColor || '#202325',
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--bone)' }}>
              {controller ? controller.name : 'Unclaimed'}
            </span>
          </div>
          {controller && controller.owner && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bone-dim)', marginTop: 2 }}>
              Player: {controller.owner}
            </div>
          )}
        </div>

        {/* Supply line */}
        {tracked && (
          <div className="field">
            <label>Supply Line</label>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: cutOff ? 'var(--blood-bright)' : 'var(--gold)',
              }}
            >
              {cutOff ? 'Disconnected' : 'Connected'}
            </span>
          </div>
        )}

        {/* Points */}
        <div className="field">
          <label>Points</label>
          <input
            type="number"
            value={meta.points ?? ''}
            onChange={(e) => setMeta({ points: e.target.value })}
            placeholder="0"
            style={{ width: '100%' }}
          />
        </div>

        {/* Mission objective */}
        <div className="field">
          <label>Mission Objective</label>
          <textarea
            value={meta.missionObjective ?? ''}
            onChange={(e) => setMeta({ missionObjective: e.target.value })}
            placeholder="No objective set."
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              background: '#0f1112',
              border: '1px solid var(--steel-line)',
              color: 'var(--bone)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              padding: '6px 8px',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Reward */}
        <div className="field">
          <label>Reward</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rewardIcon && (
              <svg
                width={16}
                height={16}
                viewBox="0 0 512 512"
                style={{ flexShrink: 0, fill: 'var(--gold)' }}
                dangerouslySetInnerHTML={{ __html: rewardIcon.markup }}
              />
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--bone)' }}>
              {rewardType ? rewardType.name : 'None'}
            </span>
          </div>
          {rewardType && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                marginTop: 3,
                color: stillDefended ? 'var(--bone-dim)' : 'var(--gold)',
              }}
            >
              {stillDefended ? `Defended by ${defender} — not banked` : defender ? `Captured from ${defender} — banked` : 'Banked'}
            </div>
          )}
          {defender && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: rewardType ? 1 : 3, color: 'var(--bone-dim)' }}>
              Original defender: {defender}
            </div>
          )}
        </div>

        {/* Reward benefit — GM's free text on what holding this reward
            actually grants. Shown in the player tab too once banked. */}
        {rewardType && (
          <div className="field">
            <label>Benefit / Bonus (GM)</label>
            <textarea
              value={meta.rewardBenefit ?? ''}
              onChange={(e) => setMeta({ rewardBenefit: e.target.value })}
              placeholder="What does holding this reward grant?"
              rows={2}
              style={textAreaStyle}
            />
          </div>
        )}

        {/* Purely-visual per-hex effect (HEX_EFFECTS) — no game
            meaning, just a look the GM can put on a hex. */}
        <div className="field">
          <label>Battle Effect</label>
          <select
            value={entry.hexEffect || ''}
            onChange={(e) => actions.setHexEffect(e.target.value || null)}
            style={{ width: '100%' }}
          >
            <option value="">None</option>
            {HEX_EFFECTS.map((fx) => (
              <option key={fx.id} value={fx.id}>{fx.label}</option>
            ))}
          </select>
        </div>

        {/* Quest marker — a GM-placed event hex. Pulses gold (or a
            custom colour) on the map until resolved: Addressed banks
            the award, Missed applies the penalty either to this
            player alone or logged as a Campaign Effect map-wide. */}
        <div className="field">
          <label>Quest Marker</label>
          {!entry.quest && (
            <button className="btn-ghost" style={{ width: '100%' }} onClick={() => actions.placeQuestMarker(DEFAULT_QUEST_COLOR)}>
              Place Exclamation Marker
            </button>
          )}

          {entry.quest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={entry.quest.color}
                  onChange={(e) => actions.updateHexQuest(k, { color: e.target.value })}
                  style={{ width: 28, height: 24, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    textTransform: 'uppercase',
                    color:
                      entry.quest.status === 'active'
                        ? 'var(--gold)'
                        : entry.quest.status === 'addressed'
                        ? '#7fbf7f'
                        : 'var(--blood-bright)',
                  }}
                >
                  {entry.quest.status}
                </span>
              </div>

              <div className="field" style={{ gap: 4 }}>
                <label style={{ fontSize: 9 }}>Icon</label>
                <select
                  value={entry.quest.iconId || ''}
                  onChange={(e) => actions.updateHexQuest(k, { iconId: e.target.value || null })}
                  style={{ width: '100%' }}
                >
                  <option value="">Exclamation Mark (default)</option>
                  <option value="none">None</option>
                  {REWARD_ICONS.map((ic) => (
                    <option key={ic.id} value={ic.id}>{ic.label}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ gap: 4 }}>
                <label style={{ fontSize: 9 }}>Assign To Player</label>
                <select
                  value={entry.quest.targetPlayer || ''}
                  onChange={(e) => actions.updateHexQuest(k, { targetPlayer: e.target.value || null })}
                  style={{ width: '100%' }}
                >
                  <option value="">Auto (whoever controls this hex)</option>
                  {playerNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {!entry.quest.targetPlayer && !controllerOwner && (
                  <div className="hint-text" style={{ margin: 0, color: 'var(--blood-bright)' }}>
                    This hex has no controller — pick a player above or the award/penalty won't reach anyone.
                  </div>
                )}
              </div>

              <div className="field" style={{ gap: 4 }}>
                <label style={{ fontSize: 9 }}>Award (on Addressed)</label>
                <textarea
                  value={entry.quest.awardText}
                  onChange={(e) => actions.updateHexQuest(k, { awardText: e.target.value })}
                  placeholder="What does the player gain?"
                  rows={2}
                  style={textAreaStyle}
                />
              </div>

              <div className="field" style={{ gap: 4 }}>
                <label style={{ fontSize: 9 }}>Penalty (on Missed)</label>
                <textarea
                  value={entry.quest.penaltyText}
                  onChange={(e) => actions.updateHexQuest(k, { penaltyText: e.target.value })}
                  placeholder="What happens if it's ignored?"
                  rows={2}
                  style={textAreaStyle}
                />
              </div>

              <div className="field" style={{ gap: 4 }}>
                <label style={{ fontSize: 9 }}>Penalty Applies To</label>
                <select
                  value={entry.quest.penaltyScope}
                  onChange={(e) => actions.updateHexQuest(k, { penaltyScope: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="player">This player (the one assigned above)</option>
                  <option value="campaign">Whole campaign</option>
                </select>
              </div>

              {entry.quest.status === 'active' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => actions.resolveQuest(k, 'addressed')}
                    style={{ flex: 1, background: 'transparent', border: '1px solid #7fbf7f', color: '#7fbf7f', fontFamily: 'var(--font-label)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 4px', borderRadius: 2, cursor: 'pointer' }}
                  >
                    Mark Addressed
                  </button>
                  <button
                    onClick={() => actions.resolveQuest(k, 'missed')}
                    style={{ flex: 1, background: 'transparent', border: '1px solid var(--blood-bright)', color: 'var(--blood-bright)', fontFamily: 'var(--font-label)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 4px', borderRadius: 2, cursor: 'pointer' }}
                  >
                    Mark Missed
                  </button>
                </div>
              ) : (
                <div className="hint-text" style={{ margin: 0 }}>
                  Resolved as <b style={{ color: 'var(--bone)' }}>{entry.quest.status}</b>. Clear it to place a fresh marker here.
                </div>
              )}

              <button className="btn-clear" style={{ marginTop: 0 }} onClick={() => actions.clearQuestMarker()}>
                Remove Quest Marker
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

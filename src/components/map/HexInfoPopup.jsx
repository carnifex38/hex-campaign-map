import React from 'react';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { rewardIconById } from '../../data/rewardIcons.js';

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
        )}
      </div>
    </div>
  );
}

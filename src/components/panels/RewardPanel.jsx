import React, { useMemo, useState } from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';
import { REWARD_ICONS, rewardIconById } from '../../data/rewardIcons.js';

export default function RewardPanel() {
  const state = useMapState();
  const actions = useMapActions();
  const [message, setMessage] = useState(null);

  const selectedKeys = Object.keys(state.selected);
  const hasSelection = selectedKeys.length > 0;

  const ownerNames = useMemo(() => {
    const names = new Set();
    state.palette.forEach((p) => {
      if (p.owner && p.owner.trim()) names.add(p.owner.trim());
    });
    return [...names].sort();
  }, [state.palette]);

  const defenderValues = selectedKeys.map(
    (k) => (state.hexData[k] && state.hexData[k].meta && state.hexData[k].meta.objectiveOwner) || ''
  );
  const uniformDefender =
    defenderValues.length > 0 && defenderValues.every((v) => v === defenderValues[0]) ? defenderValues[0] : '';

  const handleRandomize = () => {
    const result = actions.randomizeRewards();
    if (!result.ok) {
      const reasons = {
        'no-selection': 'Select an area of hexes first, then click Randomise Rewards.',
        'no-active-types': 'No reward types are enabled with a "Max in area" above 0.',
        'no-eligible-hexes': 'Every selected hex already has a reward. Clear rewards first if you want to re-roll.',
      };
      setMessage(reasons[result.reason] || 'Randomisation could not run.');
    } else {
      setMessage(`Placed ${result.placed} reward${result.placed === 1 ? '' : 's'}.`);
    }
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div style={{ padding: 18 }}>
      <div className="panel-title">Reward System</div>
      <div className="hint-text">
        Each reward's checkbox controls whether it's included when you randomise. Select hex(es), then click a
        reward's "Place on Selected" button to stamp it manually. Only one reward per hex.
      </div>

      {state.rewardTypes.map((rt) => (
        <RewardTypeCard key={rt.id} rt={rt} />
      ))}

      <div className="section">
        <div className="panel-title">Game Setup &mdash; Objective Defender</div>
        <div className="hint-text" style={{ marginTop: -4 }}>
          Assign who starts out occupying and defending this objective. The
          defender doesn't bank the reward just by holding their own
          tile &mdash; only a different player who attacks and captures it
          (repaints it their colour) does.
        </div>
        {!hasSelection && (
          <div className="hint-text" style={{ margin: 0 }}>Select the objective hex(es) first.</div>
        )}
        {hasSelection && (
          <>
            {ownerNames.length === 0 ? (
              <div className="hint-text" style={{ margin: 0 }}>
                No players yet &mdash; assign an Owner to a faction in the Territory tab's Legend Key first.
              </div>
            ) : (
              <select
                value={uniformDefender}
                onChange={(e) => actions.setObjectiveOwner(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">No assigned defender</option>
                {ownerNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      <div className="section">
        <div className="panel-title">Display</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.showCapturedRewardOutlines}
            onChange={(e) => actions.setShowCapturedRewardOutlines(e.target.checked)}
            style={{ flexShrink: 0, accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
          />
          <span className="hint-text" style={{ margin: 0 }}>
            Show the defender-coloured outline on captured rewards
          </span>
        </label>
      </div>

      <button
        style={{ marginTop: 4, width: '100%', background: 'transparent', border: '1px dashed var(--steel-line)', color: 'var(--gold-dim)', padding: 7, fontSize: 11 }}
        onClick={() => actions.addRewardType(REWARD_ICONS[0].id)}
      >
        + Add Reward Type
      </button>

      {message && (
        <div style={{ marginTop: 12, padding: 8, background: '#0f1112', border: '1px solid var(--gold-dim)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)' }}>
          {message}
        </div>
      )}

      <button className="btn-clear" style={{ marginTop: 14 }} onClick={handleRandomize}>
        Randomise Rewards (Selected Area)
      </button>
      <button className="btn-clear" onClick={actions.clearRewards}>Clear Rewards (Selection)</button>
      <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={actions.resetAllRewards}>
        Clear All Rewards (Map)
      </button>
    </div>
  );
}

function RewardTypeCard({ rt }) {
  const state = useMapState();
  const actions = useMapActions();
  const def = rewardIconById(rt.iconId) || REWARD_ICONS[0];

  const cycleIcon = () => {
    const idx = REWARD_ICONS.findIndex((ic) => ic.id === rt.iconId);
    const next = REWARD_ICONS[(idx + 1) % REWARD_ICONS.length];
    actions.updateRewardType(rt.id, { iconId: next.id });
  };

  const handlePlace = () => {
    if (Object.keys(state.selected).length === 0) {
      alert('Select one or more hexes first, then click Place on Selected.');
      return;
    }
    actions.placeReward(rt.id);
  };

  return (
    <div style={{ background: '#0f1112', border: '1px solid var(--steel-line)', borderRadius: 4, padding: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={rt.enabled !== false}
          onChange={(e) => actions.updateRewardType(rt.id, { enabled: e.target.checked })}
          title="Include this reward in randomisation"
          style={{ flexShrink: 0, accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
        />
        <div
          onClick={cycleIcon}
          title="Click to change icon"
          style={{ width: 26, height: 26, flexShrink: 0, background: '#17191b', border: '1px solid var(--steel-line)', borderRadius: 3, padding: 3, cursor: 'pointer' }}
        >
          <svg viewBox="0 0 512 512" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.9))' }} dangerouslySetInnerHTML={{ __html: def.markup }} />
        </div>
        <input
          type="text"
          value={rt.name}
          onChange={(e) => actions.updateRewardType(rt.id, { name: e.target.value })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          onClick={() => actions.removeRewardType(rt.id)}
          title="Remove reward type"
          style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--steel-line)', color: 'var(--bone-dim)', fontSize: 11, padding: 0, borderRadius: 2, cursor: 'pointer' }}
        >
          &times;
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--bone-dim)' }}>
          Max in area:
        </label>
        <input
          type="number"
          min="0"
          value={rt.frequency}
          onChange={(e) => actions.updateRewardType(rt.id, { frequency: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          style={{ width: 52 }}
        />
        <button
          onClick={handlePlace}
          title="Stamp this reward onto every currently selected hex"
          style={{ flex: 1, background: 'transparent', border: '1px solid var(--gold-dim)', color: 'var(--gold-dim)', fontFamily: 'var(--font-label)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 4px', borderRadius: 2, cursor: 'pointer' }}
        >
          Place on Selected
        </button>
      </div>
    </div>
  );
}

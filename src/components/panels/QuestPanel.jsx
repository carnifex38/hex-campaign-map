import React, { useState } from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';
import { DEFAULT_QUEST_COLOR } from '../../state/mapReducer.js';

// Bulk quest-marker tools (place/clear on the current selection) plus
// the Campaign Effects log. Per-hex editing (colour, award/penalty
// text, resolving Addressed/Missed) lives in HexInfoPopup once a
// single hex with a marker is selected — this panel is for stamping
// markers onto the map and managing the campaign-wide side of things.
export default function QuestPanel() {
  const state = useMapState();
  const actions = useMapActions();
  const [color, setColor] = useState(DEFAULT_QUEST_COLOR);
  const [effectText, setEffectText] = useState('');
  const hasSelection = Object.keys(state.selected).length > 0;

  const handleAddEffect = () => {
    if (!effectText.trim()) return;
    actions.addCampaignEffect(effectText);
    setEffectText('');
  };

  return (
    <div style={{ padding: 18 }}>
      <div className="panel-title">Quest Markers</div>
      <div className="hint-text" style={{ marginTop: -4 }}>
        Stamp a pulsing exclamation-point marker onto any hex to flag a
        live event. Select the hex(es) it applies to, pick a colour
        (gold by default), then place it. Open a single marked hex to
        write its award/penalty and resolve it as Addressed or Missed.
      </div>

      {!hasSelection && (
        <div className="hint-text" style={{ margin: 0 }}>Select a hex (or several) first.</div>
      )}

      {hasSelection && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bone-dim)', textTransform: 'uppercase' }}>Colour</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 36, height: 30, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
            />
          </div>

          <button className="btn-primary" style={{ width: '100%' }} onClick={() => actions.placeQuestMarker(color)}>
            Place Exclamation Marker (Selected)
          </button>
          <button className="btn-clear" onClick={actions.clearQuestMarker}>Clear Quest Marker (Selection)</button>
        </>
      )}

      <div className="section">
        <div className="panel-title">Campaign Effects</div>
        <div className="hint-text" style={{ marginTop: -4 }}>
          Map-wide modifiers the GM is tracking — added by hand, or
          automatically when a quest marker scoped to "Whole campaign"
          is marked Missed.
        </div>

        {state.campaignEffects.length === 0 && (
          <div className="hint-text" style={{ margin: 0 }}>No active campaign effects.</div>
        )}
        {state.campaignEffects.map((effect) => (
          <div
            key={effect.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              background: '#0f1112',
              border: '1px solid var(--steel-line)',
              borderRadius: 3,
              padding: '7px 8px',
              marginBottom: 6,
            }}
          >
            <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--bone)', lineHeight: 1.4 }}>
              {effect.text}
            </span>
            <button
              onClick={() => actions.removeCampaignEffect(effect.id)}
              title="Remove effect"
              style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--steel-line)', color: 'var(--bone-dim)', fontSize: 11, padding: 0, borderRadius: 2, cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            type="text"
            placeholder="New campaign effect..."
            value={effectText}
            onChange={(e) => setEffectText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEffect()}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button className="btn-ghost" onClick={handleAddEffect}>Add</button>
        </div>
      </div>
    </div>
  );
}

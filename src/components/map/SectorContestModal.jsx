import React from 'react';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { normalizeColor } from '../../utils/hexMath.js';

// Pops up centred over the map whenever "Claim Sector" finds a hex
// with movement arrows from more than one distinct faction colour
// pointing at it — the GM picks who wins, and that colour is applied
// immediately. Contests are resolved one at a time (first in the
// queue); resolving or skipping this one reveals the next, if any.
export default function SectorContestModal() {
  const state = useMapState();
  const actions = useMapActions();
  const { paletteEntryForColor } = useMapSelectors();

  if (state.pendingContests.length === 0) return null;

  const contest = state.pendingContests[0];
  const [c, r] = contest.hexKey.split(',');
  const remaining = state.pendingContests.length - 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6,6,7,0.72)',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 320,
          background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
          border: '1px solid var(--steel-line)',
          borderTop: '2px solid var(--blood-bright)',
          borderRadius: 3,
          boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
          padding: 16,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            letterSpacing: 1.5,
            color: 'var(--blood-bright)',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Sector Contested
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--bone-dim)', marginBottom: 14 }}>
          Hex {c},{r} &mdash; {contest.contenders.length} factions are moving on this tile. Pick who takes it.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contest.contenders.map((contender) => {
            const entry = paletteEntryForColor(contender.color);
            const label = entry ? entry.name : contender.color.toUpperCase();
            return (
              <button
                key={normalizeColor(contender.color)}
                onClick={() => actions.resolveSectorContest(contest.hexKey, normalizeColor(contender.color))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  background: '#0f1112',
                  border: '1px solid var(--steel-line)',
                  borderRadius: 3,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--steel-line)'; }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    background: contender.color,
                    border: '1px solid rgba(0,0,0,0.5)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--bone)' }}>{label}</div>
                  {entry && entry.owner && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--bone-dim)' }}>{entry.owner}</div>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: 9.5,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                    flexShrink: 0,
                  }}
                >
                  Wins
                </span>
              </button>
            );
          })}
        </div>

        <button
          className="btn-ghost"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => actions.skipSectorContest(contest.hexKey)}
        >
          Decide Later
        </button>

        {remaining > 0 && (
          <div className="hint-text" style={{ margin: '8px 0 0', textAlign: 'center' }}>
            {remaining} more contested sector{remaining === 1 ? '' : 's'} waiting after this one.
          </div>
        )}
      </div>
    </div>
  );
}

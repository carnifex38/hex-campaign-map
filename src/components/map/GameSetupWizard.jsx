import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';
import { ALL_ICONS, iconKind } from '../../data/legionIcons.js';
import { rewardIconById } from '../../data/rewardIcons.js';

const TEAM_COUNT = 10;
const RESERVED_PALETTE_NAMES = ['Unclaimed', 'Objective', 'Impassable'];
const HOME_ICON_OPTIONS = ALL_ICONS.filter((ic) => iconKind(ic) === 'faction');

function buildDraftRows(n, palette) {
  const pool = palette.filter((p) => !RESERVED_PALETTE_NAMES.includes(p.name));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const used = new Set(rows.map((r) => r.paletteId));
    const suggestion = pool.find((p) => !used.has(p.id));
    rows.push({ name: '', paletteId: suggestion ? suggestion.id : '', homeIconId: '', team: '' });
  }
  return rows;
}

// A three-step wizard for standing up a fresh campaign in one go:
//
//   1. Players & Teams — how many players, who they are, which
//      faction (Legend Key colour) and team each one gets. Committing
//      this step writes straight into the real palette/teams state
//      (same as editing the Territory tab's Legend Key by hand), so
//      it's already reflected there the moment you move on.
//   2. Territory Placement — click a player, then click a hex to paint
//      a hex-of-hexagons blob of territory around it (size adjustable)
//      with their home-base emblem centred on it. The actual "click a
//      hex to place" interaction lives in HexMapCanvas, coordinated
//      through state.gameSetupArmedPlacement — see PLACE_TERRITORY.
//   3. Rewards — the same reward types/benefit/frequency fields the
//      Rewards tab uses (this *is* that same data), plus one button
//      that randomly seeds a defending reward into every player's
//      territory at once, skipping their home-base hex.
//
// Step 1 is a true blocking modal (no map interaction needed yet);
// steps 2-3 are a non-blocking floating panel so the map stays
// clickable underneath it. Cancel at any step restores a full
// snapshot of state taken the moment the wizard opened, discarding
// everything done in the session.
export default function GameSetupWizard() {
  const state = useMapState();
  const actions = useMapActions();

  const [step, setStep] = useState(1);
  const [draftPlayers, setDraftPlayers] = useState([]);
  const [committedPlayers, setCommittedPlayers] = useState([]);
  const [radius, setRadius] = useState(2);
  const [placedIds, setPlacedIds] = useState(new Set());
  const [giveDefender, setGiveDefender] = useState(true);
  const [rewardMessage, setRewardMessage] = useState(null);

  const snapshotRef = useRef(null);
  const prevOpenRef = useRef(false);
  const prevArmedRef = useRef(null);

  const factionPool = useMemo(
    () => state.palette.filter((p) => !RESERVED_PALETTE_NAMES.includes(p.name)),
    [state.palette]
  );

  // Fresh snapshot + reset draft state every time the wizard opens.
  useEffect(() => {
    if (state.gameSetupOpen && !prevOpenRef.current) {
      snapshotRef.current = JSON.parse(JSON.stringify(state));
      setStep(1);
      setDraftPlayers(buildDraftRows(Math.min(2, factionPool.length) || 1, state.palette));
      setCommittedPlayers([]);
      setPlacedIds(new Set());
      setRewardMessage(null);
      setGiveDefender(true);
      setRadius(2);
    }
    prevOpenRef.current = state.gameSetupOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameSetupOpen]);

  // A placement just completed in HexMapCanvas the moment the armed
  // slot goes from "someone" back to null — mark that player done.
  useEffect(() => {
    const prev = prevArmedRef.current;
    if (prev && !state.gameSetupArmedPlacement) {
      setPlacedIds((ids) => new Set([...ids, prev.paletteId]));
    }
    prevArmedRef.current = state.gameSetupArmedPlacement;
  }, [state.gameSetupArmedPlacement]);

  if (!state.gameSetupOpen) return null;

  const handleCancel = () => {
    if (snapshotRef.current) {
      actions.replaceState({ ...snapshotRef.current, gameSetupOpen: false, gameSetupArmedPlacement: null });
    } else {
      actions.closeGameSetup();
    }
  };

  // ---- Step 1 ----
  const handleCountChange = (n) => {
    const max = Math.max(1, factionPool.length);
    const clamped = Math.max(1, Math.min(max, n || 1));
    setDraftPlayers((rows) => {
      if (clamped === rows.length) return rows;
      if (clamped < rows.length) return rows.slice(0, clamped);
      const next = [...rows];
      while (next.length < clamped) {
        const used = new Set(next.map((r) => r.paletteId));
        const suggestion = factionPool.find((p) => !used.has(p.id));
        next.push({ name: '', paletteId: suggestion ? suggestion.id : '', homeIconId: '', team: '' });
      }
      return next;
    });
  };

  const updateDraftRow = (i, changes) => {
    setDraftPlayers((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...changes } : r)));
  };

  const canProceedStep1 =
    draftPlayers.length > 0 &&
    draftPlayers.every((r) => r.name.trim() && r.paletteId) &&
    new Set(draftPlayers.map((r) => r.paletteId)).size === draftPlayers.length;

  const handleStep1Next = () => {
    const committed = draftPlayers.map((row) => {
      const entry = state.palette.find((p) => p.id === row.paletteId);
      actions.updatePaletteEntry(row.paletteId, { owner: row.name.trim(), homeIconId: row.homeIconId || null });
      if (row.team) actions.setPlayerTeam(row.name.trim(), Number(row.team));
      return {
        name: row.name.trim(),
        paletteId: row.paletteId,
        color: entry ? entry.color : '#888888',
        homeIconId: row.homeIconId || null,
        team: row.team || null,
      };
    });
    // Legend Key stays just Unclaimed + this session's players — no
    // leftover unused defaults or entries from a previous campaign.
    actions.pruneUnusedPalette(draftPlayers.map((row) => row.paletteId));
    // Step 2 starts from a blank map, ready for fresh territory.
    actions.cleanAll();
    setCommittedPlayers(committed);
    setPlacedIds(new Set());
    setStep(2);
  };

  // ---- Step 2 ----
  const armPlayer = (p) => {
    actions.setGameSetupArmedPlacement({
      paletteId: p.paletteId,
      color: p.color,
      homeIconId: p.homeIconId,
      radius,
      playerName: p.name,
    });
  };
  const armedPaletteId = state.gameSetupArmedPlacement ? state.gameSetupArmedPlacement.paletteId : null;

  const handleStep2Next = () => {
    actions.setGameSetupArmedPlacement(null);
    setStep(3);
  };

  // ---- Step 3 ----
  const handlePlaceRandom = () => {
    const result = actions.placeDefendingRewards(
      committedPlayers.map((p) => ({ name: p.name, paletteId: p.paletteId })),
      giveDefender
    );
    if (!result.ok) {
      const reasons = {
        'no-active-types': 'No reward types are enabled with a "Max in area" above 0 — check the list below.',
        'no-eligible-hexes': 'No eligible hexes found. Place territory in Step 2 first, or every hex already has a reward.',
      };
      setRewardMessage(reasons[result.reason] || 'Could not place rewards.');
    } else {
      setRewardMessage(
        `Placed ${result.placed} reward${result.placed === 1 ? '' : 's'} across ${committedPlayers.length} player${committedPlayers.length === 1 ? '' : 's'}' territory.`
      );
    }
  };

  const handleFinalize = () => {
    actions.closeGameSetup();
  };

  // ---- Shared bits ----
  const panelHeader = (title, stepLabel) => (
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1.5, color: 'var(--gold)', textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--bone-dim)' }}>{stepLabel}</div>
      </div>
      <button className="btn-ghost" onClick={handleCancel} title="Cancel — discards everything done in this wizard" style={{ padding: '3px 8px', fontSize: 11, lineHeight: 1 }}>
        &times;
      </button>
    </div>
  );

  // ---- Step 1: blocking modal ----
  if (step === 1) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,6,7,0.72)', zIndex: 60 }}>
        <div
          style={{
            width: 520,
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
            border: '1px solid var(--steel-line)',
            borderTop: '2px solid var(--gold)',
            borderRadius: 3,
            boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
          }}
        >
          {panelHeader('New Game Setup', 'Step 1 of 3 — Players & Teams')}
          <div style={{ padding: 14 }}>
            <div className="hint-text" style={{ marginTop: 0 }}>
              How many players, who they are, and which faction and team each one gets. "Unclaimed" is never
              assignable — it stays neutral. Moving on wipes the map back to blank and trims the Legend Key down to
              just these players plus Unclaimed, so Step 2 starts from a clean slate.
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>Number of Players</label>
              <input
                type="number"
                min="1"
                max={Math.max(1, factionPool.length)}
                value={draftPlayers.length}
                onChange={(e) => handleCountChange(Number(e.target.value))}
                style={{ width: 68 }}
              />
              <div className="hint-text" style={{ margin: '4px 0 0' }}>
                Up to {factionPool.length} — add more Legend Key entries in the Territory tab first if you need more.
              </div>
            </div>

            {draftPlayers.map((row, i) => (
              <div key={i} style={{ border: '1px solid var(--steel-line)', borderRadius: 3, padding: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 2,
                      flexShrink: 0,
                      background: (state.palette.find((p) => p.id === row.paletteId) || {}).color || 'transparent',
                      border: '1px solid rgba(0,0,0,0.4)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder={`Player ${i + 1} name`}
                    value={row.name}
                    onChange={(e) => updateDraftRow(i, { name: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={row.paletteId}
                    onChange={(e) => updateDraftRow(i, { paletteId: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">Choose faction&hellip;</option>
                    {factionPool.map((p) => (
                      <option key={p.id} value={p.id} disabled={draftPlayers.some((r, idx) => idx !== i && r.paletteId === p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.homeIconId}
                    onChange={(e) => updateDraftRow(i, { homeIconId: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">No home base</option>
                    {HOME_ICON_OPTIONS.map((ic) => (
                      <option key={ic.id} value={ic.id}>{ic.label}</option>
                    ))}
                  </select>
                  <select
                    value={row.team}
                    onChange={(e) => updateDraftRow(i, { team: e.target.value })}
                    style={{ width: 116, flexShrink: 0 }}
                  >
                    <option value="">Unassigned</option>
                    {Array.from({ length: TEAM_COUNT }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>Team {n}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {!canProceedStep1 && (
              <div className="hint-text" style={{ margin: '4px 0 12px', color: 'var(--blood-bright)' }}>
                Every player needs a name and a unique faction before continuing.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={handleCancel}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} disabled={!canProceedStep1} onClick={handleStep1Next}>
                Next: Place Territory
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Steps 2-3: floating, non-blocking panel ----
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 300,
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
        border: '1px solid var(--steel-line)',
        borderTop: '2px solid var(--gold)',
        borderRadius: 3,
        boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
        zIndex: 6,
      }}
    >
      {step === 2 && (
        <>
          {panelHeader('New Game Setup', 'Step 2 of 3 — Territory Placement')}
          <div style={{ padding: 12 }}>
            <div className="hint-text" style={{ marginTop: 0 }}>
              Click a player below, then click a hex on the map to place their territory. It'll paint outward from
              that hex and drop their home-base emblem in the centre.
            </div>

            <div className="field" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ margin: 0 }}>Territory Radius</label>
                <span
                  style={{
                    minWidth: 20,
                    textAlign: 'center',
                    background: '#0f1112',
                    border: '1px solid var(--steel-line)',
                    borderRadius: 2,
                    padding: '1px 6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--gold)',
                  }}
                >
                  {radius}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
              <div className="hint-text" style={{ margin: '2px 0 0' }}>
                {radius === 0 ? 'Just the one hex' : `${radius} hex${radius === 1 ? '' : 'es'} out from the centre`} —
                set before each click; re-click a player to pick up a changed size. Re-placing a player overwrites
                their old territory rather than adding to it.
              </div>
            </div>

            {committedPlayers.map((p) => {
              const armed = armedPaletteId === p.paletteId;
              const placed = placedIds.has(p.paletteId);
              return (
                <button
                  key={p.paletteId}
                  onClick={() => armPlayer(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    background: armed ? 'rgba(184,150,62,0.14)' : 'transparent',
                    border: `1px solid ${armed ? 'var(--gold)' : 'var(--steel-line)'}`,
                    borderRadius: 3,
                    padding: '7px 9px',
                    marginBottom: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: p.color, border: '1px solid rgba(0,0,0,0.4)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                    {p.team && <span style={{ color: 'var(--gold-dim)' }}> &middot; T{p.team}</span>}
                  </span>
                  {placed && <span style={{ color: '#7fbf7f', fontSize: 12, flexShrink: 0 }} title="Territory placed">&#10003;</span>}
                  {armed && <span style={{ color: 'var(--gold)', fontSize: 9, flexShrink: 0, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>armed</span>}
                </button>
              );
            })}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={handleCancel}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleStep2Next}>Next: Rewards</button>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {panelHeader('New Game Setup', 'Step 3 of 3 — Defending Rewards')}
          <div style={{ padding: 12 }}>
            <div className="hint-text" style={{ marginTop: 0 }}>
              Write what each reward offers and how many can spawn per player's territory — this is the same list as
              the Rewards tab. Placement always skips a player's own home-base hex.
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={giveDefender}
                onChange={(e) => setGiveDefender(e.target.checked)}
                style={{ flexShrink: 0, accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
              />
              <span className="hint-text" style={{ margin: 0 }}>
                Every player defends whatever reward lands in their own territory
              </span>
            </label>

            {state.rewardTypes.map((rt) => (
              <WizardRewardCard key={rt.id} rt={rt} />
            ))}

            {rewardMessage && (
              <div style={{ marginTop: 8, padding: 8, background: '#0f1112', border: '1px solid var(--gold-dim)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)' }}>
                {rewardMessage}
              </div>
            )}

            <button className="btn-clear" style={{ marginTop: 10 }} onClick={handlePlaceRandom}>
              Place Rewards Randomly
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>Back</button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={handleCancel}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleFinalize}>Finalize</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Compact reward-type editor for Step 3 — same underlying data as
// RewardPanel's cards (state.rewardTypes), just a tighter layout to
// fit the wizard's narrower panel.
function WizardRewardCard({ rt }) {
  const actions = useMapActions();
  const def = rewardIconById(rt.iconId);

  return (
    <div style={{ background: '#0f1112', border: '1px solid var(--steel-line)', borderRadius: 4, padding: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={rt.enabled !== false}
          onChange={(e) => actions.updateRewardType(rt.id, { enabled: e.target.checked })}
          title="Include this reward when placing randomly"
          style={{ flexShrink: 0, accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
        />
        {def && (
          <div style={{ width: 22, height: 22, flexShrink: 0, background: '#17191b', border: '1px solid var(--steel-line)', borderRadius: 3, padding: 3 }}>
            <svg viewBox="0 0 512 512" style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: def.markup }} />
          </div>
        )}
        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rt.name}
        </span>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bone-dim)', flexShrink: 0 }}>Max:</label>
        <input
          type="number"
          min="0"
          value={rt.frequency}
          onChange={(e) => actions.updateRewardType(rt.id, { frequency: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          style={{ width: 44, flexShrink: 0 }}
        />
      </div>
      <textarea
        value={rt.benefit || ''}
        onChange={(e) => actions.updateRewardType(rt.id, { benefit: e.target.value })}
        placeholder="What does holding this reward grant?"
        rows={2}
        style={{
          width: '100%',
          resize: 'vertical',
          marginTop: 6,
          background: '#17191b',
          border: '1px solid var(--steel-line)',
          color: 'var(--bone)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '6px 8px',
          borderRadius: 2,
        }}
      />
    </div>
  );
}

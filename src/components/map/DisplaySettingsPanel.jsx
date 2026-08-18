import React, { useState } from 'react';
import { useMapState, useMapActions } from '../../state/MapContext.jsx';

const numberInputStyle = {
  width: 46,
  background: '#0f1112',
  border: '1px solid var(--steel-line)',
  color: 'var(--gold)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  padding: '2px 4px',
  borderRadius: 2,
  textAlign: 'right',
};

// Floating panel of map-wide visual controls — separate from game
// content, so changes here don't need a hex selected and apply
// everywhere at once. Toggled from the Header's "Display Settings"
// button; lives here (rather than a Sidebar tab) so it can float over
// the map like HexInfoPopup/MovementControls and the GM can see
// changes land live while dragging a slider. More controls join this
// panel over time — keep new ones grouped the same way (label + input
// + live value).
export default function DisplaySettingsPanel() {
  const state = useMapState();
  const actions = useMapActions();
  const [openSections, setOpenSections] = useState({});

  if (!state.displaySettingsOpen) return null;

  const toggleSection = (key) => setOpenSections((o) => ({ ...o, [key]: !o[key] }));

  const row = (label, control) => (
    <div className="field" style={{ gap: 4 }}>
      <label style={{ margin: 0 }}>{label}</label>
      {control}
    </div>
  );

  // A slider paired with a number box showing/editing the same value —
  // dragging and typing both call `onChange` with a plain number
  // already clamped to [min, max], so callers never see out-of-range
  // values from either input. `percent` displays/accepts the value
  // ×100 (for the 0-1 opacity fields) while still dispatching the
  // underlying 0-1 number.
  const sliderRow = (label, { value, min, max, step, onChange, percent }) => {
    const display = percent ? Math.round(value * 100) : value;
    const displayMin = percent ? min * 100 : min;
    const displayMax = percent ? max * 100 : max;
    const clamp = (n) => Math.min(displayMax, Math.max(displayMin, n));
    const commit = (n) => onChange(percent ? clamp(n) / 100 : clamp(n));
    return row(
      label,
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <input
            type="number"
            min={displayMin}
            max={displayMax}
            step={percent ? Math.round(step * 100) || 1 : step}
            value={display}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) commit(n);
            }}
            style={numberInputStyle}
          />
          {percent && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)' }}>%</span>}
        </div>
      </div>
    );
  };

  // A group of controls collapsed behind its own clickable header — the
  // panel keeps growing as new settings/effects get GM-tunable knobs,
  // and showing everything at once (most of which the GM isn't touching
  // in any given session) is what made it too long. Collapsed by
  // default; which ones are open is purely local UI state
  // (openSections above), not worth persisting. `variant: 'title'` is
  // for a top-level group (Map Appearance, Battlefield Effects — bigger
  // text, no bottom border since it isn't nested under anything);
  // plain/'sub' is for one effect's controls nested inside a 'title'
  // group (smaller, dimmer, underlined to separate it from its
  // siblings).
  const section = (key, label, content, variant = 'sub') => {
    const isOpen = !!openSections[key];
    const isTitle = variant === 'title';
    return (
      <div style={isTitle ? undefined : { marginTop: 10 }}>
        <button
          onClick={() => toggleSection(key)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            border: 'none',
            borderBottom: isTitle ? 'none' : '1px solid var(--steel-line)',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: isTitle ? 'var(--gold)' : 'var(--gold-dim)',
          }}
        >
          {isTitle ? (
            <span className="panel-title" style={{ fontSize: 11, margin: 0 }}>{label}</span>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
          )}
          <span style={{ fontSize: isTitle ? 10 : 9 }}>{isOpen ? '▾' : '▸'}</span>
        </button>
        {isOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: isTitle ? '10px 0 0' : '10px 1px 0' }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        width: 240,
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
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: 1.5,
            color: 'var(--gold)',
            textTransform: 'uppercase',
          }}
        >
          Display Settings
        </div>
        <button
          className="btn-ghost"
          onClick={actions.toggleDisplaySettings}
          title="Close"
          style={{ padding: '3px 8px', fontSize: 11, lineHeight: 1 }}
        >
          &times;
        </button>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hint-text" style={{ margin: 0 }}>
          More controls will join this panel over time.
        </div>

        {section(
          'mapAppearance',
          'Map Appearance',
          <>
            {row(
              'Hex Line Colour',
              <input
                type="color"
                value={state.hexLineColor}
                onChange={(e) => actions.setHexLineColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
              />
            )}

            {sliderRow('Hex Line Thickness', {
              value: state.hexLineWidth,
              min: 0.5,
              max: 5,
              step: 0.5,
              onChange: actions.setHexLineWidth,
            })}

            {row(
              'Hex Text Colour',
              <input
                type="color"
                value={state.hexTextColor}
                onChange={(e) => actions.setHexTextColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
              />
            )}

            {sliderRow('Hex Text Size', {
              value: state.hexTextSize,
              min: 5,
              max: 16,
              step: 0.5,
              onChange: actions.setHexTextSize,
            })}

            {sliderRow('Hex Text Opacity', {
              value: state.hexTextOpacity,
              min: 0,
              max: 1,
              step: 0.05,
              onChange: actions.setHexTextOpacity,
              percent: true,
            })}

            {sliderRow('Overall Map Opacity', {
              value: state.mapOpacity,
              min: 0.1,
              max: 1,
              step: 0.05,
              onChange: actions.setMapOpacity,
              percent: true,
            })}
          </>,
          'title'
        )}

        <div className="section" style={{ margin: 0, paddingTop: 12 }}>
          <div className="panel-title" style={{ fontSize: 11, marginBottom: 4 }}>Battlefield Effects</div>

          {section(
            'shield',
            'Force Shield',
            <>
              {row(
                'Shield Colour',
                <input
                  type="color"
                  value={state.shieldColor}
                  onChange={(e) => actions.setShieldColor(e.target.value)}
                  style={{ width: 36, height: 28, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
                />
              )}
              {sliderRow('Glow Strength', {
                value: state.shieldGlowStrength,
                min: 0,
                max: 2,
                step: 0.1,
                onChange: actions.setShieldGlowStrength,
              })}
              {sliderRow('Radial Falloff', {
                value: state.shieldFalloff,
                min: 0.1,
                max: 0.8,
                step: 0.05,
                onChange: actions.setShieldFalloff,
                percent: true,
              })}
              {sliderRow('Stencil Opacity', {
                value: state.shieldStencilOpacity,
                min: 0,
                max: 1,
                step: 0.05,
                onChange: actions.setShieldStencilOpacity,
                percent: true,
              })}
              {sliderRow('Opacity Strength', {
                value: state.shieldOpacityStrength,
                min: 0,
                max: 2,
                step: 0.1,
                onChange: actions.setShieldOpacityStrength,
              })}
            </>
          )}

          {section(
            'explosions',
            'Explosions',
            row(
              'Explosion Colour',
              <input
                type="color"
                value={state.explosionColor}
                onChange={(e) => actions.setExplosionColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
              />
            )
          )}

          {section(
            'artillery',
            'Artillery Strike',
            <>
              {sliderRow('Shell Speed', {
                value: state.artillerySpeed,
                min: 0.25,
                max: 3,
                step: 0.25,
                onChange: actions.setArtillerySpeed,
              })}
              {sliderRow('Fire Rate', {
                value: state.artilleryFrequency,
                min: 0.25,
                max: 3,
                step: 0.25,
                onChange: actions.setArtilleryFrequency,
              })}
            </>
          )}

          {section(
            'radar',
            'Radar Sweep',
            row(
              'Radar Colour',
              <input
                type="color"
                value={state.radarColor}
                onChange={(e) => actions.setRadarColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--steel-line)', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
              />
            )
          )}
        </div>

        <button className="btn-clear" style={{ marginTop: 0 }} onClick={actions.resetDisplaySettings}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

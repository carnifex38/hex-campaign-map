import React, { useId, useMemo } from 'react';
import { hexToPixel, hexPoints, hexToRgba, lightenColor } from '../../utils/hexMath.js';
import { iconById } from '../../data/legionIcons.js';
import { rewardIconById } from '../../data/rewardIcons.js';
import { useMapState, useMapSelectors } from '../../state/MapContext.jsx';

// Deterministic 0-1 "random" from an integer seed — used for the
// Battle Effect's explosion positions/timings (see the `explosions`
// useMemo below) so each hex's little bursts stay put at the same
// spots and on the same cadence across re-renders instead of jumping
// around every time React re-renders the tile.
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function HexTile({ c, r, hexSize, entry, isSelected, isDisconnected, onSelect }) {
  const state = useMapState();
  const { getOpacity, getFactionScale, rewardTypeById, resolveHexColor, paletteEntryForHex } = useMapSelectors();
  const clipId = useId();

  const { x, y } = hexToPixel(c, r, hexSize);
  const points = useMemo(() => hexPoints(x, y, hexSize), [x, y, hexSize]);

  // Resolved through the hex's paletteId when it has one, so repainting
  // a Legend Key swatch's colour updates every hex using it immediately
  // instead of leaving already-painted hexes on the old shade.
  const resolvedColor = entry ? resolveHexColor(entry) : null;
  const fill = resolvedColor ? hexToRgba(resolvedColor, getOpacity(resolvedColor)) : '#202325';

  const factionDef = entry && entry.factionIcon ? iconById(entry.factionIcon) : null;
  const rewardDef = useMemo(() => {
    if (!entry || !entry.reward) return null;
    const rt = rewardTypeById(entry.reward);
    return rt ? rewardIconById(rt.iconId) : null;
  }, [entry, rewardTypeById]);

  // A reward's look tracks its Game Setup defence state (see
  // HexInfoPopup/RewardPanel). It reads as half-opacity only while it's
  // truly not banked yet: either still sitting on its original
  // defender, or sitting on a hex nobody has claimed at all. The
  // moment any player other than the original defender holds it — or,
  // for a defender-less "free for the taking" reward, the moment any
  // player claims it at all — it's banked and goes full-opacity. A
  // ring in the original defender's colour only applies when there
  // was a defender to take it from, marking it as "someone's trophy,
  // taken from them" rather than just an ordinary claimed reward.
  const defenderName = entry && entry.meta ? entry.meta.objectiveOwner : null;
  const controller = entry ? paletteEntryForHex(entry) : null;
  const controllerOwner = controller && controller.owner ? controller.owner : null;
  const rewardCaptured = !!(defenderName && defenderName !== controllerOwner);
  const rewardBanked = rewardCaptured || (!defenderName && !!controllerOwner);
  const rewardOpacity = rewardBanked ? 1 : 0.5;
  const defenderPalette = defenderName ? state.palette.find((p) => p.owner === defenderName) : null;

  const unitIcons = entry && entry.icons ? entry.icons : [];

  // Unit icons lay out in a small grid centred on the hex, shrinking as
  // more get stacked so several can share one hex without spilling out.
  const unitLayout = useMemo(() => {
    const n = unitIcons.length;
    if (n === 0) return [];
    const rowsN = Math.ceil(Math.sqrt(n));
    const colsN = Math.ceil(n / rowsN);
    const cell = (hexSize * 1.2) / Math.max(rowsN, colsN);
    const iconR = Math.max(3, cell * 0.42);
    const startX = x - ((colsN - 1) * cell) / 2;
    const startY = y - ((rowsN - 1) * cell) / 2;
    return unitIcons.map((iconId, i) => {
      const row = Math.floor(i / colsN);
      const col = i % colsN;
      return {
        iconId,
        px: startX + col * cell,
        py: startY + row * cell,
        size: iconR * 1.5,
      };
    });
  }, [unitIcons, hexSize, x, y]);

  // Hex Effects (HexInfoPopup's "Battle Effect" dropdown — purely
  // visual, no game meaning). `hexEffect` picks which one, if any.
  const hexEffect = entry ? entry.hexEffect : null;

  // "Battle (Explosions)": a handful of little explosion bursts at
  // random spots around the hex's centre, each on its own randomised
  // size/timing so they don't all flash in lockstep. Positions/timings
  // are derived from the hex's own coordinates (not Math.random()) so
  // they stay put across re-renders instead of jumping every time
  // anything about this hex — or any other hex, triggering a re-render
  // here — changes; only hexEffect changing, or the hex actually
  // moving/resizing, should ever recompute them.
  const explosionsOn = hexEffect === 'explosions';
  // GM-tunable via Display Settings — one base colour, everything else
  // (the brighter/darker glow layers, the near-white core) is derived
  // from it so changing one swatch recolours the whole burst coherently.
  const explosionColor = state.explosionColor || '#ff8a3d';
  const explosionCoreColor = lightenColor(explosionColor, 0.75);
  const explosionGlowFilter = [
    `drop-shadow(0 0 3px ${hexToRgba(lightenColor(explosionColor, 0.3), 0.95)})`,
    `drop-shadow(0 0 8px ${hexToRgba(explosionColor, 0.75)})`,
    `drop-shadow(0 0 16px ${hexToRgba(lightenColor(explosionColor, -0.3), 0.45)})`,
  ].join(' ');
  const explosions = useMemo(() => {
    if (!explosionsOn) return [];
    const count = 3;
    const out = [];
    for (let i = 0; i < count; i++) {
      const seed = (c + 1) * 9973 + (r + 1) * 6151 + i * 7919;
      const angle = seededRandom(seed) * Math.PI * 2;
      const dist = seededRandom(seed + 101) * hexSize * 0.45;
      const dur = 2.5 + seededRandom(seed + 202) * 3; // 2.5s-5.5s full cycle, most of it idle
      const begin = seededRandom(seed + 303) * dur; // desyncs bursts from each other
      out.push({
        key: i,
        ex: x + Math.cos(angle) * dist,
        ey: y + Math.sin(angle) * dist,
        dur,
        begin,
      });
    }
    return out;
  }, [explosionsOn, c, r, hexSize, x, y]);

  // "Force Shield": a dome of small glowing hex facets tiling the
  // whole tile — like a honeycombed energy sphere — plus a bright rim
  // ring at the edge for the "curved surface catching the light" look.
  // The facet grid is generated once per hex (memoised) as a small
  // "hexagon of hexagons" in axial coordinates (same maths idea as
  // isInHexagonShape's cube-distance mask, just applied at tile scale
  // instead of grid scale) and clipped to the tile's own outline so it
  // never bleeds into neighbours. Brightness/twinkle timing per facet
  // is seeded off the hex's own coordinates so it stays put across
  // re-renders and every shielded hex still looks independently alive.
  const shieldOn = hexEffect === 'shield';
  const shieldSeed = (c + 1) * 9973 + (r + 1) * 6151;
  const shieldClipId = useId();
  const shieldGradId = useId();
  const shieldMaskId = useId();
  // GM-tunable via Display Settings.
  const shieldColor = state.shieldColor || '#46aaff';
  const shieldGlow = state.shieldGlowStrength ?? 1;
  const shieldFalloff = Math.min(0.8, Math.max(0.1, state.shieldFalloff ?? 0.4));
  const shieldOpacityMul = state.shieldOpacityStrength ?? 1;
  const shieldStencilOpacity = Math.min(1, Math.max(0, state.shieldStencilOpacity ?? 0));
  const shieldFacetLight = lightenColor(shieldColor, 0.35); // brighter edge tone for facet strokes/rim
  const shieldOuterPoints = useMemo(() => (shieldOn ? hexPoints(x, y, hexSize * 0.97) : null), [shieldOn, x, y, hexSize]);
  const shieldFacets = useMemo(() => {
    if (!shieldOn) return [];
    const radius = 2; // hexagon-of-hexagons ring radius: 1 + 6 + 12 = 19 facets
    const subSize = hexSize * 0.26;
    const out = [];
    let i = 0;
    for (let q = -radius; q <= radius; q++) {
      const rMin = Math.max(-radius, -q - radius);
      const rMax = Math.min(radius, -q + radius);
      for (let ar = rMin; ar <= rMax; ar++) {
        const px = x + subSize * 1.5 * q;
        const py = y + subSize * Math.sqrt(3) * (ar + q / 2);
        const seed = shieldSeed + i * 401;
        out.push({
          key: i,
          points: hexPoints(px, py, subSize * 0.88),
          brightness: 0.35 + seededRandom(seed) * 0.55,
          dur: 2.2 + seededRandom(seed + 11) * 2.6,
          begin: seededRandom(seed + 23) * 3,
        });
        i += 1;
      }
    }
    return out;
  }, [shieldOn, x, y, hexSize, shieldSeed]);

  // "Radar Sweep": a simplified scope face — two concentric rings, a
  // crosshair, and a rotating sweep wedge that fades out behind its own
  // leading edge, echoing a classic circular radar display shrunk down
  // to tile scale. Clipped to the tile's own outline the same way the
  // Force Shield's facets are, so it never bleeds into neighbours.
  const radarOn = hexEffect === 'radar';
  const radarClipId = useId();
  const radarColor = state.radarColor || '#39ff8f';

  const handleClick = (e) => {
    onSelect(`${c},${r}`, e.ctrlKey || e.metaKey);
  };

  return (
    <g className="hex-group">
      <polygon
        points={points}
        fill={fill}
        stroke={isSelected ? 'var(--gold)' : state.hexLineColor}
        strokeWidth={isSelected ? 2.5 : state.hexLineWidth}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      />

      {isDisconnected && (
        <polygon
          points={points}
          fill="url(#disconnected-hatch)"
          stroke="none"
          pointerEvents="none"
        />
      )}

      {factionDef && (() => {
        // A smaller hex "medallion" behind the emblem, inset from the
        // tile's own edge so a thin ring of the tile's territory colour
        // reads as a border around it. This is what makes emblems with
        // black/dark artwork stand out against a dark-filled tile — no
        // colour inversion needed, so the emblem's real faction colours
        // (legion reds, blues, etc.) render true to their actual art
        // instead of getting flipped to their inverse.
        const badgeScale = 0.76;
        const badgeSize = hexSize * badgeScale;
        const iconSize = hexSize * 1.3 * badgeScale * getFactionScale(entry.factionIcon);
        return (
          <g pointerEvents="none">
            <polygon
              points={hexPoints(x, y, badgeSize)}
              fill="var(--bone)"
              stroke="var(--bronze)"
              strokeWidth={1.25}
              opacity={state.factionIconOpacity}
            />
            <clipPath id={clipId}>
              <polygon points={hexPoints(x, y, hexSize * 0.92 * badgeScale)} />
            </clipPath>
            <image
              href={factionDef.url}
              x={x - iconSize / 2}
              y={y - iconSize / 2}
              width={iconSize}
              height={iconSize}
              preserveAspectRatio="xMidYMid meet"
              clipPath={`url(#${clipId})`}
              opacity={state.factionIconOpacity}
            />
          </g>
        );
      })()}

      {rewardDef && (
        <g pointerEvents="none">
          {rewardCaptured && defenderPalette && state.showCapturedRewardOutlines && (
            <polygon
              points={hexPoints(x, y, hexSize * 0.72)}
              fill="none"
              stroke={defenderPalette.color}
              strokeWidth={4}
              style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.9))' }}
            />
          )}
          <svg
            className={rewardCaptured ? 'reward-capture-pulse' : undefined}
            x={x - (hexSize * 0.62) / 2}
            y={y - (hexSize * 0.62) / 2}
            width={hexSize * 0.62}
            height={hexSize * 0.62}
            viewBox="0 0 512 512"
            opacity={rewardCaptured ? undefined : rewardOpacity}
            style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.95)) drop-shadow(0 0 3px rgba(0,0,0,0.75))' }}
            dangerouslySetInnerHTML={{ __html: rewardDef.markup }}
          />
        </g>
      )}

      <text
        x={x}
        y={y + hexSize * 0.62}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={state.hexTextSize}
        fill={hexToRgba(state.hexTextColor, state.hexTextOpacity)}
        pointerEvents="none"
      >
        {c},{r}
      </text>

      {unitLayout.map((u, i) => {
        const def = iconById(u.iconId);
        if (!def) return null;
        return (
          <image
            key={i}
            href={def.url}
            x={u.px - u.size / 2}
            y={u.py - u.size / 2}
            width={u.size}
            height={u.size}
            pointerEvents="none"
            style={{
              filter:
                'invert(1) drop-shadow(0 0 1.2px rgba(0,0,0,0.9)) drop-shadow(0 0 2px rgba(0,0,0,0.6))',
            }}
          />
        );
      })}

      {explosions.length > 0 && (
        <g pointerEvents="none">
          {/* Subtle scrim under the bursts themselves — darkens the
              tile a touch regardless of its own colour, so a bright
              flash still pops even on an already-light or same-hued
              tile instead of blending into it. Each burst gets its own
              copy, fading in/out on that same burst's own timeline
              (same dur/begin as its flash below) rather than sitting
              on permanently — overlapping bursts naturally darken the
              tile a bit further while more than one is live. */}
          {explosions.map((ex) => (
            <polygon key={`scrim-${ex.key}`} points={points} fill="black" opacity="0">
              <animate
                attributeName="opacity"
                values="0;0.32;0.18;0;0"
                keyTimes="0;0.08;0.22;0.35;1"
                dur={`${ex.dur}s`}
                begin={`${ex.begin}s`}
                repeatCount="indefinite"
              />
            </polygon>
          ))}
          {explosions.map((ex) => (
            <g
              key={ex.key}
              style={{ filter: explosionGlowFilter }}
            >
              {/* Faint expanding shockwave ring — the "viewed from high
                  up" read, a ring spreading outward and thinning as it
                  goes rather than a 3D plume. */}
              <circle cx={ex.ex} cy={ex.ey} r="0" fill="none" stroke={explosionColor} strokeWidth={1.5} opacity="0">
                <animate
                  attributeName="r"
                  values={`0;${hexSize * 0.1};${hexSize * 0.42};${hexSize * 0.42}`}
                  keyTimes="0;0.08;0.35;1"
                  dur={`${ex.dur}s`}
                  begin={`${ex.begin}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.55;0;0;0"
                  keyTimes="0;0.1;0.3;0.4;1"
                  dur={`${ex.dur}s`}
                  begin={`${ex.begin}s`}
                  repeatCount="indefinite"
                />
              </circle>
              {/* Outer glow — the bulk of the "light up" flash. */}
              <circle cx={ex.ex} cy={ex.ey} r="0" fill={explosionColor} opacity="0">
                <animate
                  attributeName="r"
                  values={`0;${hexSize * 0.3};${hexSize * 0.16};0;0`}
                  keyTimes="0;0.08;0.22;0.35;1"
                  dur={`${ex.dur}s`}
                  begin={`${ex.begin}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.9;0.4;0;0"
                  keyTimes="0;0.08;0.22;0.35;1"
                  dur={`${ex.dur}s`}
                  begin={`${ex.begin}s`}
                  repeatCount="indefinite"
                />
              </circle>
              {/* Bright white-hot core — flashes fastest, dims down
                  first, so the burst reads as lighting up then dying
                  out rather than a flat pulse. */}
              <circle cx={ex.ex} cy={ex.ey} r="0" fill={explosionCoreColor} opacity="0">
                <animate
                  attributeName="r"
                  values={`0;${hexSize * 0.14};${hexSize * 0.04};0;0`}
                  keyTimes="0;0.05;0.15;0.25;1"
                  dur={`${ex.dur}s`}
                  begin={`${ex.begin}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;0.5;0;0"
                  keyTimes="0;0.05;0.15;0.25;1"
                  dur={`${ex.dur}s`}
                  begin={`${ex.begin}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>
      )}

      {shieldOn && (() => {
        const clamp01 = (n) => Math.min(1, Math.max(0, n));
        // Falloff stops: shieldFalloff is where the see-through centre
        // ends, the rest of the way to the edge is a smooth 3-stop fade
        // back in to fully visible.
        const f1 = shieldFalloff * 100;
        const f2 = (shieldFalloff + (1 - shieldFalloff) * 0.35) * 100;
        const f3 = (shieldFalloff + (1 - shieldFalloff) * 0.7) * 100;
        // Stencil Opacity raises the mask's minimum luminance so the
        // "hidden" centre isn't necessarily fully hidden — it lets some
        // of the effect show through uniformly, still fading up to
        // fully visible at the edge the same way. 0 = classic fully
        // see-through centre, 1 = stencil essentially off.
        const grayStop = (v) => {
          const n = Math.round(clamp01(v) * 255);
          return `rgb(${n},${n},${n})`;
        };
        const s0 = shieldStencilOpacity;
        const s1 = shieldStencilOpacity;
        const s2 = shieldStencilOpacity + (1 - shieldStencilOpacity) * 0.35;
        const s3 = shieldStencilOpacity + (1 - shieldStencilOpacity) * 0.75;
        const facetGlowFilter = [
          `drop-shadow(0 0 ${2 * shieldGlow}px ${hexToRgba(shieldFacetLight, clamp01(0.9 * shieldGlow))})`,
          `drop-shadow(0 0 ${6 * shieldGlow}px ${hexToRgba(shieldColor, clamp01(0.7 * shieldGlow))})`,
          `drop-shadow(0 0 ${14 * shieldGlow}px ${hexToRgba(lightenColor(shieldColor, -0.35), clamp01(0.45 * shieldGlow))})`,
        ].join(' ');
        const rimGlowFilter = [
          `drop-shadow(0 0 ${2 * shieldGlow}px ${hexToRgba(shieldFacetLight, clamp01(0.55 * shieldGlow))})`,
          `drop-shadow(0 0 ${6 * shieldGlow}px ${hexToRgba(shieldColor, clamp01(0.35 * shieldGlow))})`,
        ].join(' ');
        return (
          <g pointerEvents="none">
            <defs>
              <clipPath id={shieldClipId}>
                <polygon points={shieldOuterPoints} />
              </clipPath>
              {/* Radial "hole" in the middle of the shield, fading out
                  toward the edge — reads as a curved, see-through dome
                  rather than a flat opaque disc. GM's Radial Falloff
                  controls where the black (hidden) zone ends. Mask
                  luminance: black = hidden, white = fully shown. */}
              <radialGradient id={shieldGradId} cx={x} cy={y} r={hexSize * 1.05} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={grayStop(s0)} />
                <stop offset={`${f1}%`} stopColor={grayStop(s1)} />
                <stop offset={`${f2}%`} stopColor={grayStop(s2)} />
                <stop offset={`${f3}%`} stopColor={grayStop(s3)} />
                <stop offset="100%" stopColor="white" />
              </radialGradient>
              <mask id={shieldMaskId} maskUnits="userSpaceOnUse">
                <circle cx={x} cy={y} r={hexSize * 1.05} fill={`url(#${shieldGradId})`} />
              </mask>
            </defs>
            <g
              clipPath={`url(#${shieldClipId})`}
              mask={`url(#${shieldMaskId})`}
              style={{ filter: facetGlowFilter }}
            >
              {/* Dark energy-field base tint, so the facets read as a
                  lit surface over a shadowed sphere rather than floating
                  on the tile's own territory colour. */}
              <polygon points={shieldOuterPoints} fill="rgba(6,20,42,0.45)" />
              {/* The honeycomb of small glowing facets — each one's own
                  brightness/twinkle timing gives the surface an uneven,
                  "energy crawling across it" texture instead of a flat
                  glow, echoing the reference sphere's mottled lighting. */}
              {shieldFacets.map((facet) => (
                <polygon
                  key={facet.key}
                  points={facet.points}
                  fill={hexToRgba(shieldColor, clamp01(facet.brightness * 0.3 * shieldOpacityMul))}
                  stroke={hexToRgba(shieldFacetLight, clamp01(facet.brightness * shieldOpacityMul))}
                  strokeWidth={hexSize * 0.02}
                >
                  <animate
                    attributeName="opacity"
                    values="0.6;1;0.6"
                    dur={`${facet.dur}s`}
                    begin={`${facet.begin}s`}
                    repeatCount="indefinite"
                  />
                </polygon>
              ))}
            </g>
            {/* Subtle glow ring at the tile's own edge — soft and
                understated rather than a hard bright line, matching the
                reference's gentle rim light rather than a hot outline. */}
            <polygon
              points={shieldOuterPoints}
              fill="none"
              stroke={shieldFacetLight}
              strokeWidth={1}
              opacity={clamp01(0.5 * shieldOpacityMul)}
              style={{ filter: rimGlowFilter }}
            >
              <animate
                attributeName="opacity"
                values={`${clamp01(0.35 * shieldOpacityMul)};${clamp01(0.6 * shieldOpacityMul)};${clamp01(0.35 * shieldOpacityMul)}`}
                dur="3.4s"
                begin={`${seededRandom(shieldSeed) * 2}s`}
                repeatCount="indefinite"
              />
            </polygon>
          </g>
        );
      })()}

      {radarOn && (() => {
        // ringR/innerR are deliberately a bit smaller than the tile's
        // own radius (a flat-top hex's inradius, along its flat
        // top/bottom edges, is only ~0.87x its own "radius") so the
        // rings and crosshair sit fully inside the tile instead of
        // getting clipped flat by those edges. The sweep reaches the
        // same distance as the outer ring, so it never overshoots it.
        const ringR = hexSize * 0.78;
        const innerR = hexSize * 0.44;
        const sweepSlices = 14;
        const arcSpan = 65; // degrees the trailing fade covers behind the leading edge
        const sweepDur = 4; // seconds per full rotation
        const rad = (deg) => (deg * Math.PI) / 180;
        const rimPoint = (deg) => ({
          px: x + ringR * Math.cos(rad(deg)),
          py: y + ringR * Math.sin(rad(deg)),
        });
        const glowFilter = [
          `drop-shadow(0 0 1.5px ${hexToRgba(lightenColor(radarColor, 0.4), 0.9)})`,
          `drop-shadow(0 0 4px ${hexToRgba(radarColor, 0.6)})`,
        ].join(' ');
        return (
          <g pointerEvents="none">
            <defs>
              <clipPath id={radarClipId}>
                <polygon points={hexPoints(x, y, hexSize * 0.97)} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${radarClipId})`}>
              {/* Dark scope face so the sweep/rings read clearly
                  regardless of the tile's own territory colour. */}
              <polygon points={hexPoints(x, y, hexSize)} fill="rgba(2,10,6,0.6)" />

              {/* Static chrome: two rings, a crosshair, a centre dot —
                  a shrunk-down echo of a classic radar scope's face. */}
              <g style={{ filter: glowFilter }} opacity={0.55}>
                <circle cx={x} cy={y} r={ringR} fill="none" stroke={radarColor} strokeWidth={1} />
                <circle cx={x} cy={y} r={innerR} fill="none" stroke={radarColor} strokeWidth={0.75} />
                <line x1={x - ringR} y1={y} x2={x + ringR} y2={y} stroke={radarColor} strokeWidth={0.6} />
                <line x1={x} y1={y - ringR} x2={x} y2={y + ringR} stroke={radarColor} strokeWidth={0.6} />
                <circle cx={x} cy={y} r={hexSize * 0.035} fill={radarColor} />
              </g>

              {/* Rotating sweep — a fan of thin slices fading out behind
                  the bright leading edge, the whole fan rotating
                  together via one animateTransform rather than each
                  slice animating on its own. */}
              <g style={{ filter: glowFilter }}>
                {Array.from({ length: sweepSlices }, (_, i) => i).map((i) => {
                  const a0 = -((i / sweepSlices) * arcSpan);
                  const a1 = -(((i + 1) / sweepSlices) * arcSpan);
                  const p0 = rimPoint(a0);
                  const p1 = rimPoint(a1);
                  const opacity = 0.5 * Math.pow(1 - i / sweepSlices, 1.6);
                  return (
                    <polygon
                      key={i}
                      points={`${x},${y} ${p0.px},${p0.py} ${p1.px},${p1.py}`}
                      fill={radarColor}
                      opacity={opacity}
                    />
                  );
                })}
                {/* Bright leading-edge scan line. */}
                <line x1={x} y1={y} x2={x + ringR} y2={y} stroke={lightenColor(radarColor, 0.5)} strokeWidth={1.4} opacity={0.9} />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${x} ${y}`}
                  to={`360 ${x} ${y}`}
                  dur={`${sweepDur}s`}
                  repeatCount="indefinite"
                />
              </g>
            </g>
          </g>
        );
      })()}

      {entry && entry.quest && entry.quest.status === 'active' && (() => {
        // Unresolved quest marker's badge, dead-centre in the hex,
        // static (no pulse/scale animation on the badge itself — only
        // the glow ring around the hex breathes; see index.css). The
        // glow ring is drawn separately, in a final pass over the
        // whole grid in HexMapCanvas — see the note there for why
        // (same reason selection outlines moved there too: hexes
        // painted after this one would otherwise cover part of it).
        //
        // The badge's inner icon is a GM choice (HexInfoPopup's Icon
        // dropdown): unset means the classic "!" mark, 'none' means no
        // badge at all (just the hex's own glow ring marks it as a
        // live quest), anything else is a REWARD_ICONS id rendered in
        // the quest's own colour instead of that icon's usual white.
        const quest = entry.quest;
        if (quest.iconId === 'none') return null;
        const badgeR = hexSize * 0.24;
        const customIcon = quest.iconId ? rewardIconById(quest.iconId) : null;
        return (
          <g pointerEvents="none">
            <circle cx={x} cy={y} r={badgeR} fill="#14151a" stroke={quest.color} strokeWidth={1.5} />
            {customIcon ? (
              <svg
                x={x - badgeR * 0.8}
                y={y - badgeR * 0.8}
                width={badgeR * 1.6}
                height={badgeR * 1.6}
                viewBox="0 0 512 512"
                dangerouslySetInnerHTML={{ __html: customIcon.markup.replace(/#fff/g, quest.color) }}
              />
            ) : (
              <>
                <rect
                  x={x - badgeR * 0.16}
                  y={y - badgeR * 0.55}
                  width={badgeR * 0.32}
                  height={badgeR * 0.78}
                  rx={badgeR * 0.16}
                  fill={quest.color}
                />
                <circle cx={x} cy={y + badgeR * 0.46} r={badgeR * 0.17} fill={quest.color} />
              </>
            )}
          </g>
        );
      })()}
    </g>
  );
}

import React, { useId, useMemo } from 'react';
import { hexToPixel, parseKey, artilleryArc, hexToRgba, lightenColor } from '../../utils/hexMath.js';
import { useMapState } from '../../state/MapContext.jsx';

// Builds `values`/`keyTimes` strings for a burst/flourish that should
// play out over [startFrac, startFrac+durFrac] of a longer, indefinitely
// looping animation `dur` — the same idea as HexTile's Battle Effect
// explosions ("2.5s-5.5s full cycle, most of it idle"), just
// parameterised so ArtilleryStrike's launch/impact bursts can share one
// cycle with the shell's flight/trail instead of running on their own
// independent clock. `localValues`/`localKeyTimes` describe the burst's
// own shape on a 0-1 timeline (0 = burst starts, 1 = burst's own end).
function cycleKeyframes(localValues, localKeyTimes, startFrac, durFrac) {
  const values = [];
  const keyTimes = [];
  if (startFrac > 0) {
    values.push(localValues[0]);
    keyTimes.push(0);
  }
  localKeyTimes.forEach((kt, i) => {
    values.push(localValues[i]);
    keyTimes.push(Math.min(1, startFrac + kt * durFrac));
  });
  const endFrac = startFrac + durFrac;
  if (endFrac < 1) {
    values.push(localValues[localValues.length - 1]);
    keyTimes.push(1);
  }
  return { values: values.join(';'), keyTimes: keyTimes.join(';') };
}

// A passive, indefinitely-looping Artillery Strike — same idea as
// HexTile's Battle Effect explosions or Force Shield: pick it from the
// Battle Effect control and it just plays, no separate "fire" step and
// nothing to clean up (see ReadoutPanel's 2-hex selector, which sets
// this via SET_HEX_EFFECT the same way those two are set). One full
// cycle is launch burst -> shell arcs over trailing a continuous stream
// that's brightest right behind it and fades toward the tail -> impact
// burst -> a pause -> repeat, forever, for as long as the origin hex's
// Battle Effect stays set to Artillery Strike. Speed and fire rate are
// both GM-tunable (Display Settings' Artillery Strike section) as
// multipliers on the base flight time / pause length.
export default function ArtilleryStrike({ originKey, targetKey, hexSize }) {
  const state = useMapState();
  const gradId = useId();

  const { originPt, targetPt, arc } = useMemo(() => {
    const o = parseKey(originKey);
    const t = parseKey(targetKey);
    const originPt = hexToPixel(o.c, o.r, hexSize);
    const targetPt = hexToPixel(t.c, t.r, hexSize);
    return { originPt, targetPt, arc: artilleryArc(originPt, targetPt, hexSize) };
  }, [originKey, targetKey, hexSize]);

  // Reuses the same GM-tunable Explosion Colour the Battle (Explosions)
  // effect uses (Display Settings) so this recolours together with the
  // rest of the battlefield-effects palette instead of needing its own
  // colour picker.
  const color = state.explosionColor || '#ff8a3d';
  const coreColor = lightenColor(color, 0.75);

  // Speed/Fire Rate — GM-tunable multipliers (Display Settings). Speed
  // scales flight time directly (higher = faster shell, less time in
  // the air); Fire Rate scales the post-impact pause the other way
  // (higher = shorter pause = fires more often).
  const speedMult = Math.max(0.1, state.artillerySpeed ?? 1);
  const freqMult = Math.max(0.1, state.artilleryFrequency ?? 1);
  const flightMs = arc.flightMs / speedMult;

  // Phase lengths (ms). Impact/pause are a fixed beat so every strike,
  // near or far, fast or slow, reads with the same "thunk...boom" shape
  // around whatever the flight time ends up being.
  const launchBurstMs = 350;
  const impactBurstMs = 500;
  const trailFadeMs = 300;
  const pauseMs = 900 / freqMult;
  const cycleMs = flightMs + Math.max(impactBurstMs, trailFadeMs) + pauseMs;
  const cycleS = cycleMs / 1000;
  const flightFrac = flightMs / cycleMs;

  const glowFilter = [
    `drop-shadow(0 0 3px ${hexToRgba(lightenColor(color, 0.3), 0.95)})`,
    `drop-shadow(0 0 8px ${hexToRgba(color, 0.7)})`,
  ].join(' ');

  const trailDash = cycleKeyframes([1, 0], [0, 1], 0, flightFrac);
  const trailOpacity = cycleKeyframes(['1', '0'], [0, 1], flightFrac, trailFadeMs / cycleMs);
  const shellOpacity = cycleKeyframes(['1', '0'], [0, 1], flightFrac, 150 / cycleMs);
  const gradientId = `arty-trail-${gradId}`;

  return (
    <g pointerEvents="none">
      <defs>
        {/* Oriented along the straight origin -> target line rather than
            following the arc itself — since the trail is only ever
            drawn from the origin up to wherever the shell currently is,
            this still reads as "dim at the tail (origin end), bright
            right behind the shell (target end)" the whole way along the
            curve, continuously, instead of the old approach of a
            uniform-opacity line that only faded as a single block after
            impact. */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={originPt.x} y1={originPt.y} x2={targetPt.x} y2={targetPt.y}>
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="60%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Trail — a single continuous stroke that "draws itself" along
          the arc as the shell flies (stroke-dashoffset 1 -> 0, using
          pathLength="1" so the dash math works in a 0-1 unit space
          regardless of the path's real on-screen length), coloured by
          the gradient above so it's always dimmest at the tail end and
          brightest right behind the shell's head. Fades out quickly
          once the shell lands rather than lingering. */}
      <path
        d={arc.path}
        pathLength="1"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={Math.max(1.5, hexSize * 0.075)}
        strokeLinecap="round"
        strokeDasharray="1"
        style={{ filter: glowFilter }}
      >
        <animate attributeName="stroke-dashoffset" values={trailDash.values} keyTimes={trailDash.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values={trailOpacity.values} keyTimes={trailOpacity.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
      </path>

      {/* Launch burst — small and quick, at the origin. */}
      <ArtilleryBurst cx={originPt.x} cy={originPt.y} hexSize={hexSize} color={color} coreColor={coreColor} scale={0.3} cycleS={cycleS} startFrac={0} durFrac={launchBurstMs / cycleMs} />

      {/* The shell — a small bright capsule that orients along the
          arc's tangent (rotate="auto") as it travels, riding
          keyPoints/keyTimes on animateMotion so it covers the whole
          path during the flight fraction of the cycle and then just
          sits at the target, invisible, through the pause before the
          cycle loops back to the origin. */}
      <g opacity="0">
        <animate attributeName="opacity" values={shellOpacity.values} keyTimes={shellOpacity.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
        <ellipse
          cx={0}
          cy={0}
          rx={hexSize * 0.16}
          ry={hexSize * 0.065}
          fill={coreColor}
          stroke={lightenColor(color, -0.2)}
          strokeWidth={Math.max(0.5, hexSize * 0.02)}
          style={{ filter: glowFilter }}
        >
          <animateMotion
            path={arc.path}
            keyPoints={`0;1;1`}
            keyTimes={`0;${flightFrac};1`}
            calcMode="linear"
            dur={`${cycleS}s`}
            repeatCount="indefinite"
            rotate="auto"
          />
        </ellipse>
      </g>

      {/* Impact burst — a touch bigger than the launch puff and slower
          to fade, at the target, timed to the shell's arrival. */}
      <ArtilleryBurst cx={targetPt.x} cy={targetPt.y} hexSize={hexSize} color={color} coreColor={coreColor} scale={0.65} cycleS={cycleS} startFrac={flightFrac} durFrac={impactBurstMs / cycleMs} />
    </g>
  );
}

// One-shot-per-cycle burst: expanding shockwave ring + glow flash +
// white-hot core — same three-layer look as HexTile's Battle Effect
// explosions, just parameterised by position/size/timing (and slotted
// into a shared cycle via cycleKeyframes) instead of being hex-anchored
// and running on its own independent loop.
function ArtilleryBurst({ cx, cy, hexSize, color, coreColor, scale, cycleS, startFrac, durFrac }) {
  const glowFilter = [
    `drop-shadow(0 0 3px ${hexToRgba(lightenColor(color, 0.3), 0.95)})`,
    `drop-shadow(0 0 8px ${hexToRgba(color, 0.75)})`,
    `drop-shadow(0 0 16px ${hexToRgba(lightenColor(color, -0.3), 0.45)})`,
  ].join(' ');
  const R = hexSize * scale;

  const ringR = cycleKeyframes([0, R * 0.25, R, R], [0, 0.15, 0.6, 1], startFrac, durFrac);
  const ringOpacity = cycleKeyframes([0, 0.6, 0, 0], [0, 0.15, 0.5, 1], startFrac, durFrac);
  const glowR = cycleKeyframes([0, R * 0.7, R * 0.35, 0], [0, 0.18, 0.45, 1], startFrac, durFrac);
  const glowOpacity = cycleKeyframes([0, 0.9, 0.4, 0], [0, 0.18, 0.45, 1], startFrac, durFrac);
  const coreR = cycleKeyframes([0, R * 0.32, R * 0.08, 0], [0, 0.12, 0.3, 1], startFrac, durFrac);
  const coreOpacity = cycleKeyframes([0, 1, 0.5, 0], [0, 0.12, 0.3, 1], startFrac, durFrac);

  return (
    <g style={{ filter: glowFilter }}>
      <circle cx={cx} cy={cy} r="0" fill="none" stroke={color} strokeWidth={1.5} opacity="0">
        <animate attributeName="r" values={ringR.values} keyTimes={ringR.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values={ringOpacity.values} keyTimes={ringOpacity.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r="0" fill={color} opacity="0">
        <animate attributeName="r" values={glowR.values} keyTimes={glowR.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values={glowOpacity.values} keyTimes={glowOpacity.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r="0" fill={coreColor} opacity="0">
        <animate attributeName="r" values={coreR.values} keyTimes={coreR.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values={coreOpacity.values} keyTimes={coreOpacity.keyTimes} dur={`${cycleS}s`} repeatCount="indefinite" />
      </circle>
    </g>
  );
}

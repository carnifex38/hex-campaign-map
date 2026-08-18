import React, { useId, useMemo } from 'react';
import { hexToPixel, parseKey, hexToRgba, lightenColor, cycleKeyframes } from '../../utils/hexMath.js';
import { useMapState } from '../../state/MapContext.jsx';

// Deterministic 0-1 "random" from a seed — same idea as HexTile's
// Battle Effect explosions, used here for the impact sparks, each
// firing's sweep direction, and each hex's own random phase offset so
// several firing at once don't all land in lockstep.
function seededRandom(seed) {
  const v = Math.sin(seed) * 10000;
  return v - Math.floor(v);
}

// How many different sweep directions a hex cycles through before
// repeating — SMIL can't pick a genuinely new random value on every
// loop, so instead each hex gets this many pre-rolled random
// directions and fires through them in sequence, which reads as
// "random" without ever repeating the same direction twice in a row.
const SWEEP_VARIANTS = 4;

// A passive, indefinitely-looping Orbital Laser Strike — same "pick it
// and it just plays" idea as every other Battle Effect, but rendered
// from HexMapCanvas's final pass instead of from inside HexTile (like
// Artillery Strike) since the beam reaches well outside the target
// tile's own outline. One firing sequence: a thin line extends
// straight down from directly overhead -> on arrival a glow grows out
// from where it hit (no glow before that — the line has to land
// first) -> the now-lit contact point (glow, sparks, shadow) drags
// across the hex in a randomly-chosen direction, a scorch trail
// growing right behind it -> the beam fades away -> the scorch trail
// lingers a while longer, cooling out of view, before it fires again —
// cycling through a handful of pre-rolled sweep directions so it never
// drags the same way twice running. Each hex's whole sequence is also
// phase-shifted by its own random offset so multiple strikes never
// look synchronised.
export default function OrbitalLaserStrike({ targetKey, hexSize }) {
  const state = useMapState();
  const beamGradId = useId();
  const shadowGradId = useId();
  const scorchGradBaseId = useId();

  const { originPt, targetPt, sweepVariants, seed } = useMemo(() => {
    const t = parseKey(targetKey);
    const targetPt = hexToPixel(t.c, t.r, hexSize);
    // Straight down from directly overhead — no angle to aim, the
    // beam always comes from "orbit" along the same vertical line as
    // the target.
    const originPt = { x: targetPt.x, y: targetPt.y - hexSize * 3.2 };
    const seed = Math.round(targetPt.x * 131 + targetPt.y * 977);
    // A handful of pre-rolled directions/distances (seeded off the hex,
    // so they're fixed for this hex rather than reshuffling every
    // render) the contact point drags to once it lands, one per firing
    // in rotation — each stays roughly within the tile.
    const sweepVariants = Array.from({ length: SWEEP_VARIANTS }, (_, i) => {
      const s = seed + i * 6151 + 3301;
      const angle = seededRandom(s) * Math.PI * 2;
      const dist = hexSize * (0.3 + seededRandom(s + 1) * 0.35);
      return { x: targetPt.x + Math.cos(angle) * dist, y: targetPt.y + Math.sin(angle) * dist };
    });
    return { originPt, targetPt, sweepVariants, seed };
  }, [targetKey, hexSize]);

  const color = state.laserColor || '#5ec8ff';
  const coreColor = lightenColor(color, 0.85);
  const beamHalf = Math.max(1, hexSize * 0.045);

  const glowFilter = [
    `drop-shadow(0 0 3px ${hexToRgba(coreColor, 0.95)})`,
    `drop-shadow(0 0 9px ${hexToRgba(color, 0.8)})`,
  ].join(' ');
  const softGlowFilter = `drop-shadow(0 0 5px ${hexToRgba(color, 0.7)})`;

  // The freshly-dragged scorch trail's own colour, independent of the
  // beam's (laser colour is GM-tunable and could be any hue; melted
  // ground glows the same warm white-orange regardless) — molten and
  // bright right as it's laid down, cooling to nothing shortly after
  // the drag stops, leaving just the permanent black scorch line
  // underneath (see meltOpacity below) rather than lingering hot.
  const meltColor = '#ffcf82';
  const meltGlowFilter = ['drop-shadow(0 0 3px rgba(255,214,150,0.95))', 'drop-shadow(0 0 7px rgba(255,140,40,0.65))'].join(' ');

  // ---- Timing (one firing) ----
  // extend: thin line travels down to the target.
  // grow: the glow/sparks/shadow appear right where it landed.
  // sweep: that lit contact point drags to this firing's sweep target;
  //        the scorch trail grows right behind it over the same window.
  // vanish: beam, glow, sparks and shadow fade away.
  // The molten trail stays hot for as long as the beam itself is
  // visible (right through vanish), then cools; the black scorch it
  // leaves behind lingers a little longer than that before fading too
  // — see meltWindowMs/scorchWindowMs below — then a pause, then the
  // next firing (the next sweep variant in rotation) begins. Fire
  // rate is GM-tunable (Display Settings' Orbital Laser Strike
  // section) as a multiplier on that pause.
  const extendMs = 400;
  const growMs = 300;
  const sweepMs = 700;
  const vanishMs = 900;
  const beamTotalMs = extendMs + growMs + sweepMs + vanishMs;
  // How long the molten trail stays glowing-hot after the beam itself
  // vanishes before it starts cooling, and how long that cooldown
  // takes — it's lit for the whole time the beam is (through vanish),
  // not just while actively dragging.
  const meltFadeMs = 450;
  const meltWindowMs = beamTotalMs - extendMs + meltFadeMs;
  // The black scorch stays a little longer still after the glow's
  // finished cooling, then fades away itself.
  const scorchLingerMs = 350;
  const scorchFadeMs = 500;
  const scorchWindowMs = meltWindowMs + scorchLingerMs + scorchFadeMs;
  const freqMult = Math.max(0.1, state.laserFrequency ?? 1);
  const pauseMs = 1100 / freqMult;
  const cycleMs = extendMs + scorchWindowMs + pauseMs;
  const cycleS = cycleMs / 1000;
  const extendFrac = extendMs / cycleMs;
  const beamTotalFrac = beamTotalMs / cycleMs;
  // Local fractions within one firing's own extend->grow->sweep->vanish
  // span, fed through cycleKeyframes the same way every other effect's
  // multi-phase animations in this app are.
  const extendLocal = extendMs / beamTotalMs;
  const growEndLocal = (extendMs + growMs) / beamTotalMs;
  const sweepEndLocal = (extendMs + growMs + sweepMs) / beamTotalMs;

  // One firing's worth of timing (above) repeated SWEEP_VARIANTS times
  // back to back, each repetition using the next pre-rolled sweep
  // direction, is what actually loops. `superFrac`/`superStart` rescale
  // a fraction that was written relative to a single firing's cycleMs
  // into the right slice of that longer super-cycle.
  const superCycleS = cycleS * SWEEP_VARIANTS;
  const superFrac = (localFrac) => localFrac / SWEEP_VARIANTS;
  const superStart = (variantIndex, localStart) => variantIndex / SWEEP_VARIANTS + localStart / SWEEP_VARIANTS;

  // Every hex's whole sequence starts at a different point in its own
  // super-cycle (a negative SMIL `begin` just starts the animation
  // already partway through), so several strikes never fire in visible
  // unison.
  const phaseBeginS = (-seededRandom(seed + 999) * superCycleS).toFixed(3);

  // Travelling pulse rings — a flattened ellipse (wide across, thin
  // along the beam) reads as "a ring seen edge-on" with no rotation
  // math needed, whichever way the beam happens to be tilted.
  const ringRX = beamHalf + hexSize * 0.008;
  const ringRY = hexSize * 0.022;
  // How much of the beam's own length its fade-off gradient covers
  // (see beamGradId below) — rings fade in over the same fraction of
  // their own travel so they brighten in step with the beam itself.
  const beamFadeFrac = (hexSize * 1.3) / (hexSize * 3.2);

  // Where the beam's own tip (lineX2/lineY2 below) sits at a given
  // local time within one firing — origin->target while extending,
  // held at target through the grow pulse, then target->sweepEnd
  // while dragging, held there through vanish. The *rendered* beam is
  // always a single straight line from the (fixed) origin to wherever
  // this currently is, so a ring is only ever really "on the beam" if
  // its own position is some fraction of the way along *that same,
  // currently-correct* line — not a fixed point computed once, since
  // the far end keeps moving while a ring is still travelling toward
  // it (see buildTravelPath below).
  const tipPositionAtLocal = (t, sweepEndPt) => {
    if (t <= extendLocal) {
      const f = extendLocal > 0 ? t / extendLocal : 1;
      return { x: originPt.x + (targetPt.x - originPt.x) * f, y: originPt.y + (targetPt.y - originPt.y) * f };
    }
    if (t <= growEndLocal) return { x: targetPt.x, y: targetPt.y };
    if (t <= sweepEndLocal) {
      const f = (t - growEndLocal) / (sweepEndLocal - growEndLocal || 1);
      return { x: targetPt.x + (sweepEndPt.x - targetPt.x) * f, y: targetPt.y + (sweepEndPt.y - targetPt.y) * f };
    }
    return { x: sweepEndPt.x, y: sweepEndPt.y };
  };

  // A particle travelling from the origin to "wherever the tip will be
  // when it gets there" over its own [startAt, endAt] window, sampled
  // at several points along the way. At each sample, the on-line point
  // is originPt + progress * (tipPositionAtLocal(thatSample's own
  // time) - originPt) — i.e. always some fraction of the way along the
  // origin -> *current* tip line, which is by construction exactly
  // where the beam itself is at that instant, however it's tilted.
  // Enough samples (rather than just start/end) keeps it glued to the
  // line even while the tip is moving out from under it during a
  // sweep, instead of cutting a straight shortcut between two points
  // that stops matching the beam the moment the tip moves on.
  // `sideOffset` nudges each sample perpendicular to the beam's own
  // current direction at that instant — 0 rides right on the line
  // (the stream rings), non-zero rides alongside it at a constant
  // distance, correctly turning together with the beam through a
  // sweep instead of staying fixed to the direction it started on
  // (the side particles below).
  const travelSamples = 8;
  const buildTravelPath = (startAt, endAt, sweepEndPt, sideOffset = 0) => {
    const cxVals = [];
    const cyVals = [];
    const kts = [];
    const sample = (localT, progress) => {
      const tip = tipPositionAtLocal(localT, sweepEndPt);
      const dx = tip.x - originPt.x;
      const dy = tip.y - originPt.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      return { x: originPt.x + progress * dx + px * sideOffset, y: originPt.y + progress * dy + py * sideOffset };
    };
    if (startAt > 0) {
      const p0 = sample(0, 0);
      cxVals.push(p0.x);
      cyVals.push(p0.y);
      kts.push(0);
    }
    for (let k = 0; k <= travelSamples; k++) {
      const progress = k / travelSamples;
      const localT = startAt + (endAt - startAt) * progress;
      const p = sample(localT, progress);
      cxVals.push(p.x);
      cyVals.push(p.y);
      kts.push(localT);
    }
    if (endAt < 1) {
      cxVals.push(cxVals[cxVals.length - 1]);
      cyVals.push(cyVals[cyVals.length - 1]);
      kts.push(1);
    }
    return { cxVals, cyVals, kts };
  };

  // Spark flecks scattered right around the glow circle's own edge
  // (mostly inside it, a little poking out), each flickering on its
  // own independent, seeded timing. Geometry is relative to wherever
  // the contact point currently is, not to any particular sweep
  // direction, so the same set is reused across every variant.
  const buildSparks = (seedBase, count, ringR) =>
    Array.from({ length: count }, (_, i) => {
      const s = seedBase + i * 71;
      const angle = seededRandom(s) * Math.PI * 2;
      const dist = ringR * (0.88 + seededRandom(s + 1) * 0.2);
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      const len = hexSize * (0.025 + seededRandom(s + 2) * 0.035);
      const dx = (Math.cos(angle) * len) / 2;
      const dy = (Math.sin(angle) * len) / 2;
      const dur = 0.5 + seededRandom(s + 3) * 1.1;
      const begin = seededRandom(s + 4) * dur;
      return { key: i, x1: px - dx, y1: py - dy, x2: px + dx, y2: py + dy, dur, begin };
    });
  const impactCoreR = hexSize * 0.13;
  const impactSparks = useMemo(() => buildSparks(seed + 500, 8, impactCoreR), [seed, impactCoreR]);

  // Shadow — a short diagonal line near the (moving) contact point,
  // fading to nothing at both of its own ends, relative to the
  // original touchdown point (each variant's own drag translate below
  // carries it along once that firing's sweep starts).
  const shadowA = { x: targetPt.x - hexSize * 0.05, y: targetPt.y + hexSize * 0.08 };
  const shadowB = { x: targetPt.x + hexSize * 0.55, y: targetPt.y - hexSize * 0.75 };

  return (
    <g pointerEvents="none">
      <defs>
        {/* The "gradient fall off, like it's coming from the sky" look
            at the origin end — the beam fades in from nothing instead
            of having a defined start point. */}
        <linearGradient id={beamGradId} gradientUnits="userSpaceOnUse" x1={originPt.x} y1={originPt.y} x2={originPt.x} y2={originPt.y + hexSize * 1.3}>
          <stop offset="0%" stopColor={coreColor} stopOpacity="0" />
          <stop offset="100%" stopColor={coreColor} stopOpacity="1" />
        </linearGradient>
        {/* Grounding shadow's own fade — transparent at both ends of
            its line, darkest in the middle. */}
        <linearGradient id={shadowGradId} gradientUnits="userSpaceOnUse" x1={shadowA.x} y1={shadowA.y} x2={shadowB.x} y2={shadowB.y}>
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="50%" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        {/* Scorch trail's own fade, one per sweep variant since each
            one ends up pointing a different way. */}
        {sweepVariants.map((sweepEnd, i) => (
          <linearGradient key={i} id={`${scorchGradBaseId}-${i}`} gradientUnits="userSpaceOnUse" x1={targetPt.x} y1={targetPt.y} x2={sweepEnd.x} y2={sweepEnd.y}>
            <stop offset="0%" stopColor="#050608" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#050608" stopOpacity="0.9" />
          </linearGradient>
        ))}
      </defs>

      {sweepVariants.map((sweepEnd, i) => {
        const sweepDX = sweepEnd.x - targetPt.x;
        const sweepDY = sweepEnd.y - targetPt.y;
        const vStart = (localFrac) => superStart(i, localFrac);
        const vDur = (localFrac) => superFrac(localFrac);

        // Beam core line — x1/y1 stay anchored at the origin; x2/y2
        // carry all the motion: growing down to the target while
        // extending, held there through the grow pulse, then dragged
        // to this variant's sweep end, then held again while vanish
        // fades everything out.
        const lineX2 = cycleKeyframes([originPt.x, targetPt.x, targetPt.x, sweepEnd.x, sweepEnd.x], [0, extendLocal, growEndLocal, sweepEndLocal, 1], vStart(0), vDur(beamTotalFrac));
        const lineY2 = cycleKeyframes([originPt.y, targetPt.y, targetPt.y, sweepEnd.y, sweepEnd.y], [0, extendLocal, growEndLocal, sweepEndLocal, 1], vStart(0), vDur(beamTotalFrac));
        const beamOpacity = cycleKeyframes(['1', '1', '0'], [0, sweepEndLocal, 1], vStart(0), vDur(beamTotalFrac));

        // Glow circle — invisible (zero radius) until the line
        // actually lands, then grows in, then tracks the same drag the
        // line's bottom end does.
        const circleR = cycleKeyframes([0, 0, impactCoreR, impactCoreR], [0, extendLocal, growEndLocal, 1], vStart(0), vDur(beamTotalFrac));
        const circleCx = cycleKeyframes([targetPt.x, targetPt.x, sweepEnd.x, sweepEnd.x], [0, growEndLocal, sweepEndLocal, 1], vStart(0), vDur(beamTotalFrac));
        const circleCy = cycleKeyframes([targetPt.y, targetPt.y, sweepEnd.y, sweepEnd.y], [0, growEndLocal, sweepEndLocal, 1], vStart(0), vDur(beamTotalFrac));

        // Sparks/shadow — fixed offsets from the original touchdown
        // point, carried along by one shared translate once the drag
        // starts, gated invisible until the glow itself has grown in.
        const dragTranslate = cycleKeyframes(['0,0', '0,0', `${sweepDX},${sweepDY}`, `${sweepDX},${sweepDY}`], [0, growEndLocal, sweepEndLocal, 1], vStart(0), vDur(beamTotalFrac));
        const growGateOpacity = cycleKeyframes(['0', '0', '1'], [0, extendLocal, growEndLocal], vStart(0), vDur(beamTotalFrac));

        // Stream rings — a steady procession of rings travelling down
        // the beam's own line from the origin toward the contact
        // point, each just a delayed one-shot trip, staggered closely
        // enough that several are always mid-flight — reads as a
        // continuous flow of energy down the beam for as long as this
        // firing is actually active (through the sweep too, not just
        // the initial extend), rather than a ring trailing after the
        // glow like a comet's tail. A ring that's still travelling
        // when the sweep drags the contact point sideways follows
        // *that* real line (see buildTravelPath above), not the
        // straight-down line the beam started on, so it never ends up
        // floating off to the side of wherever the beam actually is
        // now. Being driven by this variant's own real timing (not an
        // independent clock) means they can never end up on screen
        // while this variant's firing isn't actually the one active.
        const streamCoverage = sweepEndLocal;
        const streamTravelDur = extendLocal;
        const streamRingCount = 5;
        const streamLagStep = streamRingCount > 1 ? (streamCoverage - streamTravelDur) / (streamRingCount - 1) : 0;
        const streamRings = Array.from({ length: streamRingCount }, (_, idx) => {
          const startAt = idx * streamLagStep;
          const endAt = Math.min(1, startAt + streamTravelDur);
          const path = buildTravelPath(startAt, endAt, sweepEnd);
          const cx = cycleKeyframes(path.cxVals, path.kts, vStart(0), vDur(beamTotalFrac));
          const cy = cycleKeyframes(path.cyVals, path.kts, vStart(0), vDur(beamTotalFrac));
          const fadeInAt = Math.min(endAt, startAt + (endAt - startAt) * beamFadeFrac);
          const opacity = cycleKeyframes(
            ['0', '0', '0.9', '0.9', '0'],
            [0, startAt, fadeInAt, Math.max(startAt, endAt - 0.01), endAt],
            vStart(0),
            vDur(beamTotalFrac)
          );
          return { cx, cy, opacity };
        });

        // Side particles — tiny white flecks travelling down either
        // side of the main beam, same tip-tracking trick as the stream
        // rings (see buildTravelPath) just offset a small constant
        // distance perpendicular to wherever the beam currently points,
        // so they turn with it through a sweep instead of drifting off
        // at the angle the beam started on. Each one's own start is
        // nudged by a small seeded jitter so the two sides don't read
        // as a perfectly even, mechanical pair of rows.
        // Riding right up close against the beam's own edge, and kept
        // fine — a tight scatter of small flecks hugging the line
        // rather than a wider halo of bigger sparks.
        const sideParticleR = Math.max(0.6, hexSize * 0.011);
        const sideParticleOffset = Math.max(hexSize * 0.025, 2.5);
        const sideParticlesPerSide = 5;
        const sideLagStep = sideParticlesPerSide > 1 ? (streamCoverage - streamTravelDur) / (sideParticlesPerSide - 1) : 0;
        const buildSideParticles = (sign) =>
          Array.from({ length: sideParticlesPerSide }, (_, idx) => {
            const jitter = (seededRandom(seed + i * 401 + sign * 173 + idx * 61) - 0.5) * sideLagStep * 0.6;
            const startAt = Math.max(0, Math.min(streamCoverage - streamTravelDur, idx * sideLagStep + jitter));
            const endAt = Math.min(1, startAt + streamTravelDur);
            const path = buildTravelPath(startAt, endAt, sweepEnd, sign * sideParticleOffset);
            const cx = cycleKeyframes(path.cxVals, path.kts, vStart(0), vDur(beamTotalFrac));
            const cy = cycleKeyframes(path.cyVals, path.kts, vStart(0), vDur(beamTotalFrac));
            const fadeInAt = Math.min(endAt, startAt + (endAt - startAt) * beamFadeFrac);
            const opacity = cycleKeyframes(
              ['0', '0', '0.9', '0.9', '0'],
              [0, startAt, fadeInAt, Math.max(startAt, endAt - 0.01), endAt],
              vStart(0),
              vDur(beamTotalFrac)
            );
            return { cx, cy, opacity };
          });
        const sideParticles = [...buildSideParticles(-1), ...buildSideParticles(1)];

        // Scorch trail — grows from the original touchdown point to
        // this variant's sweep end, in step with the drag, then keeps
        // fading for a while after the beam itself is gone.
        const scorchX2 = cycleKeyframes([targetPt.x, sweepEnd.x], [0, 1], vStart(extendFrac + growMs / cycleMs), vDur(sweepMs / cycleMs));
        const scorchY2 = cycleKeyframes([targetPt.y, sweepEnd.y], [0, 1], vStart(extendFrac + growMs / cycleMs), vDur(sweepMs / cycleMs));

        // Melt overlay — the same growing trail, laid right on top of
        // the black scorch line in a hot molten colour, so freshly
        // dragged ground reads as glowing rather than instantly black.
        // Stays hot for as long as the beam itself is visible (through
        // its own vanish fade, see meltWindowMs above), then cools away
        // over meltFadeMs — uncovering the black scorch underneath
        // shortly after the beam is gone, rather than cooling early
        // while the beam's still there or lingering hot indefinitely.
        const meltHoldEndLocal = (beamTotalMs - extendMs) / meltWindowMs;
        const meltOpacity = cycleKeyframes(
          ['0', '0.95', '0.95', '0'],
          [0, Math.min(0.05, meltHoldEndLocal), meltHoldEndLocal, 1],
          vStart(extendFrac),
          vDur(meltWindowMs / cycleMs)
        );

        // The black scorch itself stays a little longer than that
        // after the glow's finished cooling, then fades away too — so
        // both the molten look and the mark it leaves behind are gone
        // shortly after the main beam vanishes, instead of a long
        // separate tail running on its own unrelated clock.
        const scorchHoldEndLocal = (meltWindowMs + scorchLingerMs) / scorchWindowMs;
        const scorchOpacity = cycleKeyframes(
          [0, 0.85, 0.85, 0],
          [0, Math.min(0.03, scorchHoldEndLocal), scorchHoldEndLocal, 1],
          vStart(extendFrac),
          vDur(scorchWindowMs / cycleMs)
        );

        return (
          <React.Fragment key={i}>
            {/* Scorch trail — outlives the rest of this firing, fading
                out slowly on its own. */}
            <line x1={targetPt.x} y1={targetPt.y} strokeWidth={hexSize * 0.1} strokeLinecap="round" stroke={`url(#${scorchGradBaseId}-${i})`} opacity="0" style={{ filter: `drop-shadow(0 0 3px ${hexToRgba(color, 0.35)})` }}>
              <animate attributeName="x2" values={scorchX2.values} keyTimes={scorchX2.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
              <animate attributeName="y2" values={scorchY2.values} keyTimes={scorchY2.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values={scorchOpacity.values} keyTimes={scorchOpacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
            </line>

            {/* Molten overlay — same growing geometry as the scorch
                trail, painted on top of it, hot while fresh then
                cooling away to reveal the black scorch it leaves
                behind. */}
            <line x1={targetPt.x} y1={targetPt.y} strokeWidth={hexSize * 0.065} strokeLinecap="round" stroke={meltColor} opacity="0" style={{ filter: meltGlowFilter }}>
              <animate attributeName="x2" values={scorchX2.values} keyTimes={scorchX2.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
              <animate attributeName="y2" values={scorchY2.values} keyTimes={scorchY2.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values={meltOpacity.values} keyTimes={meltOpacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
            </line>

            {/* Everything below only exists while this variant's
                firing is actually in flight. */}
            <g opacity="0">
              <animate attributeName="opacity" values={beamOpacity.values} keyTimes={beamOpacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />

              {/* Beam core — the thin white line hits first; nothing
                  else appears until it lands (see the grow-gated glow/
                  sparks/shadow below). */}
              <line x1={originPt.x} y1={originPt.y} x2={originPt.x} y2={originPt.y} stroke={`url(#${beamGradId})`} strokeWidth={beamHalf * 2} strokeLinecap="round" style={{ filter: glowFilter }}>
                <animate attributeName="x2" values={lineX2.values} keyTimes={lineX2.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                <animate attributeName="y2" values={lineY2.values} keyTimes={lineY2.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
              </line>

              {/* Glow — grows out from the point of impact once the
                  line actually lands there, then drags along with it. */}
              <circle r="0" fill={coreColor} style={{ filter: glowFilter }}>
                <animate attributeName="r" values={circleR.values} keyTimes={circleR.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                <animate attributeName="cx" values={circleCx.values} keyTimes={circleCx.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={circleCy.values} keyTimes={circleCy.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
              </circle>

              {/* Stream rings — travel the beam's own fixed
                  origin->target span (see streamRings above), painted
                  after (on top of) the glow circle so the ones
                  arriving right as the glow is centred on that same
                  point don't get buried under its opaque fill. This
                  span never tilts even once the contact point below it
                  starts dragging, so no rotation is needed — the
                  ellipse's own built-in "ring seen edge-on" shape
                  already matches straight down. */}
              {streamRings.map((ring, ringIdx) => (
                <ellipse key={ringIdx} rx={ringRX} ry={ringRY} fill="none" stroke={coreColor} strokeWidth={Math.max(1, hexSize * 0.018)} opacity="0" style={{ filter: glowFilter }}>
                  <animate attributeName="cx" values={ring.cx.values} keyTimes={ring.cx.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                  <animate attributeName="cy" values={ring.cy.values} keyTimes={ring.cy.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values={ring.opacity.values} keyTimes={ring.opacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                </ellipse>
              ))}

              {/* Side particles — tiny white flecks flanking the beam
                  (see sideParticles above), same tip-tracking path as
                  the stream rings just offset to either side. */}
              {sideParticles.map((p, pIdx) => (
                <circle key={pIdx} r={sideParticleR} fill="#ffffff" opacity="0" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.95))' }}>
                  <animate attributeName="cx" values={p.cx.values} keyTimes={p.cx.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                  <animate attributeName="cy" values={p.cy.values} keyTimes={p.cy.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values={p.opacity.values} keyTimes={p.opacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                </circle>
              ))}

              {/* Sparks + shadow — geometry fixed relative to the
                  original touchdown point, carried along by one shared
                  drag once the sweep starts, gated invisible until the
                  glow has grown in. */}
              <g opacity="0" transform={`translate(${targetPt.x},${targetPt.y})`}>
                <animate attributeName="opacity" values={growGateOpacity.values} keyTimes={growGateOpacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="translate" additive="sum" values={dragTranslate.values} keyTimes={dragTranslate.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                {impactSparks.map((s) => (
                  <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={coreColor} strokeWidth={Math.max(0.75, hexSize * 0.02)} strokeLinecap="round" opacity="0" style={{ filter: softGlowFilter }}>
                    <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.3;1" dur={`${s.dur}s`} begin={`${s.begin}s`} repeatCount="indefinite" />
                  </line>
                ))}
              </g>
              <g opacity="0">
                <animate attributeName="opacity" values={growGateOpacity.values} keyTimes={growGateOpacity.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="translate" values={dragTranslate.values} keyTimes={dragTranslate.keyTimes} dur={`${superCycleS}s`} begin={`${phaseBeginS}s`} repeatCount="indefinite" />
                <line x1={shadowA.x} y1={shadowA.y} x2={shadowB.x} y2={shadowB.y} stroke={`url(#${shadowGradId})`} strokeWidth={hexSize * 0.09} strokeLinecap="round" />
              </g>
            </g>
          </React.Fragment>
        );
      })}
    </g>
  );
}

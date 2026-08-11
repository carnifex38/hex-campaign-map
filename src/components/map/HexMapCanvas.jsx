import React, { useEffect, useMemo, useState } from 'react';
import { calcHexSize, gridPixelSize, key, hexToPixel, hexPoints, parseKey, pixelToHex, arrowGeometry } from '../../utils/hexMath.js';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { MOVEMENT_LINE_COLOR } from '../../state/mapReducer.js';
import { useContainerSize } from '../../hooks/useContainerSize.js';
import { useZoomPan } from '../../hooks/useZoomPan.js';
import HexTile from './HexTile.jsx';
import ZoomControls from './ZoomControls.jsx';
import MovementControls from './MovementControls.jsx';
import SectorContestModal from './SectorContestModal.jsx';
import HexInfoPopup from './HexInfoPopup.jsx';

export default function HexMapCanvas() {
  const state = useMapState();
  const actions = useMapActions();
  const { isDisconnected, resolveHexColor } = useMapSelectors();
  const [wrapRef, size] = useContainerSize();
  // Drag-to-draw a movement arrow is purely local UI state while it's
  // in progress — it only ever becomes real map data (a movementLine)
  // once the drag completes on mouseup, via CREATE_MOVEMENT_LINE.
  const [dragArrow, setDragArrow] = useState(null); // { fromKey, currentPt } | null
  const movementActive = state.movementMode !== 'none';
  const { scale, offset, containerRef, handlers, zoomIn, zoomOut, resetView } = useZoomPan({ disabled: movementActive });

  // Escape backs out of whichever movement tool is active — same as
  // clicking its button again (SET_MOVEMENT_MODE toggles off when you
  // pass the mode that's already active), plus it drops any arrow
  // that's mid-drag rather than leaving it half-drawn.
  useEffect(() => {
    if (!movementActive) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setDragArrow(null);
      actions.setMovementMode(state.movementMode);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [movementActive, state.movementMode, actions]);

  const hexSize = useMemo(
    () => calcHexSize(state.cols, state.rows, size.width || 800, size.height || 600),
    [state.cols, state.rows, size.width, size.height]
  );
  const { width: svgWidth, height: svgHeight } = useMemo(
    () => gridPixelSize(state.cols, state.rows, hexSize),
    [state.cols, state.rows, hexSize]
  );

  const cells = useMemo(() => {
    const out = [];
    for (let c = 0; c < state.cols; c++) {
      for (let r = 0; r < state.rows; r++) {
        out.push({ c, r, k: key(c, r) });
      }
    }
    return out;
  }, [state.cols, state.rows]);

  // Merge our two refs (container-size measurement + zoom/pan) onto the
  // same wrapper element.
  const setRefs = (el) => {
    wrapRef.current = el;
    containerRef.current = el;
  };

  // In Erase mode, hex clicks still feed the arrow tool (drop any line
  // touching the clicked hex) — Draw mode no longer reacts to plain
  // clicks at all now that it's a drag gesture (see the mouse handlers
  // below), so a click there is just a no-op.
  const handleHexClick = (k, additive) => {
    if (state.movementMode === 'erase') actions.movementHexClick(k);
    else if (!movementActive) actions.selectHex(k, additive);
  };

  // Mouse coordinates come in as viewport pixels; the grid lives inside
  // a div that's translated by `offset` and scaled by `scale` (see the
  // transform below), so undo both to land in the SVG's own coordinate
  // space — the same space hexToPixel/hexPoints/arrowGeometry work in.
  const toSvgPoint = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  };

  const handleCanvasMouseDown = (e) => {
    // The Hex Info Popup's inputs/textareas/selects live inside this
    // same wrapper, so their mousedown events bubble up here too —
    // bail out before preventDefault() below, which would otherwise
    // block the browser's default focus/open behaviour for them
    // (silently breaking typing and dropdowns).
    if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON'].includes(e.target.tagName)) return;

    // Without this, dragging across the grid triggers the browser's
    // native text-selection instead (it highlights every hex's
    // coordinate label along the drag path) since those are real SVG
    // <text> nodes — harmless to the data, but it looks like the whole
    // map is glitching out. `user-select: none` on the wrapper (below)
    // is the belt-and-braces backup for this same thing.
    e.preventDefault();
    handlers.onMouseDown(e); // no-ops while movementActive (see useZoomPan's `disabled`)
    if (state.movementMode !== 'draw') return;
    const pt = toSvgPoint(e);
    const hexKey = pixelToHex(pt.x, pt.y, state.cols, state.rows, hexSize);
    if (!hexKey) return;
    // Arrows can only start from a hex that's actually claimed — "a
    // controlling sector" — so grabbing an empty/unclaimed hex just
    // doesn't begin a drag at all.
    if (!resolveHexColor(state.hexData[hexKey])) return;
    setDragArrow({ fromKey: hexKey, currentPt: pt });
  };

  const handleCanvasMouseMove = (e) => {
    handlers.onMouseMove(e);
    if (!dragArrow) return;
    setDragArrow((d) => (d ? { ...d, currentPt: toSvgPoint(e) } : d));
  };

  const handleCanvasMouseUp = (e) => {
    handlers.onMouseUp(e);
    if (!dragArrow) return;
    const pt = toSvgPoint(e);
    const hexKey = pixelToHex(pt.x, pt.y, state.cols, state.rows, hexSize);
    setDragArrow(null);
    if (hexKey && hexKey !== dragArrow.fromKey) actions.createMovementLine(dragArrow.fromKey, hexKey);
  };

  const canvasCursor = state.movementMode === 'draw' ? 'crosshair' : state.movementMode === 'erase' ? 'not-allowed' : 'grab';

  return (
    <div
      ref={setRefs}
      className="hex-canvas-wrap"
      onWheel={handlers.onWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        cursor: canvasCursor,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          width: svgWidth,
          height: svgHeight,
          margin: 24,
        }}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <defs>
            {/* Subtle "cut off from supply" treatment: a soft darken plus
                fine diagonal lines, rotated onto a small tiled pattern so
                it reads at any hex size without per-tile computation. */}
            <pattern
              id="disconnected-hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="7" height="7" fill="rgba(0,0,0,0.32)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(0,0,0,0.28)" strokeWidth="2" />
            </pattern>
          </defs>
          {cells.map(({ c, r, k }) => (
            <HexTile
              key={k}
              c={c}
              r={r}
              hexSize={hexSize}
              entry={state.hexData[k]}
              isSelected={!!state.selected[k]}
              isDisconnected={isDisconnected(k)}
              onSelect={handleHexClick}
            />
          ))}

          {/* Selection outlines drawn as a final pass, on top of every
              hex. Hexes render column-by-column, top-to-bottom, so a
              selected hex's own gold stroke gets partially painted over
              by whichever neighbours happen to be drawn after it (its
              right/bottom side, typically) — drawing the outline again
              here, last, guarantees the full ring is always visible
              regardless of draw order. */}
          {Object.keys(state.selected).map((k) => {
            const { c, r } = parseKey(k);
            const { x, y } = hexToPixel(c, r, hexSize);
            return (
              <polygon
                key={`sel-${k}`}
                points={hexPoints(x, y, hexSize)}
                fill="none"
                stroke="var(--gold)"
                strokeWidth={2.5}
                pointerEvents="none"
              />
            );
          })}

          {/* Active quest-marker glow rings, same final-pass treatment
              as the selection outline above and for the same reason —
              drawn per-tile it would get clipped along the right/bottom
              edge by whichever neighbour hex happens to render after
              it. The "!" badge itself lives inside HexTile since it
              sits well clear of the shared edges. */}
          {cells.map(({ c, r, k }) => {
            const entry = state.hexData[k];
            if (!entry || !entry.quest || entry.quest.status !== 'active') return null;
            const { x, y } = hexToPixel(c, r, hexSize);
            return (
              <polygon
                key={`quest-glow-${k}`}
                className="quest-glow"
                points={hexPoints(x, y, hexSize * 1.03)}
                fill="none"
                stroke={entry.quest.color}
                strokeWidth={3}
                style={{ filter: `drop-shadow(0 0 4px ${entry.quest.color}) drop-shadow(0 0 10px ${entry.quest.color})` }}
                pointerEvents="none"
              />
            );
          })}

          {/* Mid-drag: a dashed ring on the arrow's start hex, and a
              "rubber band" line that freely follows the cursor (no
              hex-snapping until release — see toSvgPoint/pixelToHex in
              the mouse handlers above, which snap the *finished* line
              to whichever hex the drag ends on). */}
          {dragArrow && (() => {
            const { c, r } = parseKey(dragArrow.fromKey);
            const fromPt = hexToPixel(c, r, hexSize);
            return (
              <g pointerEvents="none">
                <polygon
                  points={hexPoints(fromPt.x, fromPt.y, hexSize * 0.9)}
                  fill="none"
                  stroke={MOVEMENT_LINE_COLOR}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                />
                <line
                  x1={fromPt.x}
                  y1={fromPt.y}
                  x2={dragArrow.currentPt.x}
                  y2={dragArrow.currentPt.y}
                  stroke={MOVEMENT_LINE_COLOR}
                  strokeWidth={3}
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                  opacity={0.75}
                />
              </g>
            );
          })()}

          {/* Movement lines — bold red "war room" arrows, drawn as a
              final pass (same reasoning as the selection ring and quest
              glow above) so they always sit on top of every hex,
              including whatever colour is painted underneath. A wide,
              invisible hit-stroke rides under the visible arrow so it's
              easy to click precisely in Eraser mode without needing to
              land on the thin visible line. */}
          {state.movementLines.map((line) => {
            const from = parseKey(line.fromKey);
            const to = parseKey(line.toKey);
            const fromPt = hexToPixel(from.c, from.r, hexSize);
            const toPt = hexToPixel(to.c, to.r, hexSize);
            const { shaft, head } = arrowGeometry(fromPt, toPt, hexSize);
            const erasable = state.movementMode === 'erase';
            return (
              <g key={line.id}>
                {erasable && (
                  <polyline
                    points={shaft}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer' }}
                    onClick={() => actions.removeMovementLine(line.id)}
                  />
                )}
                <polyline
                  points={shaft}
                  fill="none"
                  stroke={MOVEMENT_LINE_COLOR}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  pointerEvents="none"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
                />
                {/* A thin lighter core down the middle of the shaft gives
                    it the glossy "grease pencil / ribbon" look war-room
                    arrows have, instead of a flat block of colour. */}
                <polyline
                  points={shaft}
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <polygon
                  points={head}
                  fill={MOVEMENT_LINE_COLOR}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={1}
                  pointerEvents="none"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />
      <MovementControls />
      <HexInfoPopup />
      <SectorContestModal />
    </div>
  );
}

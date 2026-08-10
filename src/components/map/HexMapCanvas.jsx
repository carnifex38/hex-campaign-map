import React, { useMemo } from 'react';
import { calcHexSize, gridPixelSize, key } from '../../utils/hexMath.js';
import { useMapState, useMapActions, useMapSelectors } from '../../state/MapContext.jsx';
import { useContainerSize } from '../../hooks/useContainerSize.js';
import { useZoomPan } from '../../hooks/useZoomPan.js';
import HexTile from './HexTile.jsx';
import ZoomControls from './ZoomControls.jsx';
import HexInfoPopup from './HexInfoPopup.jsx';

export default function HexMapCanvas() {
  const state = useMapState();
  const actions = useMapActions();
  const { isDisconnected } = useMapSelectors();
  const [wrapRef, size] = useContainerSize();
  const { scale, offset, containerRef, handlers, zoomIn, zoomOut, resetView } = useZoomPan();

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

  return (
    <div
      ref={setRefs}
      className="hex-canvas-wrap"
      {...handlers}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
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
              onSelect={actions.selectHex}
            />
          ))}
        </svg>
      </div>

      <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />
      <HexInfoPopup />
    </div>
  );
}

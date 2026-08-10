import React, { useMemo } from 'react';
import { useMapState, useMapSelectors } from '../../state/MapContext.jsx';
import { hexToRgba } from '../../utils/hexMath.js';

// A small overhead view of the whole board. This is intentionally a
// simple grid of coloured cells rather than true hex shapes — it's
// meant for "where's my territory" at a glance, not another fully
// rendered map.
//
// EXTENSION POINT: to turn this into a click-to-jump minimap, lift the
// zoom/pan state out of useZoomPan (in HexMapCanvas) into MapContext
// (or a sibling context), then this component can read the current
// viewport rectangle and dispatch a "jump to" pan/zoom update on click.
export default function MiniMap() {
  const state = useMapState();
  const { getOpacity, resolveHexColor } = useMapSelectors();

  const cellPx = 10;

  const cells = useMemo(() => {
    const out = [];
    for (let c = 0; c < state.cols; c++) {
      for (let r = 0; r < state.rows; r++) {
        const k = `${c},${r}`;
        const entry = state.hexData[k];
        const color = entry ? resolveHexColor(entry) : null;
        const fill = color ? hexToRgba(color, getOpacity(color)) : '#202325';
        out.push({ k, c, r, fill, hasReward: !!(entry && entry.reward), hasFaction: !!(entry && entry.factionIcon) });
      }
    }
    return out;
  }, [state.cols, state.rows, state.hexData, getOpacity, resolveHexColor]);

  const width = state.cols * cellPx + (state.cols % 2 === 0 ? cellPx / 2 : 0);
  const height = state.rows * cellPx + cellPx;

  return (
    <div>
      <div className="panel-title">Overhead Display</div>
      <div className="hint-text">Read-only overview of territory colour across the whole map.</div>
      <div style={{ background: '#0f1112', border: '1px solid var(--steel-line)', borderRadius: 4, padding: 8, overflow: 'auto' }}>
        <svg width={width} height={height}>
          {cells.map(({ k, c, r, fill, hasReward, hasFaction }) => {
            const x = c * (cellPx * 0.75);
            const y = r * cellPx + (c % 2 === 1 ? cellPx / 2 : 0);
            return (
              <g key={k}>
                <rect x={x} y={y} width={cellPx - 1} height={cellPx - 1} fill={fill} />
                {hasFaction && <circle cx={x + cellPx / 2} cy={y + cellPx / 2} r={1.4} fill="var(--gold)" />}
                {hasReward && <circle cx={x + cellPx - 2} cy={y + 2} r={1.2} fill="#e5cf6b" />}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

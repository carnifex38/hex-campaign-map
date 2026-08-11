import React, { useId, useMemo } from 'react';
import { hexToPixel, hexPoints, hexToRgba } from '../../utils/hexMath.js';
import { iconById } from '../../data/legionIcons.js';
import { rewardIconById } from '../../data/rewardIcons.js';
import { useMapState, useMapSelectors } from '../../state/MapContext.jsx';

export default function HexTile({ c, r, hexSize, entry, isSelected, isDisconnected, onSelect }) {
  const state = useMapState();
  const { getOpacity, getFactionScale, rewardTypeById, resolveHexColor } = useMapSelectors();
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

  const handleClick = (e) => {
    onSelect(`${c},${r}`, e.ctrlKey || e.metaKey);
  };

  return (
    <g className="hex-group">
      <polygon
        points={points}
        fill={fill}
        stroke={isSelected ? 'var(--gold)' : 'var(--hex-stroke)'}
        strokeWidth={isSelected ? 2.5 : 1.5}
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

      <text
        x={x}
        y={y + hexSize * 0.62}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={8.5}
        fill="rgba(207,201,184,0.35)"
        pointerEvents="none"
      >
        {c},{r}
      </text>

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
        <svg
          x={x - (hexSize * 0.62) / 2}
          y={y - (hexSize * 0.62) / 2}
          width={hexSize * 0.62}
          height={hexSize * 0.62}
          viewBox="0 0 512 512"
          pointerEvents="none"
          style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.95)) drop-shadow(0 0 3px rgba(0,0,0,0.75))' }}
          dangerouslySetInnerHTML={{ __html: rewardDef.markup }}
        />
      )}

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

      {entry && entry.quest && entry.quest.status === 'active' && (() => {
        // Unresolved quest marker's "!" badge, dead-centre in the hex,
        // static (no pulse/scale animation on the badge itself — only
        // the glow ring around the hex breathes; see index.css). The
        // glow ring is drawn separately, in a final pass over the
        // whole grid in HexMapCanvas — see the note there for why
        // (same reason selection outlines moved there too: hexes
        // painted after this one would otherwise cover part of it).
        const quest = entry.quest;
        const badgeR = hexSize * 0.24;
        return (
          <g pointerEvents="none">
            <circle cx={x} cy={y} r={badgeR} fill="#14151a" stroke={quest.color} strokeWidth={1.5} />
            <rect
              x={x - badgeR * 0.16}
              y={y - badgeR * 0.55}
              width={badgeR * 0.32}
              height={badgeR * 0.78}
              rx={badgeR * 0.16}
              fill={quest.color}
            />
            <circle cx={x} cy={y + badgeR * 0.46} r={badgeR * 0.17} fill={quest.color} />
          </g>
        );
      })()}
    </g>
  );
}

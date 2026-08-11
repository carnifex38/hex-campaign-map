import { useCallback, useRef, useState } from 'react';

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

// Returns { scale, offset, containerRef, handlers, zoomIn, zoomOut, resetView }.
// Spread `handlers` onto the scrollable container; apply `scale`/`offset`
// as a CSS transform on the element you want to zoom/pan (see
// components/map/HexMapCanvas.jsx for the reference usage).
export function useZoomPan({ disabled } = {}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const dragState = useRef(null);

  const zoomAt = useCallback((pointerX, pointerY, nextScaleRaw) => {
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScaleRaw));
    setScale((prevScale) => {
      setOffset((prevOffset) => {
        // Keep the point under the cursor fixed while the scale changes.
        const worldX = (pointerX - prevOffset.x) / prevScale;
        const worldY = (pointerY - prevOffset.y) / prevScale;
        return {
          x: pointerX - worldX * nextScale,
          y: pointerY - worldY * nextScale,
        };
      });
      return nextScale;
    });
  }, []);

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomAt(pointerX, pointerY, scale * delta);
    },
    [scale, zoomAt]
  );

  const onMouseDown = useCallback(
    (e) => {
      // Only pan on the background / primary button, so hex clicks
      // still register normally (they stopPropagation if needed).
      // Disabled while a movement-line tool is active — dragging there
      // draws/erases an arrow instead, and shouldn't also drag the map
      // out from under it. See HexMapCanvas.jsx.
      if (disabled) return;
      if (e.button !== 0) return;
      dragState.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
    },
    [offset, disabled]
  );

  const onMouseMove = useCallback((e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset({ x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy });
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    const rect = containerRef.current.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, scale * 1.2);
  }, [scale, zoomAt]);

  const zoomOut = useCallback(() => {
    const rect = containerRef.current.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, scale / 1.2);
  }, [scale, zoomAt]);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    scale,
    offset,
    containerRef,
    handlers: { onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
    zoomIn,
    zoomOut,
    resetView,
    isDragging: () => !!dragState.current,
  };
}

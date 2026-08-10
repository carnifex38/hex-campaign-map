import React from 'react';

export default function ZoomControls({ scale, onZoomIn, onZoomOut, onReset }) {
  const btnStyle = {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--panel-raised)',
    border: '1px solid var(--steel-line)',
    color: 'var(--bone)',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: 'center',
      }}
    >
      <button style={btnStyle} onClick={onZoomIn} title="Zoom in">+</button>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--bone-dim)',
          padding: '2px 0',
        }}
      >
        {Math.round(scale * 100)}%
      </div>
      <button style={btnStyle} onClick={onZoomOut} title="Zoom out">&minus;</button>
      <button style={{ ...btnStyle, fontSize: 10 }} onClick={onReset} title="Reset view">
        1:1
      </button>
    </div>
  );
}

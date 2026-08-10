import React, { useEffect, useRef, useState } from 'react';

// items: [{ label, onClick, danger? }]
export default function DropdownMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickAway = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>
        {label} &#9662;
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--panel-raised)',
            border: '1px solid var(--steel-line)',
            borderRadius: 3,
            minWidth: 200,
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: i < items.length - 1 ? '1px solid var(--steel-line)' : 'none',
                color: item.danger ? 'var(--blood-bright)' : 'var(--bone)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: 0.5,
                textTransform: 'none',
                padding: '9px 12px',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';

export default function Tabs({ tabs, activeId, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '2px solid var(--bronze)',
        background: 'var(--panel)',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              background: active ? 'var(--panel-raised)' : 'transparent',
              border: 'none',
              borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -2,
              color: active ? 'var(--gold)' : 'var(--bone-dim)',
              fontFamily: 'var(--font-label)',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '10px 6px',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

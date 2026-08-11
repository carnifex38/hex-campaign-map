import React, { useState } from 'react';
import Tabs from './Tabs.jsx';
import ReadoutPanel from '../panels/ReadoutPanel.jsx';
import ColorPanel from '../panels/ColorPanel.jsx';
import IconPanel from '../panels/IconPanel.jsx';
import RewardPanel from '../panels/RewardPanel.jsx';
import QuestPanel from '../panels/QuestPanel.jsx';
import MiniMap from '../map/MiniMap.jsx';

// Add a new tab by: (1) adding it to TABS, (2) adding a case to the
// switch below. Each panel is a self-contained component that reads
// whatever it needs from MapContext — no props threading required.
const TABS = [
  { id: 'territory', label: 'Territory' },
  { id: 'icons', label: 'Icons' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'quests', label: 'Quests' },
  { id: 'overview', label: 'Overhead' },
];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState('territory');

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        background: 'linear-gradient(180deg, var(--panel-raised), var(--panel))',
        borderLeft: '2px solid var(--bronze)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ReadoutPanel />
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'territory' && <ColorPanel />}
        {activeTab === 'icons' && <IconPanel />}
        {activeTab === 'rewards' && <RewardPanel />}
        {activeTab === 'quests' && <QuestPanel />}
        {activeTab === 'overview' && <div style={{ padding: 18 }}><MiniMap /></div>}
      </div>
    </div>
  );
}

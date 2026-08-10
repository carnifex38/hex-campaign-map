import React from 'react';
import Header from './components/layout/Header.jsx';
import PlayerTabsBar from './components/layout/PlayerTabsBar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import HexMapCanvas from './components/map/HexMapCanvas.jsx';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <PlayerTabsBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <HexMapCanvas />
        <Sidebar />
      </div>
    </div>
  );
}

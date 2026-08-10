import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { MapProvider } from './state/MapContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MapProvider>
      <App />
    </MapProvider>
  </React.StrictMode>
);

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves this project at /hex-campaign-map/.
  base: '/hex-campaign-map/',
  build: {
    outDir: 'dist',
  },
  plugins: [react()],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
build: {
    outDir: 'docs', // Changes the output directory from 'dist' to 'docs'
    emptyOutDir: true, // Empties the folder on every build
  },
  plugins: [react()],
});

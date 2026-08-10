import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
build: {
    outDir: './', // Changes the output directory from 'dist' to 'docs'
  },
  plugins: [react()],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),
  base: './',
  build: {
    outDir: 'dist'
  },
  plugins: [react()]
});

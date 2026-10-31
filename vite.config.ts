/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The base path matches the GitHub Pages project URL:
// https://tbmaynard.github.io/usd-eml520-financial-model/
export default defineConfig({
  base: '/usd-eml520-financial-model/',
  plugins: [react()],
  // Fixed ports, away from 5173/8000 which are used for other local projects.
  server: { port: 5280, strictPort: true },
  preview: { port: 4280, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

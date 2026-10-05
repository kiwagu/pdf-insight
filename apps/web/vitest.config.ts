import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Same `@/` alias as the app build: generated ui primitives import each other through it.
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { environment: 'jsdom', include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'] },
});

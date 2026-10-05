import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals, so Testing Library cannot register its own cleanup. The locale
// choice and the history live in localStorage and must not leak from one test into the next.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

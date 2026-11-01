import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement matchMedia — used by prefers-reduced-motion checks
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// The PWA virtual module only exists inside the Vite build.
vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => {} }));

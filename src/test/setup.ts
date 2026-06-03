import '@testing-library/jest-dom/vitest';

/**
 * Polyfills for tests — jsdom doesn't provide these by default but our
 * code paths (and React Query) sometimes touch them.
 */
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

/**
 * Lightweight, opt-in telemetry client.
 *
 * The default transport is `console` — every event is logged locally and
 * nothing leaves the device. Set `VITE_POSTHOG_KEY` (PostHog has a free
 * tier with 1M events/month) to send events to PostHog Cloud instead.
 *
 * Three privacy-first rules baked in:
 *   1. Telemetry is OFF until the citizen explicitly opts in.
 *   2. We never include email, phone, or complaint contents in event
 *      payloads — only counts and IDs.
 *   3. The opt-in choice is persisted in localStorage and respected on
 *      every subsequent page load.
 */

const STORAGE_KEY = 'nivaran.telemetry.optIn';

type OptIn = 'granted' | 'declined' | null;

interface EventProps {
  [key: string]: string | number | boolean | null | undefined;
}

let posthogClient: { capture: (name: string, props?: EventProps) => void } | null = null;
let posthogLoaderPromise: Promise<void> | null = null;

function getOptIn(): OptIn {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'granted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export function setOptIn(value: 'granted' | 'declined'): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Quota / private mode — telemetry simply stays off.
  }
  window.dispatchEvent(new CustomEvent('nivaran:telemetry-opt-in', { detail: value }));
  if (value === 'granted') void loadProvider();
}

export function getOptInStatus(): OptIn {
  return getOptIn();
}

async function loadProvider(): Promise<void> {
  if (posthogClient || posthogLoaderPromise) return posthogLoaderPromise ?? Promise.resolve();

  const key = (import.meta.env.VITE_POSTHOG_KEY ?? '').trim();
  if (!key) {
    // Console transport is already implicit — nothing to load.
    return;
  }

  // Dynamic-import the SDK only when a key is configured. The
  // `@vite-ignore` annotation keeps Rollup from trying to resolve the
  // package at build time — that way `posthog-js` is a soft dependency
  // we install only when we're ready to enable real telemetry.
  const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
  posthogLoaderPromise = dynamicImport('posthog-js')
    .then((mod) => {
      const m = mod as { default?: unknown };
      const posthog = (m.default ?? m) as { init: (k: string, o: Record<string, unknown>) => void };
      posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        // Privacy defaults: don't auto-capture clicks/inputs, no session recording.
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        persistence: 'localStorage',
      });
      posthogClient = posthog as unknown as typeof posthogClient;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[telemetry] failed to load PostHog SDK; staying on console transport.', err);
    });
  return posthogLoaderPromise;
}

/**
 * Record an event. No-op when telemetry is opt-out or undecided.
 *
 * Names are dot-namespaced so they group cleanly in PostHog:
 *   complaint.submitted, complaint.resolved, ai.classify, page.view, ...
 */
export function track(name: string, props?: EventProps): void {
  if (getOptIn() !== 'granted') return;

  if (posthogClient) {
    try {
      posthogClient.capture(name, props);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[telemetry] capture failed', err);
    }
  }

  // Console transport — useful in dev, harmless in prod with no key set.
  // eslint-disable-next-line no-console
  console.info('[telemetry]', name, props ?? {});
}

/** Bootstrap call invoked from `main.tsx`. Lazy-loads the SDK if opted-in. */
export function initTelemetry(): void {
  if (getOptIn() === 'granted') void loadProvider();
}

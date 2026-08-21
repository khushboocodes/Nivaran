import { useEffect, useState } from 'react';
import { Loader2, CloudOff } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Full-page state shown while the app is still deciding whether anybody is
 * signed in, and when it turns out the API cannot be reached at all.
 *
 * This exists because route guards previously rendered `null` during the
 * session probe. That is fine when the probe settles in milliseconds, but a
 * proxy in front of a crashed container accepts the connection and then
 * never answers, so the probe stayed pending indefinitely and the guard
 * rendered nothing forever — an unexplained blank white page. Rendering a
 * real state instead means the worst case is a visible, self-describing
 * screen rather than silence.
 */

interface SessionBootScreenProps {
  /** Render the "cannot reach the API" variant instead of the spinner. */
  unreachable?: boolean;
  /** Invoked by the retry button; falls back to a full reload. */
  onRetry?: () => void;
}

/**
 * How long to wait before admitting the wait is unusual. Sub-second probes
 * should never flash this text, but a free-tier cold start takes tens of
 * seconds and the user deserves to know the page is not stuck.
 */
const SLOW_AFTER_MS = 4_000;

export default function SessionBootScreen({
  unreachable = false,
  onRetry,
}: SessionBootScreenProps) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (unreachable) return;
    const timer = setTimeout(() => setIsSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [unreachable]);

  if (unreachable) {
    return (
      <div
        className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6"
        role="alert"
      >
        <div className="max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
            <CloudOff className="w-8 h-8 text-[#EF4444]" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-[#0B1220] mb-2">
            Cannot reach the server
          </h1>
          <p className="text-sm text-[#6B7280] mb-6">
            The Nivaran API did not respond, so signed-in pages are
            unavailable. The public pages still work. If you are running this
            locally, check that the API is up on port 3001.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="border-[#E5E7EB]"
              onClick={() => (onRetry ? onRetry() : location.reload())}
            >
              Try again
            </Button>
            <Button
              className="bg-[#2952E3] hover:bg-[#1e3a8a]"
              onClick={() => {
                location.href = '/';
              }}
            >
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md text-center">
        <Loader2
          className="w-8 h-8 mx-auto mb-4 animate-spin text-[#2952E3]"
          strokeWidth={2}
        />
        <p className="text-sm text-[#6B7280]">
          {isSlow
            ? 'Still connecting. The server may be waking from idle, which can take up to a minute.'
            : 'Loading Nivaran\u2026'}
        </p>
      </div>
    </div>
  );
}

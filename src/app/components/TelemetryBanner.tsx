import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getOptInStatus, setOptIn } from '../../lib/telemetry';

/**
 * Bottom-right opt-in banner for telemetry. Renders only when the citizen
 * has not yet chosen — first allow / decline persists to localStorage and
 * the banner stays gone forever (per browser).
 *
 * Designed to fit anywhere without affecting layout: position `fixed`,
 * z-index above modals' overlay so it remains reachable, but small.
 */
export default function TelemetryBanner() {
  const [show, setShow] = useState<boolean>(() => getOptInStatus() === null);

  useEffect(() => {
    const handler = () => setShow(getOptInStatus() === null);
    window.addEventListener('nivaran:telemetry-opt-in', handler as EventListener);
    return () => window.removeEventListener('nivaran:telemetry-opt-in', handler as EventListener);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm bg-white border border-[#E5EAF3] rounded-2xl shadow-lg p-4 text-sm">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setOptIn('declined')}
        className="absolute top-2 right-2 w-6 h-6 rounded-full text-[#7C8AA5] hover:text-[#0F172A] hover:bg-[#F4F7FB] flex items-center justify-center"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
      <div className="font-semibold text-[#0F172A] mb-1.5 pr-6">Help improve Nivaran</div>
      <p className="text-xs text-[#7C8AA5] leading-relaxed mb-3">
        We collect anonymous usage events (page views, feature clicks). No personal info, no
        complaint content. You can change this any time in your profile.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOptIn('declined')}
          className="px-3 py-1.5 rounded-lg text-xs text-[#0F172A] hover:bg-[#F4F7FB]"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={() => setOptIn('granted')}
          className="px-3 py-1.5 rounded-lg text-xs bg-[#2F5BFF] hover:bg-[#2549D9] text-white shadow-sm"
        >
          Allow
        </button>
      </div>
    </div>
  );
}

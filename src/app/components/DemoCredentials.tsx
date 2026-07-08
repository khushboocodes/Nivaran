import { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';

interface CredentialRowProps {
  label: string;
  value: string;
}

interface DemoCredentialsProps {
  /** Visual accent. Citizen uses 'blue', admin uses 'navy'. */
  variant: 'blue' | 'navy';
  email: string;
  password: string;
  /**
   * Optional auto-fill handler. When provided, a small "Use" button appears
   * next to the title and fills the host form via the callback.
   */
  onUse?: () => void;
}

function CredentialRow({ label, value }: CredentialRowProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wide text-[#94A3B8] font-medium">{label}</div>
        <div className="text-xs text-[#0F172A] font-mono truncate">{value}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:text-[#1e40af] transition-colors px-1.5 py-0.5 rounded-md hover:bg-white"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? (
          <>
            <Check className="w-3 h-3" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

export default function DemoCredentials({ variant, email, password, onUse }: DemoCredentialsProps) {
  const accent =
    variant === 'navy'
      ? 'bg-[#EEF4FF] border-[#DBE5FF]'
      : 'bg-[#F8FAFC] border-[#E2E8F0]';

  return (
    <div className={`mt-3 rounded-xl border ${accent} px-3 py-2`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#1D4ED8]" strokeWidth={2} />
          <span className="text-[11px] font-semibold text-[#0F172A]">Try the demo</span>
        </div>
        {onUse && (
          <button
            type="button"
            onClick={onUse}
            className="text-[11px] font-medium text-[#1D4ED8] hover:text-[#1e40af] transition-colors px-1.5 py-0.5 rounded-md hover:bg-white"
            aria-label="Auto-fill demo credentials"
          >
            Use →
          </button>
        )}
      </div>
      <CredentialRow label="Email" value={email} />
      <div className="border-t border-[#E2E8F0]" />
      <CredentialRow label="Password" value={password} />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY,
  type SupportedLanguage,
} from '../../lib/i18n';
import { useAuth } from '../auth/AuthProvider';
import { apiClient } from '../../lib/api/client';

interface LanguageSwitcherProps {
  /** Visual variant. 'sidebar' is light + neutral, suitable for the citizen layout. */
  variant?: 'sidebar';
}

export default function LanguageSwitcher({ variant = 'sidebar' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('common');
  const { user } = useAuth();

  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : 'en';

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as SupportedLanguage;
    void i18n.changeLanguage(next);
    if (user) {
      // Fire-and-forget; localStorage already persisted the choice via the
      // language detector, so no UX wait is needed. The next /api/auth/me
      // will reconcile if this PATCH fails.
      void apiClient.patch('/users/me', { language: next }).catch(() => {
        // Silent — the localStorage value still holds the user's preference.
      });
    }
  };

  if (variant === 'sidebar') {
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-medium px-1">
          {t('language', { defaultValue: 'Language' })}
        </span>
        <select
          aria-label="Language"
          value={current}
          onChange={onChange}
          className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] text-sm font-medium focus:ring-2 focus:ring-[#2952E3] focus:border-transparent cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {LANGUAGE_DISPLAY[lng]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return null;
}

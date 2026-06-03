/**
 * i18n bootstrap.
 *
 * Namespaces:
 *   common     — buttons, common labels (signed out, save, cancel, ...)
 *   citizen    — citizen portal (sidebar nav, page titles, form labels)
 *   admin      — admin console
 *   marketing  — landing page
 *
 * Languages: en, hi, ta, te, kn, ml, mr, bn, gu, pa, ur (11 total).
 *
 * Detection order (defaulted via i18next-browser-languagedetector):
 *   1. localStorage `nivaran:language`
 *   2. navigator.language
 *   3. Fallback: 'en'
 *
 * The sidebar `LanguageSwitcher` calls `i18n.changeLanguage(...)` and
 * persists the choice to the user profile when authenticated.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en';
import hi from './locales/hi';
import ta from './locales/ta';
import te from './locales/te';
import kn from './locales/kn';
import ml from './locales/ml';
import mr from './locales/mr';
import bn from './locales/bn';
import gu from './locales/gu';
import pa from './locales/pa';
import ur from './locales/ur';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_DISPLAY: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  mr: 'मराठी',
  bn: 'বাংলা',
  gu: 'ગુજરાતી',
  pa: 'ਪੰਜਾਬੀ',
  ur: 'اردو',
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, hi, ta, te, kn, ml, mr, bn, gu, pa, ur },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    ns: ['common', 'citizen', 'admin', 'marketing', 'auth', 'status', 'priority', 'sentiment'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'nivaran:language',
      caches: ['localStorage'],
    },
  });

export default i18n;

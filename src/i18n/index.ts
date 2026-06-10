import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import vi from './vi.json';
import { resolveInitialLanguage } from './detect';
import { useStore } from '@/data/store';
import type { Language } from '@/types';

// Initialise i18next once, at app start (imported for its side effect in app/_layout.tsx).
// Initial language: saved setting → device locale → 'en' (see plan §9).
const initialLanguage = resolveInitialLanguage(useStore.getState().settings.language);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  compatibilityJSON: 'v3',
});

// Change language everywhere AND persist the choice into settings so it wins
// over the device locale next launch.
export async function setAppLanguage(lang: Language): Promise<void> {
  await i18n.changeLanguage(lang);
  useStore.getState().setSettings({ language: lang });
}

export default i18n;

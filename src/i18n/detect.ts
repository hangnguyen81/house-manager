import { getLocales } from 'expo-localization';
import type { Language } from '@/types';

// Read the device's preferred language. Returns 'vi' only when the device is
// Vietnamese; everything else falls back to 'en'.
export function detectDeviceLanguage(): Language {
  try {
    const code = getLocales()?.[0]?.languageCode;
    return code === 'vi' ? 'vi' : 'en';
  } catch {
    return 'en';
  }
}

// Resolution order (see plan §9): saved choice → device locale → 'en'.
export function resolveInitialLanguage(saved?: Language | null): Language {
  if (saved === 'en' || saved === 'vi') return saved;
  return detectDeviceLanguage();
}

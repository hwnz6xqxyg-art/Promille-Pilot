/** i18next-Setup: Deutsch als Default, Englisch als Alternative. */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import de from './de';
import en from './en';

function initialLanguage(): 'de' | 'en' {
  try {
    const code = getLocales()?.[0]?.languageCode;
    return code === 'en' ? 'en' : 'de'; // Default Deutsch
  } catch {
    return 'de';
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    lng: initialLanguage(),
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

/** Passendes Locale-Tag für Intl-Formatierung (Zahlen, Zeiten). */
export function currentLocale(): string {
  return i18n.language?.startsWith('en') ? 'en-US' : 'de-DE';
}

export function setLanguage(lng: 'de' | 'en'): void {
  i18n.changeLanguage(lng);
}

export default i18n;

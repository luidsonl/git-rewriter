import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import ptTranslation from './locales/pt.json';
import { listen } from '@tauri-apps/api/event';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: enTranslation,
      pt: ptTranslation,
    },
    lng: localStorage.getItem('language') || 'en', // read from storage
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

// Listen for language changes from other windows
listen<string>('language-changed', (event) => {
  if (i18n.language !== event.payload) {
    i18n.changeLanguage(event.payload);
    localStorage.setItem('language', event.payload);
  }
}).catch(console.error);

export default i18n;

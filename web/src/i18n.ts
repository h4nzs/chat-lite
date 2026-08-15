import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  // Pake backend buat narik file JSON terjemahan dari public folder
  .use(HttpBackend)
  // Otomatis deteksi bahasa browser (Indonesia, Inggris, dll)
  .use(LanguageDetector)
  // Oper instance i18n ke react-i18next
  .use(initReactI18next)
  .init({
    fallbackLng: 'en', // Kalau bahasa user ga didukung, balik ke Inggris
    // Hanya ambil kode bahasa utama: en-US → en. Tanpa ini, detector browser
    // yang mengembalikan region (mis. en-US) akan meminta /locales/en-US/*.json
    // yang tidak ada → error "failed parsing" untuk seluruh namespace.
    load: 'languageOnly',
    // Jangan pakai React Suspense — i18next warn "suspended while translations
    // are loading" di console bila useSuspense default true.
    react: { useSuspense: false },
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React udah aman dari XSS
    },
    backend: {
      // Path tempat kita nyimpen file terjemahan nanti
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // Pisahin file berdasarkan konteks biar enteng
    ns: ['common', 'auth', 'errors', 'chat', 'settings', 'modals', 'admin'],
    defaultNS: 'common',
    partialBundledLanguages: true,
  });

export default i18n;

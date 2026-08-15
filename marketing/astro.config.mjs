import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import packageJson from './package.json';

// https://astro.build/config
export default defineConfig({
  build: {
    format: 'file'
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'id', 'es', 'pt-BR'],
    routing: {
      prefixDefaultLocale: false, // 'en' akan ada di root (/), bahasa lain di /id, /es, dll.
    }
  },
  // Aktifkan integrasi React
  integrations: [react()],
  
  // Konfigurasi Vite bawaan Astro (mirip vite.config.ts kita sebelumnya)
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // 👇 TAMBAHKAN INI: Memaksa react-icons diproses sebagai source, bukan external
      noExternal: ['react-icons', 'react-icons/**']
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  }
});

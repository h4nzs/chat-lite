import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Pastikan mode gelap diaktifkan
  theme: {
    extend: {
      colors: {
        background: '#181818', // Latar belakang utama
        surface: '#1F1F1F',    // Latar belakang sidebar/panel
        primary: '#2A2A2A',    // Latar belakang elemen sekunder (cth: bubble penerima)
        accent: {
          DEFAULT: '#8A2BE2', // Ungu
          hover: '#9932CC', // Ungu lebih gelap
          active: '#7A2EAE', // Warna saat tombol ditekan
        },
        magenta: {
          DEFAULT: '#E91E63', // Magenta
          hover: '#C2185B', // Magenta lebih gelap
        },
        'text-primary': '#E0E0E0', // Teks utama
        'text-secondary': '#A0A0A0', // Teks abu-abu (muted)
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Set font default
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'neumorphic-dark': '6px 6px 12px #101010, -6px -6px 12px #202020',
        'neumorphic-dark-inset': 'inset 6px 6px 12px #101010, inset -6px -6px 12px #202020',
      },
    },
  },
  plugins: [],
} satisfies Config;

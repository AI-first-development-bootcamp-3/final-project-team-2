import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Brand palette shared with apps/mobile (Figma design tokens)
      colors: {
        navy: '#141E3E',
        darkGray: '#53575B',
        lightBg: '#F2F2F7',
      },
      fontFamily: {
        sans: ['"Assistant Variable"', 'Assistant', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;

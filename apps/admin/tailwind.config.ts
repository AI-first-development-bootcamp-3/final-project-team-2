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
        // Exact Figma tokens (read from the admin-portal frames via CSS/SVG export)
        linkBlue: '#0C69FF',
        ink: '#212525',
        divider: '#ECECEC',
        grayIcon: '#848891',
      },
      fontFamily: {
        sans: ['"Assistant Variable"', 'Assistant', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;

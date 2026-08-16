import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'sans-serif'],
      },
      colors: {
        navy: '#141E3E',
        darkGray: '#53575B',
        lightBg: '#F2F2F7',
      },
    },
  },
  plugins: [],
};

export default config;

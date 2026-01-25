import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4f46e5',
          dark: '#4338ca',
          light: '#6366f1',
        },
        secondary: {
          DEFAULT: '#10b981',
          dark: '#059669',
          light: '#34d399',
        },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colores del panel /admin: cambian entre claro y oscuro con variables CSS
        // definidas en app/globals.css (.admin-root).
        adm: {
          bg: 'rgb(var(--adm-bg) / <alpha-value>)',
          surface: 'rgb(var(--adm-surface) / <alpha-value>)',
          muted: 'rgb(var(--adm-muted) / <alpha-value>)',
          hover: 'rgb(var(--adm-hover) / <alpha-value>)',
          border: 'rgb(var(--adm-border) / <alpha-value>)',
          'border-strong': 'rgb(var(--adm-border-strong) / <alpha-value>)',
          fg: 'rgb(var(--adm-fg) / <alpha-value>)',
          fg2: 'rgb(var(--adm-fg2) / <alpha-value>)',
          fg3: 'rgb(var(--adm-fg3) / <alpha-value>)',
          fg4: 'rgb(var(--adm-fg4) / <alpha-value>)',
          accent: 'rgb(var(--adm-accent) / <alpha-value>)',
          'accent-strong': 'rgb(var(--adm-accent-strong) / <alpha-value>)',
        },
        primary: {
          DEFAULT: '#008000',
          dark: '#006600',
          light: '#33a833',
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

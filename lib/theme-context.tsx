'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'auto';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  isAuto: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
  isAuto: true,
  mode: 'auto',
  setMode: () => {},
});

function isDarkHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7;
}

const STORAGE_KEY = 'motaxi_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [isAuto, setIsAuto] = useState(true);

  // Aplicar clase al <body> — Next.js no interfiere con él tras la hidratación
  const applyTheme = useCallback((t: Theme) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    setTheme(t);
  }, []);

  // Carga inicial: preferencia guardada o detección por hora
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      setIsAuto(false);
      applyTheme(saved);
    } else {
      setIsAuto(true);
      applyTheme(isDarkHour() ? 'dark' : 'light');
    }
  }, [applyTheme]);

  // Reloj: cuando no hay preferencia manual, cambia automático a las 7 y 19
  useEffect(() => {
    if (!isAuto) return;
    const interval = setInterval(() => {
      applyTheme(isDarkHour() ? 'dark' : 'light');
    }, 60_000); // revisar cada minuto
    return () => clearInterval(interval);
  }, [isAuto, applyTheme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    // Al tocar el botón se sale del modo automático y se guarda la preferencia
    setIsAuto(false);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, [theme, applyTheme]);

  // Elegir explícitamente claro, oscuro o automático (por hora del día)
  const setMode = useCallback((mode: ThemeMode) => {
    if (mode === 'auto') {
      setIsAuto(true);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      applyTheme(isDarkHour() ? 'dark' : 'light');
    } else {
      setIsAuto(false);
      try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
      applyTheme(mode);
    }
  }, [applyTheme]);

  const mode: ThemeMode = isAuto ? 'auto' : theme;

  return (
    <ThemeContext.Provider value={{ theme, toggle, isAuto, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

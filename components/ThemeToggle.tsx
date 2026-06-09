'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-context';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle, isAuto } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Evitar mismatch de hidratación: no renderizar hasta que el cliente esté listo
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isAuto ? `Modo automático (${isDark ? 'oscuro' : 'claro'})` : `Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
        isDark
          ? 'bg-slate-700 text-yellow-300 hover:bg-slate-600'
          : 'bg-white/20 text-white hover:bg-white/30'
      } ${className}`}
    >
      <span className="text-base leading-none">
        {isDark ? '☀️' : '🌙'}
      </span>
      <span className="hidden sm:inline">
        {isAuto ? 'Auto' : isDark ? 'Oscuro' : 'Claro'}
      </span>
    </button>
  );
}

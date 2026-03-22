'use client';

import { useEffect, useState } from 'react';

export default function InstallPWAModal() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Si ya está instalado como PWA, no mostrar nunca
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Detectar iOS (Safari)
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    // Escuchar el evento beforeinstallprompt (Chrome/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // En iOS no hay beforeinstallprompt → mostrar igualmente con instrucciones manuales
    if (ios) {
      setShow(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
    }
  }

  function handleClose() {
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        {/* Header verde */}
        <div className="bg-[#42CE1D] px-6 pt-6 pb-8 text-center relative">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Instala MoTaxi</h2>
          <p className="text-white/80 text-sm mt-1">Accede más rápido desde tu pantalla de inicio</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Beneficios */}
          <ul className="space-y-2.5">
            {[
              { icon: '⚡', text: 'Acceso instantáneo sin abrir el navegador' },
              { icon: '📍', text: 'Pide tu mototaxi en segundos' },
              { icon: '🔔', text: 'Recibe notificaciones de tus viajes' },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-lg">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* Instrucciones iOS */}
          {isIOS && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Cómo instalar en iPhone/iPad</p>
              <div className="flex items-start gap-2 text-sm text-blue-800">
                <span className="shrink-0">1.</span>
                <span>Toca el botón <strong>Compartir</strong> <span className="inline-block border border-blue-400 rounded px-1">⬆</span> en la barra inferior de Safari.</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-blue-800">
                <span className="shrink-0">2.</span>
                <span>Selecciona <strong>"Añadir a pantalla de inicio"</strong>.</span>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex flex-col gap-2 pt-1">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="w-full py-3 bg-[#42CE1D] hover:bg-[#38b518] text-white font-semibold rounded-2xl transition-colors"
              >
                Instalar ahora
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}

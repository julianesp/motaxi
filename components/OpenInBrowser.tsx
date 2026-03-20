'use client';

import { useEffect, useState } from 'react';

/**
 * Detecta si la app está corriendo dentro de un WebView de redes sociales
 * (Messenger, Facebook, Instagram, TikTok, etc.) y redirige al navegador real.
 */
export default function OpenInBrowser() {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    const ua = navigator.userAgent || '';

    // Detectar WebViews de apps sociales
    const isFBMessenger = /FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(ua);
    const isInstagram = /Instagram/.test(ua);
    const isTikTok = /musical_ly|TikTok/.test(ua);
    const isLine = /Line\//.test(ua);
    const isSnapchat = /Snapchat/.test(ua);
    const isTwitter = /TwitterAndroid|Twitter for/.test(ua);

    const detected = isFBMessenger || isInstagram || isTikTok || isLine || isSnapchat || isTwitter;

    if (detected) {
      const url = window.location.href;
      setCurrentUrl(url);
      setIsInAppBrowser(true);

      // Intentar redirección automática en Android con intent://
      if (/Android/i.test(ua)) {
        const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
        window.location.replace(intentUrl);
      }
    }
  }, []);

  if (!isInAppBrowser) return null;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(currentUrl).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white px-6 text-center">
      <div className="max-w-sm w-full">
        {/* Ícono */}
        <div className="w-20 h-20 bg-[#42CE1D] rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Abre en tu navegador
        </h2>
        <p className="text-gray-500 mb-8">
          Para usar MoTaxi correctamente, necesitas abrirlo en Chrome u otro navegador. Toca el botón de abajo y selecciona <strong>"Abrir en navegador"</strong>.
        </p>

        {/* Instrucciones visuales */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-[#42CE1D] text-white text-sm font-bold flex items-center justify-center shrink-0">1</span>
            <p className="text-gray-600 text-sm">Toca los <strong>tres puntos (···)</strong> o el ícono de menú en la esquina superior derecha.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-[#42CE1D] text-white text-sm font-bold flex items-center justify-center shrink-0">2</span>
            <p className="text-gray-600 text-sm">Selecciona <strong>"Abrir en Chrome"</strong> o <strong>"Abrir en navegador"</strong>.</p>
          </div>
        </div>

        {/* Botón copiar enlace como alternativa */}
        <button
          onClick={handleCopyLink}
          className="w-full py-3 px-6 border-2 border-[#42CE1D] text-[#42CE1D] font-semibold rounded-xl hover:bg-[#42CE1D] hover:text-white transition-colors"
        >
          Copiar enlace
        </button>
        <p className="text-xs text-gray-400 mt-3">
          Si el botón anterior no funciona, copia el enlace y pégalo en Chrome.
        </p>
      </div>
    </div>
  );
}

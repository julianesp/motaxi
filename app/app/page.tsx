"use client";

import { useEffect, useState } from "react";
import {
  PLAY_STORE_URL,
  androidIntentUrl,
  detectPlatform,
  type DevicePlatform,
} from "@/lib/constants/stores";

// Puerta de entrada a MoTaxi: abre la app si está instalada y, si no, envía a la tienda
// que corresponda al celular. Los accesos web de conductor y pasajero llegan aquí.
export default function AbrirAppPage() {
  const [platform, setPlatform] = useState<DevicePlatform | null>(null);

  useEffect(() => {
    const p = detectPlatform(navigator.userAgent);
    setPlatform(p);
    // Android: un solo salto; abre la app o, si no está, Google Play.
    if (p === "android") window.location.replace(androidIntentUrl());
  }, []);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <img src="/logo.png" alt="MoTaxi" className="w-20 h-20 mx-auto mb-6 rounded-2xl" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">MoTaxi</h1>

        {platform === null || platform === "android" ? (
          <>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Abriendo la app…</p>
            <a
              href={PLAY_STORE_URL}
              className="inline-block rounded-xl bg-[#008000] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#006600]"
            >
              Descargar en Google Play
            </a>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Si la app no se abre sola, toca el botón para instalarla.
            </p>
          </>
        ) : platform === "huawei" ? (
          <p className="text-gray-700 dark:text-gray-200">
            La app de MoTaxi para celulares Huawei estará disponible muy pronto en AppGallery.
            Estamos terminando la versión para tu celular.
          </p>
        ) : platform === "ios" ? (
          <p className="text-gray-700 dark:text-gray-200">
            La app de MoTaxi para iPhone estará disponible próximamente.
          </p>
        ) : (
          <>
            <p className="text-gray-700 dark:text-gray-200 mb-6">
              MoTaxi funciona desde la app en tu celular. Abre este enlace desde tu teléfono o
              descárgala en Google Play.
            </p>
            <a
              href={PLAY_STORE_URL}
              className="inline-block rounded-xl bg-[#008000] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#006600]"
            >
              Descargar en Google Play
            </a>
          </>
        )}
      </div>
    </main>
  );
}

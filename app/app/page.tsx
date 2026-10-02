"use client";

import { useEffect, useState } from "react";
import {
  APP_ONLY,
  PLAY_STORE_URL,
  TESTERS_URL,
  androidIntentUrl,
  detectPlatform,
  type DevicePlatform,
} from "@/lib/constants/stores";

// Puerta de entrada a MoTaxi: abre la app si está instalada y, si no, envía a la tienda
// que corresponda al celular. Los accesos web de conductor y pasajero llegan aquí cuando el
// interruptor NEXT_PUBLIC_APP_ONLY está encendido. Apagado, la app aún no tiene ficha
// pública en Google Play (Producción pendiente), así que solo se avisa y se ofrece la web.
export default function AbrirAppPage() {
  const [platform, setPlatform] = useState<DevicePlatform | null>(null);

  useEffect(() => {
    const p = detectPlatform(navigator.userAgent);
    setPlatform(p);
    // Android: un solo salto; abre la app o, si no está, Google Play.
    if (APP_ONLY && p === "android") window.location.replace(androidIntentUrl());
  }, []);

  // Aún sin ficha pública: no se envía a nadie a un 404 de Google Play
  if (!APP_ONLY) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <img src="/logo.png" alt="MoTaxi" className="w-20 h-20 mx-auto mb-6 rounded-2xl" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">MoTaxi</h1>
          <p className="text-gray-700 dark:text-gray-200">
            La app de MoTaxi llegará muy pronto a Google Play. Mientras tanto puedes usar MoTaxi
            desde esta página.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <a
              href="/auth/login"
              className="inline-block rounded-xl bg-[#008000] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#006600]"
            >
              Iniciar sesión
            </a>
            <a
              href="/auth/register"
              className="inline-block rounded-xl border-2 border-[#008000] px-6 py-3 font-semibold text-[#008000] transition hover:bg-[#008000]/5 dark:text-green-300"
            >
              Registrarse
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            ¿Ya eres tester de la prueba de la app?{" "}
            <a href={TESTERS_URL} className="underline">
              Abre el enlace de testers
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

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

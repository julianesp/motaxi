"use client";

import Image from "next/image";
import Link from "next/link";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";

/**
 * Footer Component
 * Componente de pie de página para la aplicación MoTaxi
 * Muestra información de la empresa, municipios y contacto
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Contenedor de tres columnas */}
        <div className="grid md:grid-cols-3 gap-8">
          {/* Columna 1: Información de la empresa */}
          <div>
            <h3 className="text-2xl font-bold mb-4">MoTaxi</h3>
            <p className="text-gray-400">
              Conectando el Valle de Sibundoy, un viaje a la vez.
            </p>
          </div>

          {/* Columna 2: Lista de municipios */}
          <div>
            <h4 className="font-bold mb-4">Municipios</h4>
            <ul className="space-y-2 text-gray-400">
              {MUNICIPALITIES.map((municipality) => (
                <li
                  key={municipality.id}
                  className="hover:text-white transition-colors"
                >
                  {municipality.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 3: Información de contacto */}
          <div>
            <h4 className="font-bold mb-4">Contacto</h4>
            <p className="text-gray-400">Valle de Sibundoy, Putumayo</p>
            <p className="text-gray-400">Colombia</p>
            <a
              href="mailto:admin@neurai.dev"
              className="inline-block mt-3 text-[#42CE1D] hover:text-green-400 transition-colors text-sm"
            >
              admin@neurai.dev
            </a>
          </div>
        </div>

        {/* Aviso método de pago */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <p className="text-xs text-gray-500 text-center leading-relaxed max-w-3xl mx-auto">
            <span className="font-semibold text-gray-400">Aviso legal sobre pagos:</span> MoTaxi actúa exclusivamente como plataforma de conexión entre conductores y pasajeros. El método de pago de cada viaje es pactado libremente entre las partes. MoTaxi no procesa, retiene ni intermedia ningún pago, y no asume responsabilidad sobre las transacciones económicas realizadas entre los usuarios.
          </p>
        </div>

        {/* Línea divisoria y derechos de autor */}
        <div className="border-t border-gray-800 mt-6 pt-6 flex flex-col items-center gap-3 text-gray-400">
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-white transition-colors">Términos y Condiciones</Link>
          </div>
          <p>&copy; {currentYear} MoTaxi. Todos los derechos reservados.</p>
          <a
            href="https://neurai.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
          >
            <span>Creado por:</span>
            <Image
              src="https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/logo.png"
              alt="Neurai logo"
              width={20}
              height={20}
              className="rounded-sm"
            />
            <span className="font-semibold text-[#42CE1D] hover:text-green-400 transition-colors">neurai.dev</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

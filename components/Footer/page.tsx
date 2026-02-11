"use client";

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
          </div>
        </div>

        {/* Línea divisoria y derechos de autor */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} MoTaxi. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

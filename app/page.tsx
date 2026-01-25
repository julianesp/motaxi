'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';
import { MUNICIPALITIES } from '@/lib/constants/municipalities';
import Navbar from '@/components/Navbar';

// Cargar el mapa dinámicamente para evitar problemas de SSR
const LandingMap = dynamic(() => import('@/components/LandingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-indigo-600">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto"></div>
          <p className="mt-4 text-white text-lg font-medium">Cargando MoTaxi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Contenido */}
            <div className="text-white space-y-8">
              <div className="inline-block">
                <span className="px-4 py-2 bg-white bg-opacity-20 rounded-full text-sm font-semibold backdrop-blur-sm">
                  Valle de Sibundoy
                </span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                Tu transporte,
                <br />
                <span className="text-yellow-300">a un toque</span>
              </h1>
              <p className="text-xl lg:text-2xl text-indigo-100 max-w-xl">
                Conectando los 4 municipios del Valle de Sibundoy: Santiago, Colón, Sibundoy y
                San Francisco
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  // Usuario autenticado - mostrar botón para ir a su dashboard
                  <button
                    onClick={() => router.push(user.role === 'passenger' ? '/passenger' : '/driver')}
                    className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
                  >
                    Ir a mi Dashboard
                  </button>
                ) : (
                  // Usuario no autenticado - mostrar botones de registro e inicio de sesión
                  <>
                    <button
                      onClick={() => router.push('/auth/register')}
                      className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
                    >
                      Comenzar ahora
                    </button>
                    <button
                      onClick={() => router.push('/auth/login')}
                      className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white hover:text-indigo-600 transition-all duration-200"
                    >
                      Iniciar sesión
                    </button>
                  </>
                )}
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-6 pt-8">
                <div>
                  <div className="text-3xl lg:text-4xl font-bold text-yellow-300">4</div>
                  <div className="text-sm text-indigo-100">Municipios</div>
                </div>
                <div>
                  <div className="text-3xl lg:text-4xl font-bold text-yellow-300">24/7</div>
                  <div className="text-sm text-indigo-100">Disponible</div>
                </div>
                <div>
                  <div className="text-3xl lg:text-4xl font-bold text-yellow-300">35k+</div>
                  <div className="text-sm text-indigo-100">Habitantes</div>
                </div>
              </div>
            </div>

            {/* Mapa */}
            <div className="h-[400px] lg:h-[600px]">
              <LandingMap />
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
          >
            <path
              d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z"
              fill="#F9FAFB"
            />
          </svg>
        </div>
      </section>

      {/* Municipios Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Nuestros Municipios
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              MoTaxi conecta los cuatro municipios del hermoso Valle de Sibundoy
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {MUNICIPALITIES.map((municipality, index) => (
              <div
                key={municipality.id}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-t-4 border-indigo-600"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {municipality.name[0]}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{municipality.name}</h3>
                <p className="text-gray-600 mb-4">{municipality.description}</p>
                {municipality.population && (
                  <div className="flex items-center text-sm text-gray-500">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {municipality.population.toLocaleString()} habitantes
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              ¿Por qué elegir MoTaxi?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              La solución de transporte moderna para el Valle de Sibundoy
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Rápido y Confiable</h3>
              <p className="text-gray-600">
                Encuentra un conductor en minutos. Sistema de geolocalización en tiempo real para
                conexiones instantáneas.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Seguro</h3>
              <p className="text-gray-600">
                Conductores verificados y sistema de calificaciones. Tu seguridad es nuestra
                prioridad.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Tarifas Justas</h3>
              <p className="text-gray-600">
                Precios transparentes y competitivos. Sabe cuánto pagarás antes de viajar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="py-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              ¿Listo para comenzar?
            </h2>
            <p className="text-xl text-indigo-100 mb-8">
              Únete a la revolución del transporte en el Valle de Sibundoy
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/auth/role-selection')}
                className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
              >
                Registrarse como Pasajero
              </button>
              <button
                onClick={() => router.push('/auth/role-selection')}
                className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
              >
                Registrarse como Conductor
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">MoTaxi</h3>
              <p className="text-gray-400">
                Conectando el Valle de Sibundoy, un viaje a la vez.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Municipios</h4>
              <ul className="space-y-2 text-gray-400">
                {MUNICIPALITIES.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contacto</h4>
              <p className="text-gray-400">Valle de Sibundoy, Putumayo</p>
              <p className="text-gray-400">Colombia</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 MoTaxi. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

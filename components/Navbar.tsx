'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const isHomePage = pathname === '/';

  return (
    <nav className={`${isHomePage ? 'absolute top-0 left-0 right-0 z-50' : 'bg-white shadow-md'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <button
              onClick={() => router.push('/')}
              className={`text-2xl font-bold ${
                isHomePage ? 'text-white' : 'text-indigo-600'
              } hover:opacity-80 transition-opacity`}
            >
              MoTaxi
            </button>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              // Usuario autenticado
              <>
                <span className={`${isHomePage ? 'text-white' : 'text-gray-700'}`}>
                  Hola, <span className="font-semibold">{user.full_name}</span>
                </span>
                <button
                  onClick={() => router.push(user.role === 'passenger' ? '/passenger' : '/driver')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm'
                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                  }`}
                >
                  Mi Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              // Usuario no autenticado
              <>
                {!isHomePage && (
                  <button
                    onClick={() => router.push('/')}
                    className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Inicio
                  </button>
                )}
                <button
                  onClick={() => router.push('/auth/login')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm'
                      : 'text-gray-700 hover:text-indigo-600'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => router.push('/auth/register')}
                  className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-all hover:scale-105 ${
                    isHomePage
                      ? 'bg-white text-indigo-600 hover:shadow-xl'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  Registrarse
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg ${
                isHomePage ? 'text-white' : 'text-gray-700'
              } hover:bg-opacity-20 hover:bg-gray-500 transition-colors`}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden ${
            isHomePage ? 'bg-indigo-600 bg-opacity-95 backdrop-blur-md' : 'bg-white border-t'
          }`}
        >
          <div className="px-4 pt-2 pb-4 space-y-3">
            {user ? (
              // Usuario autenticado - Mobile
              <>
                <div className={`px-3 py-2 ${isHomePage ? 'text-white' : 'text-gray-700'}`}>
                  Hola, <span className="font-semibold">{user.full_name}</span>
                </div>
                <button
                  onClick={() => {
                    router.push(user.role === 'passenger' ? '/passenger' : '/driver');
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                  }`}
                >
                  Mi Dashboard
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              // Usuario no autenticado - Mobile
              <>
                {!isHomePage && (
                  <button
                    onClick={() => {
                      router.push('/');
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                  >
                    Inicio
                  </button>
                )}
                <button
                  onClick={() => {
                    router.push('/auth/login');
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => {
                    router.push('/auth/register');
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium shadow-lg transition-all ${
                    isHomePage
                      ? 'bg-white text-indigo-600 hover:shadow-xl'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  Registrarse
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

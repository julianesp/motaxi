'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // No hay usuario autenticado, redirigir a login
        router.push('/auth/login');
      } else if (user.role === 'passenger') {
        // Usuario pasajero, redirigir a home de pasajero
        router.push('/passenger');
      } else if (user.role === 'driver') {
        // Usuario conductor, redirigir a home de conductor
        router.push('/driver');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando...</p>
      </div>
    </div>
  );
}

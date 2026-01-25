'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  const roleParam = searchParams.get('role') as UserRole | null;

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: roleParam || ('passenger' as UserRole),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roleParam) {
      router.push('/auth/role-selection');
    }
  }, [roleParam, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!/^\d{10}$/.test(formData.phone.replace(/\s/g, ''))) {
      setError('El número de teléfono debe tener 10 dígitos');
      return;
    }

    setLoading(true);

    try {
      await register({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      });

      // El AuthContext y el componente HomePage manejarán la redirección
      router.push('/');
    } catch (err: any) {
      console.error('Register error:', err);
      setError(
        err.response?.data?.error ||
          'Error al registrar. Por favor, verifica tus datos e intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">MoTaxi</h1>
          <h2 className="text-2xl font-semibold text-gray-800">Crear Cuenta</h2>
          <p className="mt-2 text-gray-600">
            Regístrate como {formData.role === 'passenger' ? 'Pasajero' : 'Conductor'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="input"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              required
              className="input"
              placeholder="3001234567"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-start">
            <input
              id="terms"
              type="checkbox"
              required
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
              Acepto los{' '}
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                términos y condiciones
              </a>{' '}
              y la{' '}
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                política de privacidad
              </a>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

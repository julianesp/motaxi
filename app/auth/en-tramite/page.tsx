'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function EnTramitePage() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-6">

        {/* Icono */}
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        {/* Mensaje principal */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">Registro exitoso</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Tu cuenta ha sido creada correctamente. Sin embargo, en este momento la plataforma se encuentra en proceso de tramitación legal para operar de manera formal.
          </p>
        </div>

        {/* Aviso legal */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-left space-y-2">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Aviso importante</p>
          <p className="text-sm text-amber-700 leading-relaxed">
            MoTaxi está adelantando los trámites legales necesarios para prestar el servicio de forma oficial. Una vez completado este proceso, recibirás acceso completo a la aplicación y podrás comenzar a usarla con normalidad.
          </p>
          <p className="text-sm text-amber-700 leading-relaxed">
            Agradecemos tu paciencia y confianza. Te notificaremos cuando la plataforma esté disponible.
          </p>
        </div>

        {/* Pie */}
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            ¿Tienes preguntas? Escríbenos a{' '}
            <a href="mailto:admin@neurai.dev" className="text-[#008000] font-medium">
              admin@neurai.dev
            </a>
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

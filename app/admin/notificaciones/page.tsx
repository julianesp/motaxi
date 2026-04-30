'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Driver {
  id: string;
  full_name: string;
  email: string;
  vehicle_model: string;
  vehicle_plate: string;
  is_available: number;
}

const QUICK_MESSAGES = [
  {
    label: 'Bienvenida',
    title: '¡Bienvenido a MoTaxi!',
    message: 'Gracias por unirte a nuestra plataforma. Estamos felices de tenerte como parte de nuestra comunidad de conductores.',
  },
  {
    label: 'Uso gratuito',
    title: 'MoTaxi es gratis por ahora',
    message: 'Recuerda que durante esta etapa de lanzamiento el uso de la plataforma es completamente gratuito. Te avisaremos con anticipación cuando esto cambie.',
  },
  {
    label: 'Mantenimiento',
    title: 'Mantenimiento programado',
    message: 'La plataforma estará en mantenimiento esta noche. Disculpa los inconvenientes.',
  },
  {
    label: 'Actualización',
    title: 'Nueva actualización disponible',
    message: 'Hemos mejorado la plataforma. Recarga la página para disfrutar de las últimas mejoras.',
  },
  {
    label: 'Motivación',
    title: '¡Sigue así!',
    message: 'Tu trabajo como conductor hace la diferencia. Gracias por brindar un servicio de calidad a nuestros pasajeros.',
  },
];

export default function NotificacionesPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    apiClient.get('/admin/drivers/list')
      .then(res => setDrivers(res.data.drivers || []))
      .catch(() => {});
  }, []);

  const applyQuick = (q: typeof QUICK_MESSAGES[0]) => {
    setTitle(q.title);
    setMessage(q.message);
    setResult(null);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const payload: any = { title: title.trim(), message: message.trim() };
      if (selectedDriver !== 'all') payload.driver_id = selectedDriver;
      const res = await apiClient.post('/admin/notify-drivers', payload);
      const d = res.data;
      setResult({
        success: true,
        text: `Enviado a ${d.drivers_notified} conductor${d.drivers_notified !== 1 ? 'es' : ''} · ${d.push_sent} notificaciones push entregadas`,
      });
      setTitle('');
      setMessage('');
      setSelectedDriver('all');
    } catch (err: any) {
      setResult({ success: false, text: err?.response?.data?.error || 'Error al enviar la notificación' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
        <p className="text-gray-400 text-sm mt-1">Envía mensajes directamente a los conductores</p>
      </div>

      {/* Mensajes rápidos */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mensajes rápidos</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_MESSAGES.map((q) => (
            <button
              key={q.label}
              onClick={() => applyQuick(q)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs rounded-lg transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">

        {/* Destinatario */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Destinatario</label>
          <select
            value={selectedDriver}
            onChange={e => setSelectedDriver(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#008000] transition-colors"
          >
            <option value="all">Todos los conductores ({drivers.length})</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.full_name} — {d.vehicle_plate || 'Sin placa'} {d.is_available ? '🟢' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Actualización importante"
            maxLength={80}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#008000] transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">{title.length}/80</p>
        </div>

        {/* Mensaje */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Mensaje</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Escribe el mensaje para los conductores..."
            rows={4}
            maxLength={300}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#008000] transition-colors resize-none"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">{message.length}/300</p>
        </div>

        {/* Resultado */}
        {result && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
            result.success
              ? 'bg-[#008000]/10 border border-[#008000]/30 text-[#008000]'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {result.success ? '✓ ' : '✗ '}{result.text}
          </div>
        )}

        {/* Botón enviar */}
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-3 bg-[#008000] hover:bg-[#38b018] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Enviando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {selectedDriver === 'all'
                ? `Enviar a todos los conductores (${drivers.length})`
                : `Enviar a ${drivers.find(d => d.id === selectedDriver)?.full_name || 'conductor'}`}
            </>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p>• Las notificaciones aparecen en el panel del conductor y como notificación push si la tienen activada.</p>
        <p>• Puedes usar los mensajes rápidos como plantilla y editarlos antes de enviar.</p>
        <p>• El selector 🟢 indica conductores actualmente en línea.</p>
      </div>
    </div>
  );
}

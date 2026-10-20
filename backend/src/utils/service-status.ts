/**
 * Pausa general del servicio de viajes en taxi.
 *
 * MoTaxi aún no tiene la habilitación del Ministerio de Transporte como plataforma
 * tecnológica (Resolución 2163 de 2016, art. 21: no puede operar sin ella), así que
 * la creación de viajes queda pausada hasta nuevo aviso. Se activa/desactiva desde
 * el panel admin (PUT /admin/service-status) sin publicar una versión nueva de la app.
 *
 * Si la fila no existe en app_settings, el servicio se considera PAUSADO.
 */
export const DEFAULT_SERVICE_PAUSED_MESSAGE =
  'MoTaxi todavía no puede prestar el servicio de viajes. Estamos tramitando la habilitación ' +
  'ante el Ministerio de Transporte y las alcaldías del Alto Putumayo. Por favor espera a un ' +
  'nuevo aviso; te informaremos por la app cuando puedas volver a solicitar viajes.';

export interface ServiceStatus {
  paused: boolean;
  message: string;
}

export async function getServiceStatus(db: D1Database): Promise<ServiceStatus> {
  const rows = await db
    .prepare("SELECT key, value FROM app_settings WHERE key IN ('service_paused', 'service_paused_message')")
    .all<{ key: string; value: string }>();
  const map = Object.fromEntries((rows.results || []).map((r) => [r.key, r.value]));
  return {
    paused: map.service_paused !== '0',
    message: map.service_paused_message?.trim() || DEFAULT_SERVICE_PAUSED_MESSAGE,
  };
}

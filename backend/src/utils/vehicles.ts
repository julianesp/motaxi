// Moto deshabilitada temporalmente: aún no hay autorización del Ministerio de Transporte.
// Fuente única compartida por la web (Next.js) y la app móvil (React Native + Expo):
// los clientes solo deben mostrar `vehicle_notice.message` cuando venga en la respuesta.
// Para reactivar la moto basta con poner MOTO_ENABLED en true.
export const MOTO_ENABLED = false;

export const MOTO_DISABLED_CODE = 'VEHICLE_NOT_AUTHORIZED';
export const MOTO_DISABLED_MESSAGE =
  'El servicio en moto aún no está habilitado. Por los términos establecidos por el Ministerio de Transporte, ' +
  'los conductores de moto no pueden operar en la plataforma por ahora. ' +
  'Te avisaremos cuando esté autorizado. Mientras tanto puedes cambiar tu tipo de vehículo en tu perfil.';

export interface VehicleNotice {
  code: string;
  message: string;
}

/** Devuelve el aviso si el usuario es un conductor registrado con moto; null en cualquier otro caso. */
export async function getVehicleNotice(db: D1Database, userId: string): Promise<VehicleNotice | null> {
  if (MOTO_ENABLED) return null;
  const row = await db
    .prepare('SELECT vehicle_types FROM drivers WHERE id = ?')
    .bind(userId)
    .first<{ vehicle_types: string | null }>();
  return row?.vehicle_types === 'moto'
    ? { code: MOTO_DISABLED_CODE, message: MOTO_DISABLED_MESSAGE }
    : null;
}

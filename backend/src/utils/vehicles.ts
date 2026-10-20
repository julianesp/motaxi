/**
 * Vehículos admitidos en MoTaxi.
 *
 * MoTaxi es un intermediario tecnológico entre pasajeros y empresas de transporte legalmente
 * constituidas y habilitadas en el Alto Putumayo. Por eso SOLO operan taxis de servicio público
 * (placa blanca) afiliados a una de esas empresas, con su tarjeta de operación. Motos, motocarros
 * (Piayo) y vehículos particulares no pueden operar (respuesta de MinTransporte, radicado
 * MT 20264071455001). Fuente única compartida por la web y la app: los clientes solo deben
 * mostrar `vehicle_notice.message` cuando venga en la respuesta.
 */
export const ALLOWED_VEHICLE_TYPES = ['taxi'] as const;
export type AllowedVehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];

export const isAllowedVehicleType = (value: unknown): value is AllowedVehicleType =>
  (ALLOWED_VEHICLE_TYPES as readonly unknown[]).includes(value);

export const VEHICLE_NOT_AUTHORIZED_CODE = 'VEHICLE_NOT_AUTHORIZED';
export const VEHICLE_NOT_AUTHORIZED_MESSAGE =
  'MoTaxi solo trabaja con taxis de servicio público (placa blanca) afiliados a una empresa de ' +
  'transporte legalmente habilitada. Las motos, los motocarros y los vehículos particulares no ' +
  'pueden operar en la plataforma. Si conduces un taxi, selecciona "Taxi" en tu perfil y registra ' +
  'los datos de tu empresa y tu tarjeta de operación.';

export const DRIVER_NOT_VERIFIED_CODE = 'DRIVER_NOT_VERIFIED';
export const DRIVER_NOT_VERIFIED_MESSAGE =
  'Tu cuenta está en revisión. El equipo de MoTaxi debe verificar tu empresa de transporte y tu ' +
  'tarjeta de operación antes de que puedas recibir solicitudes.';

export interface VehicleNotice {
  code: string;
  message: string;
}

/** Aviso si el usuario es un conductor cuyo vehículo no es un taxi; null en cualquier otro caso. */
export async function getVehicleNotice(db: D1Database, userId: string): Promise<VehicleNotice | null> {
  const row = await db
    .prepare('SELECT vehicle_types FROM drivers WHERE id = ?')
    .bind(userId)
    .first<{ vehicle_types: string | null }>();
  if (!row) return null;
  return isAllowedVehicleType(row.vehicle_types)
    ? null
    : { code: VEHICLE_NOT_AUTHORIZED_CODE, message: VEHICLE_NOT_AUTHORIZED_MESSAGE };
}

/**
 * Bloqueo para que un conductor actúe sobre viajes (aceptar, ofertar, ver el tablero): vehículo
 * no admitido o cuenta sin verificar por el admin. null si puede operar.
 */
export async function getDriverBlock(db: D1Database, userId: string): Promise<VehicleNotice | null> {
  const row = await db
    .prepare('SELECT vehicle_types, verification_status FROM drivers WHERE id = ?')
    .bind(userId)
    .first<{ vehicle_types: string | null; verification_status: string | null }>();
  if (!row || !isAllowedVehicleType(row.vehicle_types)) {
    return { code: VEHICLE_NOT_AUTHORIZED_CODE, message: VEHICLE_NOT_AUTHORIZED_MESSAGE };
  }
  if (row.verification_status !== 'approved') {
    return { code: DRIVER_NOT_VERIFIED_CODE, message: DRIVER_NOT_VERIFIED_MESSAGE };
  }
  return null;
}

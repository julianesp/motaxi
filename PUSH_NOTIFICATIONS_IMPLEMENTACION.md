# Sistema de Notificaciones Push - Implementación Completa

## Resumen

Se implementó el sistema completo de notificaciones push para conductores cuando se solicita un nuevo viaje. El sistema ahora:

1. ✅ Guarda los push tokens de los usuarios en la base de datos
2. ✅ Busca conductores disponibles cercanos (radio de 10km)
3. ✅ Envía notificaciones push a todos los conductores cercanos
4. ✅ Almacena notificaciones en la base de datos para historial

## Cambios Realizados

### 1. Frontend - AuthContext.tsx

**Archivo**: `/home/julian/Documentos/sites/motaxi/src/contexts/AuthContext.tsx`

**Cambio**: Agregado try-catch en signIn (línea 101-106) para que no muestre el error de push tokens al usuario cuando está en Expo Go.

```typescript
// Registrar para push notifications (no bloquear si falla)
try {
  await NotificationService.registerForPushNotifications();
} catch (notifError) {
  console.log(
    "Push notification registration failed (non-critical):",
    notifError
  );
}
```

**Resultado**: El error "Error saving push token to backend..." ya no se muestra al usuario.

### 2. Backend - trips.ts

**Archivo**: `/home/julian/Documentos/sites/motaxi/backend/src/routes/trips.ts`

**Cambio**: Modificado el endpoint `POST /trips` (líneas 62-140) para implementar búsqueda de conductores y envío de notificaciones.

**Funcionalidades agregadas**:

1. **Búsqueda de conductores cercanos**:

   - Radio de búsqueda: 10km
   - Usa fórmula de Haversine para calcular distancia
   - Solo busca conductores:
     - Disponibles (`is_available = 1`)
     - Verificados (`verification_status = 'approved'`)
     - Con push_token registrado
     - Con ubicación actual

2. **Envío de notificaciones**:

   - Crea notificación en la base de datos
   - Envía push notification a cada conductor
   - No bloquea la creación del viaje si falla alguna notificación
   - Usa `Promise.allSettled()` para enviar todas en paralelo

3. **Respuesta mejorada**:
   ```json
   {
     "trip": {...},
     "driversNotified": 3
   }
   ```

### 3. Base de Datos

**Tabla agregada**: `password_resets`

```sql
CREATE TABLE IF NOT EXISTS password_resets (
  user_id TEXT PRIMARY KEY,
  reset_code TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
```

Esta tabla ya existía en el esquema local pero faltaba en producción.

## Cómo Funciona el Flujo Completo

### Paso 1: Registro de Push Token

Cuando un usuario inicia sesión:

1. El frontend llama a `NotificationService.registerForPushNotifications()`
2. Se obtiene el Expo Push Token
3. Se envía al backend: `POST /users/push-token`
4. Se guarda en la columna `push_token` de la tabla `users`

### Paso 2: Actualización de Ubicación (Conductores)

Los conductores deben actualizar su ubicación periódicamente:

- Endpoint: `PUT /drivers/location`
- Actualiza `current_latitude` y `current_longitude` en tabla `drivers`

### Paso 3: Solicitud de Viaje (Pasajero)

Cuando un pasajero solicita un viaje:

1. Se crea el viaje en la base de datos con estado `requested`
2. Se buscan conductores cercanos (radio 10km):
   - Calcula distancia con fórmula de Haversine
   - Filtra por disponibilidad, verificación y push_token
3. Para cada conductor cercano:
   - Se crea notificación en tabla `notifications`
   - Se envía push notification via Expo Push API

### Paso 4: Notificación al Conductor

El conductor recibe:

- **Push notification** (si la app está cerrada o en background)
- **Notificación en base de datos** (para historial)

Contenido de la notificación:

```
Título: ¡Nuevo viaje disponible!
Mensaje: [Dirección de recogida] - $[Tarifa]
Data: { type: 'new_trip', tripId: '...' }
```

### Paso 5: Aceptación del Viaje

Cuando un conductor acepta:

1. Endpoint: `PUT /trips/:id/accept`
2. Se actualiza el viaje con `driver_id` y estado `accepted`
3. Se notifica al pasajero que su viaje fue aceptado

## Configuración Requerida

### En el Dispositivo del Conductor

Para que el sistema funcione, el conductor debe:

1. **Tener ubicación activa**: La app debe actualizar la ubicación del conductor periódicamente
2. **Estar disponible**: `is_available = 1` en la tabla `drivers`
3. **Estar verificado**: `verification_status = 'approved'`
4. **Tener push_token**: Debe haber iniciado sesión en la app

### Para Push Notifications Reales

Las push notifications remotas **NO funcionan en Expo Go**. Para probarlas necesitas:

1. **Development Build**:

   ```bash
   eas build --profile development --platform android
   ```

2. **O en producción**:
   ```bash
   eas build --profile production --platform android
   ```

### Variables de Entorno

No se requieren variables adicionales. El sistema usa:

- Expo Push Notification API (gratuita)
- No requiere Firebase
- No requiere configuración adicional

## Testing

### Test Local (Sin Push Notifications)

Puedes probar la lógica de búsqueda sin push notifications:

```bash
# 1. Crear un conductor de prueba
curl -X POST https://motaxi-api.julii1295.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "conductor1@test.com",
    "password": "123456",
    "phone": "3001234567",
    "full_name": "Conductor Test",
    "role": "driver"
  }'

# 2. Marcar conductor como disponible y verificado
# (requiere acceso directo a BD o endpoint de admin)

# 3. Actualizar ubicación del conductor
curl -X PUT https://motaxi-api.julii1295.workers.dev/drivers/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN_CONDUCTOR]" \
  -d '{
    "latitude": 4.7110,
    "longitude": -74.0721
  }'

# 4. Solicitar viaje como pasajero
curl -X POST https://motaxi-api.julii1295.workers.dev/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN_PASAJERO]" \
  -d '{
    "pickup_latitude": 4.7120,
    "pickup_longitude": -74.0730,
    "pickup_address": "Calle 123",
    "dropoff_latitude": 4.7200,
    "dropoff_longitude": -74.0800,
    "dropoff_address": "Calle 456",
    "fare": 15000,
    "distance_km": 5
  }'

# Respuesta incluirá: "driversNotified": 1
```

### Test con Push Notifications Reales

1. Instala development build en dos dispositivos físicos
2. Registra un usuario pasajero y un usuario conductor
3. Asegúrate que el conductor:
   - Esté marcado como verificado en la BD
   - Esté disponible
   - Tenga push_token guardado
   - Tenga ubicación actualizada
4. Solicita un viaje desde el pasajero
5. El conductor debe recibir la notificación push

## Logs y Debugging

El backend loguea:

```
Found X available drivers within 10km
```

Para ver los logs en producción:

```bash
npx wrangler tail
```

## Troubleshooting

### "Error saving push token to backend..."

- ✅ **Resuelto**: Ahora se captura el error y no se muestra al usuario
- Es normal en Expo Go (no soporta push notifications remotas)

### No llegan notificaciones a conductores

1. Verificar que el conductor tiene push_token:
   ```sql
   SELECT push_token FROM users WHERE id = '[DRIVER_ID]';
   ```
2. Verificar que el conductor está disponible y verificado:
   ```sql
   SELECT is_available, verification_status FROM drivers WHERE id = '[DRIVER_ID]';
   ```
3. Verificar que el conductor tiene ubicación actualizada:
   ```sql
   SELECT current_latitude, current_longitude FROM drivers WHERE id = '[DRIVER_ID]';
   ```

### Conductores no aparecen en búsqueda

- Verificar radio de búsqueda (actualmente 10km)
- Verificar que `is_available = 1`
- Verificar que `verification_status = 'approved'`
- Verificar que tienen ubicación actualizada recientemente

## Próximos Pasos

1. **Actualización automática de ubicación del conductor**

   - Implementar en `DriverHomeScreen` actualización cada 30 segundos

2. **Listener de notificaciones en DriverHomeScreen**

   - Escuchar notificaciones entrantes
   - Mostrar modal con detalles del viaje
   - Botón para aceptar/rechazar

3. **Sistema de expiración de viajes**

   - Si ningún conductor acepta en 5 minutos, cancelar automáticamente

4. **Priorización de conductores**
   - Enviar primero a conductores más cercanos
   - Considerar rating del conductor
   - Implementar sistema de rondas (primero 3 más cercanos, luego todos)

## Deployment

✅ **Cambios desplegados a producción**:

- Backend: https://motaxi-api.julii1295.workers.dev
- Version ID: 7f79670b-223e-4d0e-90bc-1145449ef66d
- Fecha: 2026-01-12

## Archivos Modificados

1. `/home/julian/Documentos/sites/motaxi/src/contexts/AuthContext.tsx`
2. `/home/julian/Documentos/sites/motaxi/backend/src/routes/trips.ts`
3. Base de datos producción: Tabla `password_resets` agregada

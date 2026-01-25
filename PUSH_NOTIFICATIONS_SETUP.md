# 🔔 Configuración de Push Notifications - MoTaxi

## ✅ Sin Firebase - Solo Expo + Cloudflare

Esta guía te muestra cómo configurar push notifications **sin usar Firebase**, solo usando Expo Push Notification Service y Cloudflare Workers.

---

## 📋 Requisitos

1. **Development Build** (no funciona en Expo Go)
2. Cuenta de Expo
3. Cloudflare Workers (ya configurado)

---

## 🚀 Paso 1: Instalar Dependencias

```bash
# Desde la raíz del proyecto
npm install
```

Ya incluye:
- `expo-notifications` ✅
- `expo-dev-client` ✅
- `expo-device` ✅

---

## 📱 Paso 2: Crear Development Build

### Opción A: Usar EAS Build (Recomendado - Más Fácil)

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login en Expo
eas login

# Configurar el proyecto
eas build:configure

# Crear development build para Android
eas build --profile development --platform android

# Cuando termine, descarga el APK e instálalo en tu teléfono
```

### Opción B: Local (Más Rápido pero Requiere Configuración)

```bash
# Generar archivos nativos
npx expo prebuild

# Para Android (requiere Android Studio instalado)
npx expo run:android

# Para iOS (solo en Mac, requiere Xcode)
npx expo run:ios
```

---

## 🔧 Paso 3: Actualizar la Base de Datos

```bash
cd backend

# Agregar campo push_token a la tabla users
wrangler d1 execute motaxi-db --local --file=migrations/add_push_token.sql

# También en producción
wrangler d1 execute motaxi-db --file=migrations/add_push_token.sql
```

---

## 🎯 Paso 4: Iniciar la App con Development Client

```bash
# Iniciar el servidor de desarrollo
npm start

# En tu dispositivo con el development build instalado:
# 1. Abre la app "MoTaxi" (NO Expo Go)
# 2. Escanea el QR o ingresa la URL manualmente
```

---

## 🧪 Paso 5: Probar Push Notifications

### Flujo de Prueba:

1. **Pasajero**: Regístrate → Solicita viaje
   - La app pedirá permisos de notificaciones → **Acepta**
   - El token se guardará automáticamente en el backend

2. **Conductor** (otro dispositivo): Regístrate → Activa disponibilidad → Acepta viaje
   - Cuando aceptes, el **pasajero recibirá una push notification** con:
     - Nombre del conductor
     - Información del vehículo
     - Sonido de alerta

---

## 🔍 Verificar que Funciona

### 1. Verificar que el Token se Guardó

```bash
cd backend
wrangler d1 execute motaxi-db --local --command "SELECT email, push_token FROM users"
```

Deberías ver algo como:
```
email                | push_token
---------------------|----------------------------------------
pasajero@test.com    | ExponentPushToken[xxxxxxxxxxxxxx]
conductor@test.com   | ExponentPushToken[yyyyyyyyyyyyyy]
```

### 2. Ver Logs del Backend

```bash
cd backend
npm run dev

# Cuando se acepte un viaje, deberías ver:
# "Sending push notification to: ExponentPushToken[...]"
```

### 3. Probar Manualmente

Puedes enviar una notificación de prueba desde tu backend:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[TU_TOKEN_AQUI]",
    "title": "Prueba",
    "body": "Esta es una notificación de prueba",
    "sound": "default"
  }'
```

---

## 🏗️ Arquitectura

### Frontend (React Native)

```
Usuario inicia sesión
    ↓
NotificationService.registerForPushNotifications()
    ↓
Obtiene Expo Push Token
    ↓
apiClient.post('/users/push-token', { pushToken })
    ↓
Token guardado en Cloudflare D1
```

### Backend (Cloudflare Workers)

```
Conductor acepta viaje
    ↓
Obtiene push_token del pasajero desde D1
    ↓
PushNotificationService.notifyPassengerTripAccepted()
    ↓
fetch('https://exp.host/--/api/v2/push/send')
    ↓
Expo envía notificación al dispositivo del pasajero
```

---

## 📊 Tipos de Notificaciones Implementadas

### 1. **Nuevo Viaje Disponible** (para conductores)
```typescript
{
  title: '¡Nuevo viaje disponible!',
  body: 'Calle 10 #5-20 - $8,500',
  data: { type: 'new_trip', tripId: '...' }
}
```

### 2. **Viaje Aceptado** (para pasajeros)
```typescript
{
  title: '¡Conductor asignado!',
  body: 'Juan Pérez está en camino (Pulsar 180 Azul - ABC123)',
  data: { type: 'trip_accepted' }
}
```

### 3. **Conductor Cerca** (para pasajeros)
```typescript
{
  title: 'Tu conductor está cerca',
  body: 'Llegará en aproximadamente 3 minutos',
  data: { type: 'driver_arriving' }
}
```

### 4. **Viaje Iniciado**
```typescript
{
  title: 'Viaje iniciado',
  body: '¡Buen viaje!',
  data: { type: 'trip_started' }
}
```

### 5. **Viaje Completado**
```typescript
{
  title: 'Viaje completado',
  body: 'Gracias por viajar con MoTaxi. Total: $8,500',
  data: { type: 'trip_completed' }
}
```

---

## ⚙️ Archivos Modificados/Creados

### Nuevos Archivos:

1. `src/services/notifications.service.ts` - Servicio de notificaciones (frontend)
2. `backend/src/services/push-notifications.ts` - Servicio push (backend)
3. `backend/migrations/add_push_token.sql` - Migración de DB

### Archivos Modificados:

1. `package.json` - Dependencias actualizadas
2. `cloudflare_d1_schema.sql` - Campo `push_token` agregado
3. `backend/src/routes/users.ts` - Endpoints para guardar/eliminar token
4. `backend/src/routes/trips.ts` - Envía notificación al aceptar viaje
5. `src/contexts/AuthContext.tsx` - Registra token al login/signup

---

## 🐛 Solución de Problemas

### No Recibo Notificaciones

1. **¿Estás usando Development Build?**
   - Expo Go **NO soporta** push notifications remotas
   - Debes usar un development build (APK personalizado)

2. **¿Aceptaste los permisos?**
   - Android: Ve a Configuración → Apps → MoTaxi → Permisos → Notificaciones
   - iOS: Ve a Ajustes → MoTaxi → Notificaciones

3. **¿El token se guardó?**
   ```bash
   wrangler d1 execute motaxi-db --local --command "SELECT push_token FROM users WHERE email = 'tu@email.com'"
   ```

4. **¿El backend está enviando?**
   - Revisa los logs en `cd backend && npm run dev`
   - Busca errores de "Push notification"

### Error: "Device is not physical device"

- Las push notifications **solo funcionan en dispositivos reales**, no en emuladores
- Usa un teléfono Android/iPhone físico

### Error: "projectId is required"

```typescript
// En notifications.service.ts, asegúrate de que está así:
const tokenData = await Notifications.getExpoPushTokenAsync();
// NO especifiques projectId manualmente
```

El `projectId` se obtiene automáticamente de `app.config.js:extra.eas.projectId`

---

## 📈 Límites y Costos

### Expo Push Notification Service

- ✅ **Gratis** hasta 600,000 notificaciones/mes
- ✅ Sin costo adicional de Firebase
- ✅ Funciona en iOS y Android
- ⚠️ Para más de 600k/mes, considera FCM directo

Más info: https://docs.expo.dev/push-notifications/overview/

### Cloudflare Workers

- ✅ 100,000 requests gratis por día
- ✅ Cada notificación = 1 request HTTP saliente
- ⚠️ Para alto volumen, considera Cloudflare Workers Paid Plan

---

## 🚀 Próximos Pasos (Opcionales)

### 1. Notificaciones con Imágenes

```typescript
{
  title: 'Conductor asignado',
  body: 'Juan está en camino',
  image: 'https://...url_foto_conductor...',
}
```

### 2. Acciones en Notificaciones

```typescript
{
  title: 'Nuevo viaje',
  body: '...',
  categoryIdentifier: 'trip_request',
  // Usuario puede "Aceptar" o "Rechazar" desde la notificación
}
```

### 3. Notificaciones Programadas

```typescript
// Recordatorio 5 minutos antes del viaje programado
await NotificationService.scheduleLocalNotification(
  'Viaje programado',
  'Tu viaje es en 5 minutos',
  { tripId: '...' },
  300 // 5 minutos en segundos
);
```

---

## 📚 Referencias

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)

---

**¡Listo! Ya tienes push notifications funcionando sin Firebase.** 🎉

Todo corre en:
- **Frontend**: Expo Notifications API
- **Backend**: Cloudflare Workers
- **Delivery**: Expo Push Notification Service

**Costo total: $0** (hasta 600k notificaciones/mes)

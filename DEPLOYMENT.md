# Guía de Despliegue - MoTaxi

## Preparación para Producción

### 1. Configurar Google Maps API

#### Obtener API Keys

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto o seleccionar uno existente
3. Habilitar las siguientes APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Directions API
   - Distance Matrix API
   - Places API

4. Crear credenciales (API Keys):
   - Una key para Android
   - Una key para iOS

5. Configurar restricciones:
   - **Android**: Restringir por huella digital SHA-1 de tu app
   - **iOS**: Restringir por Bundle ID

#### Configurar en la App

Actualizar `app.config.js`:
```javascript
ios: {
  config: {
    googleMapsApiKey: 'TU_API_KEY_IOS',
  },
},
android: {
  config: {
    googleMaps: {
      apiKey: 'TU_API_KEY_ANDROID',
    },
  },
}
```

### 2. Configurar Supabase para Producción

#### a. Configurar Políticas RLS (Row Level Security)

Las políticas básicas ya están en el schema, pero puedes personalizarlas:

```sql
-- Ejemplo: Permitir a pasajeros crear viajes
CREATE POLICY "Passengers can create trips" ON trips
  FOR INSERT WITH CHECK (
    auth.uid() = passenger_id AND
    EXISTS (SELECT 1 FROM passengers WHERE id = auth.uid())
  );

-- Ejemplo: Conductores pueden ver viajes asignados
CREATE POLICY "Drivers can view assigned trips" ON trips
  FOR SELECT USING (
    driver_id = auth.uid() OR
    status = 'requested'
  );
```

#### b. Configurar Email Templates

En Supabase Dashboard > Authentication > Email Templates, personalizar:
- Confirmation email
- Magic link
- Change email
- Reset password

#### c. Habilitar Realtime

```sql
-- Habilitar realtime para la tabla trips
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
```

#### d. Configurar Storage (para fotos de perfil)

```javascript
// En Supabase Dashboard, crear bucket 'avatars'
// Luego configurar política:
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. Configurar Notificaciones Push

#### a. Expo Push Notifications

```bash
# Instalar dependencias
npm install expo-notifications
```

#### b. Configurar en código

Crear `src/services/notification.service.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export class NotificationService {
  static async registerForPushNotifications() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  }
}
```

### 4. Build para Android

#### a. Configurar app.json

```json
{
  "expo": {
    "android": {
      "package": "com.motaxi.app",
      "versionCode": 1,
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ]
    }
  }
}
```

#### b. Build con EAS

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login en Expo
eas login

# Configurar proyecto
eas build:configure

# Build para Android
eas build --platform android

# Para producción (APK o AAB)
eas build --platform android --profile production
```

### 5. Build para iOS

```bash
# Build para iOS
eas build --platform ios

# Para producción
eas build --platform ios --profile production
```

### 6. Configurar Variables de Entorno en Producción

#### Para EAS Build

Crear `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "env": {
        "SUPABASE_URL": "tu_url_produccion",
        "SUPABASE_ANON_KEY": "tu_key_produccion"
      }
    }
  }
}
```

### 7. Publicar en Play Store

#### Requisitos

1. Cuenta de desarrollador de Google Play ($25 USD única vez)
2. Información de la app:
   - Título
   - Descripción corta (80 caracteres)
   - Descripción completa (4000 caracteres)
   - Screenshots (mínimo 2)
   - Icono de app (512x512 px)
   - Feature graphic (1024x500 px)

#### Pasos

1. Crear app en Google Play Console
2. Completar el contenido de la tienda
3. Configurar clasificación de contenido
4. Seleccionar países de distribución
5. Cargar el APK/AAB generado con EAS
6. Enviar para revisión

### 8. Publicar en App Store

#### Requisitos

1. Cuenta de Apple Developer ($99 USD/año)
2. Información similar a Play Store
3. Screenshots para diferentes tamaños de iPhone

#### Pasos

1. Crear app en App Store Connect
2. Configurar información de la app
3. Cargar el build con EAS
4. Configurar TestFlight (opcional para beta testing)
5. Enviar para revisión

## Monitoreo y Mantenimiento

### 1. Analytics

Instalar Firebase Analytics:

```bash
npm install @react-native-firebase/app @react-native-firebase/analytics
```

### 2. Crash Reporting

Configurar Sentry:

```bash
npm install @sentry/react-native
```

### 3. Logs

Usar Supabase Dashboard para monitorear:
- Queries lentas
- Errores de autenticación
- Uso de APIs

### 4. Backups

Configurar backups automáticos en Supabase:
- Database backups (diarios recomendado)
- Point-in-time recovery

## Costos Estimados

### Supabase
- **Free tier**: Hasta 500 MB database, 1 GB file storage, 50,000 usuarios activos mensuales
- **Pro**: $25/mes - 8 GB database, 100 GB file storage, usuarios ilimitados

### Google Maps API
- **$200 USD/mes de crédito gratis**
- Luego pago por uso (muy económico para apps pequeñas)

### Expo EAS
- **Free tier**: 30 builds/mes
- **Production**: $29/mes/usuario - builds ilimitados

### Hosting (si necesitas backend adicional)
- **Vercel/Netlify**: Gratis para proyectos pequeños
- **AWS/Digital Ocean**: Desde $5/mes

## Optimizaciones

### 1. Performance

- Usar `React.memo` para componentes que no cambian frecuentemente
- Implementar paginación en historial de viajes
- Optimizar queries de Supabase con índices

### 2. Bundle Size

```bash
# Analizar bundle
npx expo-cli customize:web
npm run analyze

# Remover dependencias no usadas
npm prune
```

### 3. Imágenes

- Comprimir imágenes con herramientas como TinyPNG
- Usar formato WebP para imágenes
- Implementar lazy loading

## Seguridad

### Checklist de Seguridad

- [ ] Variables de entorno protegidas
- [ ] RLS habilitado en todas las tablas
- [ ] API keys con restricciones
- [ ] HTTPS en todas las conexiones
- [ ] Validación de datos en el backend
- [ ] Rate limiting en APIs
- [ ] Logs de seguridad habilitados

## Soporte Post-Lanzamiento

### 1. Actualizaciones OTA con Expo

```bash
# Publicar actualización sin rebuild
eas update --branch production
```

### 2. Versionado

Seguir [Semantic Versioning](https://semver.org/):
- MAJOR: Cambios incompatibles
- MINOR: Nuevas características compatibles
- PATCH: Correcciones de bugs

### 3. Feedback de Usuarios

Implementar sistema de feedback in-app:
- Botón de reporte de bugs
- Encuestas de satisfacción
- Chat de soporte

---

¡Buena suerte con tu lanzamiento! 🚀

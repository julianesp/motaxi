# MoTaxi - Aplicación de Mototaxi

Aplicación móvil para servicio de mototaxi construida con React Native, Expo y Supabase.

## Características

### Para Pasajeros
- Solicitar viajes en tiempo real
- Seguimiento GPS del conductor
- Cálculo automático de tarifas basado en distancia
- Historial de viajes
- Sistema de calificaciones

### Para Conductores (Mototaxistas)
- Recibir solicitudes de viajes en tiempo real
- Rastreo de ubicación en segundo plano
- Control de disponibilidad
- Historial de viajes y ganancias
- Estadísticas de rendimiento

### Características Generales
- Autenticación segura con Supabase
- Interfaz intuitiva y moderna
- Notificaciones push
- Sistema de pagos (efectivo, tarjeta, billetera digital)
- Base de datos en tiempo real

## Tecnologías Utilizadas

- **React Native** - Framework móvil
- **Expo** - Herramientas de desarrollo
- **TypeScript** - Tipado estático
- **Supabase** - Base de datos y autenticación
- **React Navigation** - Navegación
- **Expo Location** - Geolocalización
- **React Native Maps** - Mapas

## Instalación

### Prerrequisitos

- Node.js (v16 o superior)
- npm o yarn
- Expo CLI: `npm install -g expo-cli`
- Cuenta en Supabase (https://supabase.com)
- Google Maps API Key

### Pasos

1. **Clonar o navegar al proyecto**
   ```bash
   cd motaxi
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Supabase**

   a. Crear un proyecto en https://supabase.com

   b. Ejecutar el schema SQL:
   - Ir a SQL Editor en tu proyecto de Supabase
   - Copiar y ejecutar el contenido de `supabase_schema.sql`

   c. Obtener las credenciales:
   - Project URL
   - Anon/Public Key

4. **Configurar variables de entorno**

   Crear archivo `.env` basado en `.env.example`:
   ```bash
   cp .env.example .env
   ```

   Editar `.env` con tus credenciales:
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu_anon_key
   GOOGLE_MAPS_API_KEY_ANDROID=tu_api_key_android
   GOOGLE_MAPS_API_KEY_IOS=tu_api_key_ios
   ```

5. **Actualizar app.config.js**

   Reemplazar las claves de Google Maps en `app.config.js`

6. **Iniciar la aplicación**
   ```bash
   npm start
   ```

## Ejecutar en Dispositivos

### Android
```bash
npm run android
```

### iOS (requiere macOS)
```bash
npm run ios
```

### Web
```bash
npm run web
```

## Estructura del Proyecto

```
motaxi/
├── src/
│   ├── components/        # Componentes reutilizables
│   │   ├── common/
│   │   ├── maps/
│   │   └── trip/
│   ├── config/           # Configuraciones (Supabase, etc.)
│   ├── contexts/         # Contextos de React (Auth, etc.)
│   ├── navigation/       # Configuración de navegación
│   ├── screens/          # Pantallas de la app
│   │   ├── auth/        # Pantallas de autenticación
│   │   ├── passenger/   # Pantallas de pasajero
│   │   ├── driver/      # Pantallas de conductor
│   │   └── shared/      # Pantallas compartidas
│   ├── services/         # Servicios (API, ubicación, etc.)
│   ├── types/           # Tipos TypeScript
│   └── utils/           # Utilidades
├── assets/              # Imágenes, fuentes, etc.
├── App.tsx             # Punto de entrada
└── app.config.js       # Configuración de Expo
```

## Base de Datos

La aplicación utiliza Supabase con las siguientes tablas principales:

- **users** - Información básica de usuarios
- **passengers** - Perfil de pasajeros
- **drivers** - Perfil de conductores (mototaxistas)
- **trips** - Registro de viajes
- **notifications** - Notificaciones
- **payment_methods** - Métodos de pago
- **earnings** - Ganancias de conductores

Ver `supabase_schema.sql` para el schema completo.

## Configuración de Tarifas

Las tarifas se calculan en `src/services/location.service.ts`:

```typescript
const BASE_FARE = 2000;      // Tarifa base
const COST_PER_KM = 1500;    // Costo por kilómetro
const MIN_FARE = 3000;       // Tarifa mínima
```

Puedes ajustar estos valores según las tarifas de tu localidad.

## Próximas Características

- [ ] Sistema de chat en tiempo real entre pasajero y conductor
- [ ] Integración con pasarelas de pago (Stripe, PayPal)
- [ ] Notificaciones push avanzadas
- [ ] Sistema de referidos
- [ ] Calificaciones y reseñas
- [ ] Mapa de calor de zonas con alta demanda
- [ ] Soporte para múltiples idiomas
- [ ] Modo oscuro

## Desarrollo

### Comandos Útiles

```bash
# Iniciar servidor de desarrollo
npm start

# Limpiar caché
npm start -- --clear

# Verificar tipos TypeScript
npx tsc --noEmit

# Formatear código
npm run format
```

### Testing

```bash
# Ejecutar tests (cuando se implementen)
npm test
```

## Seguridad

- Las contraseñas se hashean automáticamente en Supabase
- Row Level Security (RLS) habilitado en todas las tablas
- Las API keys deben mantenerse privadas
- NUNCA commitear archivos `.env`

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## Soporte

Para reportar bugs o solicitar características, por favor abre un issue en el repositorio.

## Autor

Desarrollado para satisfacer la necesidad de transporte en tu localidad.

---

Hecho con ❤️ usando React Native + Expo

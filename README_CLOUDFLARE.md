# MoTaxi - Aplicación de Mototaxi con Cloudflare

Aplicación móvil para servicio de mototaxi construida con React Native, Expo y **Cloudflare** (D1 Database + Workers).

## ¿Por qué Cloudflare?

- **100% GRATUITO** para proyectos pequeños y medianos
- **D1 Database**: 10GB de almacenamiento, 5 millones de lecturas/día GRATIS
- **Workers**: 100,000 peticiones/día GRATIS
- **R2 Storage**: 10GB almacenamiento de imágenes GRATIS
- **Edge Network**: Baja latencia global
- **Sin tarjeta de crédito** requerida para empezar

## Arquitectura

```
┌─────────────────┐
│   React Native  │
│   Expo App      │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Cloudflare      │
│ Workers API     │
│  (Hono.js)      │
└────────┬────────┘
         │
         ├─► D1 Database (SQL)
         ├─► R2 Bucket (Images)
         └─► KV Store (Cache)
```

## Instalación del Backend (Cloudflare Workers)

### 1. Crear cuenta en Cloudflare

1. Ir a [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Crear cuenta gratuita (no requiere tarjeta)

### 2. Instalar Wrangler CLI

```bash
npm install -g wrangler

# Login en Cloudflare
wrangler login
```

### 3. Configurar el Backend

```bash
cd backend
npm install
```

### 4. Crear Base de Datos D1

```bash
# Crear base de datos
wrangler d1 create motaxi-db

# Copiar el database_id que te muestra
# Actualizar en wrangler.toml
```

### 5. Ejecutar Migración de Base de Datos

```bash
# Migración local (para desarrollo)
npm run db:migrate:local

# Migración en producción
npm run db:migrate
```

### 6. Actualizar wrangler.toml

Editar `backend/wrangler.toml` y reemplazar `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "motaxi-db"
database_id = "tu-database-id-aqui"  # ← Reemplazar
```

### 7. Desarrollo Local

```bash
cd backend
npm run dev
```

La API estará disponible en `http://localhost:8787`

### 8. Desplegar a Producción

```bash
cd backend
npm run deploy
```

Recibirás una URL como: `https://motaxi-api.tu-usuario.workers.dev`

## Instalación del Frontend (App Móvil)

### 1. Instalar Dependencias

```bash
cd .. # Volver a la raíz
npm install
```

### 2. Configurar Variables de Entorno

Crear archivo `.env`:

```bash
cp .env.example .env
```

Editar `.env`:

```env
API_URL=https://motaxi-api.tu-usuario.workers.dev
GOOGLE_MAPS_API_KEY_ANDROID=tu_api_key_android
GOOGLE_MAPS_API_KEY_IOS=tu_api_key_ios
```

### 3. Actualizar app.config.js

```javascript
export default {
  expo: {
    // ... otras configuraciones
    extra: {
      apiUrl: process.env.API_URL || 'https://motaxi-api.tu-usuario.workers.dev',
    },
  },
};
```

### 4. Ejecutar la App

```bash
npm start

# O directamente
npm run android  # Para Android
npm run ios      # Para iOS (solo macOS)
```

## Estructura del Proyecto

```
motaxi/
├── backend/                    # API de Cloudflare Workers
│   ├── src/
│   │   ├── index.ts           # Punto de entrada
│   │   ├── routes/            # Rutas de la API
│   │   │   ├── auth.ts        # Autenticación
│   │   │   ├── trips.ts       # Viajes
│   │   │   ├── drivers.ts     # Conductores
│   │   │   ├── users.ts       # Usuarios
│   │   │   └── notifications.ts
│   │   └── utils/
│   │       └── auth.ts        # Utilidades de auth
│   ├── wrangler.toml          # Configuración de Cloudflare
│   └── package.json
├── src/                       # App móvil
│   ├── config/
│   │   └── api.ts            # Cliente API
│   ├── contexts/
│   │   └── AuthContext.tsx   # Context de autenticación
│   ├── screens/              # Pantallas
│   ├── services/             # Servicios
│   │   ├── database.service.ts
│   │   └── location.service.ts
│   └── types/                # Tipos TypeScript
├── cloudflare_d1_schema.sql  # Schema de base de datos
└── README_CLOUDFLARE.md      # Este archivo
```

## API Endpoints

### Autenticación

```http
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### Viajes

```http
POST /trips                    # Crear viaje
GET  /trips/active            # Viajes disponibles (conductores)
GET  /trips/history           # Historial
GET  /trips/:id               # Detalles de un viaje
PUT  /trips/:id/accept        # Aceptar viaje (conductor)
PUT  /trips/:id/status        # Actualizar estado
```

### Conductores

```http
PUT /drivers/location         # Actualizar ubicación
PUT /drivers/availability     # Actualizar disponibilidad
GET /drivers/nearby           # Conductores cercanos
GET /drivers/earnings         # Ganancias
```

### Usuarios

```http
GET /users/profile            # Obtener perfil
PUT /users/profile            # Actualizar perfil
```

### Notificaciones

```http
GET /notifications            # Listar notificaciones
PUT /notifications/:id/read   # Marcar como leída
```

## Base de Datos

La base de datos D1 utiliza SQLite y tiene las siguientes tablas principales:

- `users` - Usuarios (pasajeros y conductores)
- `sessions` - Sesiones de autenticación
- `passengers` - Perfil de pasajeros
- `drivers` - Perfil de conductores
- `trips` - Viajes
- `notifications` - Notificaciones
- `payment_methods` - Métodos de pago
- `earnings` - Ganancias

Ver `cloudflare_d1_schema.sql` para el schema completo.

## Comandos Útiles

### Backend

```bash
# Desarrollo local
cd backend && npm run dev

# Desplegar
cd backend && npm run deploy

# Ejecutar query en D1
cd backend && wrangler d1 execute motaxi-db --command "SELECT * FROM users"

# Ver logs en producción
cd backend && wrangler tail
```

### Frontend

```bash
# Iniciar app
npm start

# Limpiar caché
npm start -- --clear

# Build para producción
npm run build
```

## Costos (100% Gratis)

### Cloudflare Free Tier

- **D1 Database**: 10GB almacenamiento, 5M lecturas/día, 100K escrituras/día
- **Workers**: 100,000 peticiones/día
- **R2 Storage**: 10GB almacenamiento
- **KV**: 100,000 lecturas/día, 1,000 escrituras/día

Para una app pequeña-mediana (hasta ~1000 usuarios activos), todo es **completamente gratuito**.

## Ventajas sobre Supabase

| Característica | Cloudflare | Supabase Free |
|---------------|------------|---------------|
| Costo | **100% Gratis** | Gratis con límites |
| Base de datos | 10GB | 500MB |
| Almacenamiento | 10GB | 1GB |
| Peticiones/día | 100K | 50K usuarios activos |
| Edge Network | ✅ Global | ❌ |
| Tarjeta requerida | ❌ No | ❌ No |
| Latencia | **Muy baja** (Edge) | Depende de región |

## Desarrollo

### Testing Local

```bash
# Backend
cd backend
npm run dev
# API disponible en http://localhost:8787

# Frontend
npm start
# Escanear QR con Expo Go
```

### Ver Logs

```bash
# Logs en tiempo real del Worker
cd backend && wrangler tail
```

### Consultar Base de Datos

```bash
# Modo interactivo
cd backend && wrangler d1 execute motaxi-db --command "SELECT * FROM users LIMIT 5"

# Ejecutar archivo SQL
cd backend && wrangler d1 execute motaxi-db --file=query.sql
```

## Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Tokens de sesión con expiración
- ✅ Validación de permisos en todas las rutas
- ✅ CORS configurado
- ✅ SQL injection protegido (prepared statements)

## Próximos Pasos

1. **Agregar Google Maps API key** (ver DEPLOYMENT.md)
2. **Probar autenticación** (register, login)
3. **Probar flujo completo** (pasajero solicita → conductor acepta)
4. **Agregar notificaciones push** (opcional)
5. **Deploy a producción**

## Soporte

- [Documentación de Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Documentación de Workers](https://developers.cloudflare.com/workers/)
- [Hono.js Documentation](https://hono.dev/)

## Licencia

MIT

---

**¡Listo para usar sin costos! 🚀**

Cloudflare Free Tier es perfecto para MVPs y proyectos pequeños/medianos.

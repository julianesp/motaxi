# Migración Completa a Cloudflare ✅

## Cambios Realizados

### Backend (Nuevo - Cloudflare Workers)

Se ha creado un backend completamente nuevo usando Cloudflare Workers:

```
backend/
├── src/
│   ├── index.ts              # Punto de entrada del Worker
│   ├── routes/               # Rutas de la API
│   │   ├── auth.ts          # /auth/* (register, login, logout, me)
│   │   ├── trips.ts         # /trips/* (CRUD de viajes)
│   │   ├── drivers.ts       # /drivers/* (ubicación, disponibilidad)
│   │   ├── users.ts         # /users/* (perfil)
│   │   └── notifications.ts # /notifications/*
│   └── utils/
│       └── auth.ts          # Utilidades de autenticación
├── wrangler.toml            # Configuración de Cloudflare
├── package.json
└── tsconfig.json
```

**Tecnologías del Backend:**
- **Hono.js** - Framework web ultra-rápido para Workers
- **Cloudflare D1** - Base de datos SQLite distribuida
- **bcryptjs** - Hash de contraseñas
- **UUID** - Generación de IDs únicos

### Frontend (Actualizado)

**Archivos Modificados:**

1. **src/config/api.ts** (NUEVO)
   - Cliente HTTP para comunicarse con Cloudflare Workers
   - Manejo automático de tokens de autenticación

2. **src/contexts/AuthContext.tsx** (MODIFICADO)
   - Migrado de Supabase Auth a autenticación custom
   - Usa AsyncStorage para persistir tokens
   - Llama a `/auth/*` endpoints

3. **src/services/database.service.ts** (REESCRITO)
   - Todas las funciones ahora llaman a la API de Cloudflare
   - Removidas dependencias de Supabase

4. **src/screens/driver/DriverHomeScreen.tsx** (ACTUALIZADO)
   - Usa el nuevo método `acceptTrip()` simplificado

**Archivos Eliminados:**
- ❌ `src/config/supabase.ts`
- ❌ `supabase_schema.sql`

**Dependencias:**
- ❌ Removido: `@supabase/supabase-js`
- ✅ Agregado: `@react-native-async-storage/async-storage`

### Base de Datos

**Migrado de PostgreSQL (Supabase) a SQLite (D1):**

Cambios principales en el schema:
- `UUID` → `TEXT` (IDs como strings)
- `TIMESTAMP WITH TIME ZONE` → `INTEGER` (Unix timestamps)
- `BOOLEAN` → `INTEGER` (0/1)
- `JSONB` → `TEXT` (JSON como string)
- Triggers adaptados a sintaxis SQLite
- Row Level Security (RLS) → Validación en Workers

Ver `cloudflare_d1_schema.sql` para el schema completo.

## Ventajas de la Migración

### 💰 Costo
- **Antes (Supabase)**: Gratis hasta 500MB DB, luego $25/mes
- **Ahora (Cloudflare)**: Gratis hasta 10GB DB, 100K peticiones/día

### ⚡ Performance
- Edge Network global (baja latencia)
- Workers en más de 300+ ubicaciones
- SQLite optimizado para lectura

### 📊 Límites Gratuitos Ampliados

| Recurso | Supabase Free | Cloudflare Free |
|---------|--------------|-----------------|
| Database | 500MB | **10GB** |
| Storage | 1GB | **10GB** |
| Usuarios activos | 50K/mes | **Ilimitado** |
| Peticiones | - | **100K/día** |
| Bandwidth | 5GB | **Ilimitado** |

### 🛡️ Seguridad
- Autenticación custom con control total
- Tokens de sesión con expiración
- Bcrypt para passwords
- Sin vendor lock-in

## Cómo Usar

### 1. Setup del Backend

```bash
# Instalar Wrangler CLI
npm install -g wrangler

# Login en Cloudflare
wrangler login

# Ir al directorio backend
cd backend

# Instalar dependencias
npm install

# Crear base de datos D1
wrangler d1 create motaxi-db
# Copiar el database_id y actualizar wrangler.toml

# Ejecutar migración
npm run db:migrate:local  # Local
npm run db:migrate        # Producción

# Desarrollo local
npm run dev

# Deploy a producción
npm run deploy
```

### 2. Configurar Frontend

```bash
# Crear .env
cp .env.example .env

# Editar .env con la URL de tu Worker
API_URL=https://motaxi-api.tu-usuario.workers.dev
```

### 3. Ejecutar App

```bash
npm install
npm start
```

## Testing

### Probar API manualmente

```bash
# Register
curl -X POST https://motaxi-api.tu-usuario.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "phone": "+1234567890",
    "full_name": "Test User",
    "role": "passenger"
  }'

# Login
curl -X POST https://motaxi-api.tu-usuario.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Get Profile (usa el token recibido)
curl https://motaxi-api.tu-usuario.workers.dev/auth/me \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### Consultar Base de Datos

```bash
cd backend

# Ver usuarios
wrangler d1 execute motaxi-db --command "SELECT * FROM users"

# Ver viajes
wrangler d1 execute motaxi-db --command "SELECT * FROM trips"

# Ver sesiones
wrangler d1 execute motaxi-db --command "SELECT * FROM sessions"
```

## Diferencias Clave con Supabase

### Autenticación
- **Supabase**: Auth integrado con JWT, magic links, OAuth
- **Cloudflare**: Auth custom con tokens de sesión en D1
  - Más control, menos features out-of-the-box
  - Puedes agregar OAuth si lo necesitas

### Real-time
- **Supabase**: Real-time subscriptions integradas
- **Cloudflare**: Requiere Durable Objects + WebSockets
  - Polling como alternativa simple
  - Implementable pero requiere más código

### Storage
- **Supabase**: Storage integrado con políticas RLS
- **Cloudflare**: R2 (compatible con S3)
  - Más configuración manual
  - Mejor pricing a escala

### Admin Panel
- **Supabase**: Dashboard web completo
- **Cloudflare**: Dashboard básico + CLI (Wrangler)
  - Más orientado a desarrolladores
  - Puedes crear tu propio admin panel

## Próximas Mejoras (Opcional)

### 1. Real-time con Durable Objects
```typescript
// Para chat en tiempo real
export class TripCoordinator {
  // Durable Object para sincronizar estado del viaje
}
```

### 2. Caché con KV
```typescript
// Caché de conductores cercanos
await env.CACHE.put('nearby_drivers', JSON.stringify(drivers), {
  expirationTtl: 30 // 30 segundos
});
```

### 3. R2 para Imágenes
```typescript
// Subir foto de perfil
await env.IMAGES.put(`avatars/${userId}.jpg`, file);
```

### 4. Analytics con Workers Analytics Engine
```typescript
// Trackear eventos
env.ANALYTICS.writeDataPoint({
  indexes: ['trip_completed'],
  doubles: [fare],
});
```

## Troubleshooting

### Error: "database_id not found"
- Verifica que hayas creado la base de datos: `wrangler d1 create motaxi-db`
- Actualiza el `database_id` en `wrangler.toml`

### Error: "table not found"
- Ejecuta la migración: `npm run db:migrate:local` o `npm run db:migrate`

### CORS errors
- Verifica que la URL en `.env` coincida con la URL desplegada
- En desarrollo local usa `http://localhost:8787`

### Token expired
- Los tokens expiran en 30 días
- El usuario debe hacer login nuevamente

## Recursos

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono.js Docs](https://hono.dev/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

---

**Migración completada exitosamente! 🎉**

Ahora tienes una aplicación 100% gratuita, escalable y con mejor performance.

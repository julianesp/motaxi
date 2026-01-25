# 🚀 Inicio Rápido - MoTaxi

Guía de 5 minutos para poner en marcha tu app de mototaxi.

## Paso 1: Backend (Cloudflare Workers)

### 1.1 Instalar Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 1.2 Crear Base de Datos

```bash
cd backend
npm install
wrangler d1 create motaxi-db
```

**Importante:** Copia el `database_id` que te muestra y actualízalo en `backend/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "motaxi-db"
database_id = "PEGA_AQUI_TU_DATABASE_ID"
```

### 1.3 Migrar Base de Datos

```bash
npm run db:migrate:local
```

### 1.4 Iniciar API Local

```bash
npm run dev
```

✅ API corriendo en: `http://localhost:8787`

Deja esta terminal abierta y abre una nueva para el frontend.

---

## Paso 2: Frontend (App Móvil)

### 2.1 Instalar Dependencias

```bash
# En una nueva terminal, desde la raíz del proyecto
npm install
```

### 2.2 Configurar .env

```bash
cp .env.example .env
```

Edita `.env`:

```env
API_URL=http://localhost:8787
GOOGLE_MAPS_API_KEY_ANDROID=tu_key_aqui  # Opcional por ahora
GOOGLE_MAPS_API_KEY_IOS=tu_key_aqui      # Opcional por ahora
```

### 2.3 Iniciar App

```bash
npm start
```

Escanea el QR con **Expo Go** app en tu teléfono:
- [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
- [iOS](https://apps.apple.com/app/expo-go/id982107779)

---

## Paso 3: Probar la App

### 3.1 Crear Usuario Pasajero

1. En la app, selecciona "Soy Pasajero"
2. Registra un usuario con email/contraseña
3. ¡Listo! Ya puedes solicitar viajes

### 3.2 Crear Usuario Conductor

1. En la app (o en otro dispositivo), selecciona "Soy Conductor"
2. Registra otro usuario con email/contraseña
3. Activa tu disponibilidad (toggle)
4. ¡Listo! Ya puedes aceptar viajes

---

## Verificar que Todo Funciona

### Test 1: Autenticación

```bash
# Desde otra terminal
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pasajero@test.com",
    "password": "123456",
    "phone": "+123456789",
    "full_name": "Juan Pasajero",
    "role": "passenger"
  }'
```

Deberías recibir un objeto `user` y un `token`.

### Test 2: Ver Base de Datos

```bash
cd backend
wrangler d1 execute motaxi-db --local --command "SELECT * FROM users"
```

Deberías ver el usuario que creaste.

---

## Desplegar a Producción

### Backend

```bash
cd backend

# Migrar base de datos en producción
npm run db:migrate

# Desplegar Worker
npm run deploy
```

Recibirás una URL como: `https://motaxi-api.tu-usuario.workers.dev`

### Frontend

Actualiza `.env`:

```env
API_URL=https://motaxi-api.tu-usuario.workers.dev
```

Luego puedes usar EAS Build para crear APK/IPA:

```bash
npm install -g eas-cli
eas build --platform android
```

---

## Problemas Comunes

### "Database not found"
```bash
# Verificar bases de datos
wrangler d1 list

# Crear si no existe
wrangler d1 create motaxi-db
```

### "Network request failed"
- Verifica que el backend esté corriendo (`npm run dev`)
- Verifica que `API_URL` en `.env` esté correcta
- Intenta `npm start -- --clear` para limpiar caché

### "Cannot find module"
```bash
# Frontend
npm install

# Backend
cd backend && npm install
```

### App no carga en el teléfono
- Asegúrate que tu teléfono y computadora estén en la misma red WiFi
- Desactiva VPN si tienes una
- Intenta usar el modo tunnel: `npm start -- --tunnel`

---

## Próximos Pasos

1. ✅ Obtener [Google Maps API Key](https://developers.google.com/maps/documentation/javascript/get-api-key)
2. ✅ Personalizar tarifas en `src/services/location.service.ts`
3. ✅ Agregar tu logo en `assets/`
4. ✅ Configurar notificaciones push
5. ✅ Leer `ROADMAP.md` para más features

---

## Comandos Rápidos

```bash
# Backend
cd backend && npm run dev        # Desarrollo local
cd backend && npm run deploy     # Desplegar
cd backend && wrangler tail      # Ver logs en producción

# Frontend
npm start                        # Iniciar app
npm start -- --clear             # Limpiar caché
npm run android                  # Abrir en emulador Android
npm run ios                      # Abrir en simulador iOS

# Base de datos
cd backend && wrangler d1 execute motaxi-db --local --command "SELECT * FROM trips"
```

---

**¡Eso es todo! Ya tienes tu app de mototaxi funcionando.** 🎉

Para más detalles, ver:
- `README_CLOUDFLARE.md` - Documentación completa
- `DEPLOYMENT.md` - Guía de despliegue
- `ROADMAP.md` - Features futuras

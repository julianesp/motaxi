# 🚀 Inicio Rápido - MoTaxi Next.js

## ⚡ Comandos para Empezar

### 1️⃣ Iniciar el Backend (Terminal 1)
```bash
cd backend
npm run dev
```
✅ Backend corriendo en: http://localhost:8787

### 2️⃣ Iniciar el Frontend (Terminal 2)
```bash
npm run dev
```
✅ Frontend corriendo en: http://localhost:3000

### 3️⃣ Migrar la Base de Datos (Solo primera vez)
```bash
npm run db:migrate:local
```

---

## 🌐 URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8787
- **Red local:** http://192.168.0.160:3000 (accesible desde tu celular)

---

## 🧪 Probar la Aplicación

### Registrar un Usuario:
1. Ve a http://localhost:3000
2. Se redirigirá a `/auth/login`
3. Haz clic en "Regístrate aquí"
4. Selecciona tu rol (Pasajero o Conductor)
5. Completa el formulario de registro

### Login:
1. Ve a http://localhost:3000/auth/login
2. Ingresa email y contraseña
3. Serás redirigido según tu rol:
   - Pasajero → `/passenger`
   - Conductor → `/driver`

---

## 📱 Probar en el Celular

1. Asegúrate de estar en la misma red WiFi
2. Abre el navegador de tu celular
3. Ve a: http://192.168.0.160:3000
4. La aplicación funcionará como una web app

---

## 🔑 Usuarios de Prueba

Puedes crear usuarios de prueba o usar estos comandos SQL:

```sql
-- Ver usuarios existentes
SELECT * FROM users;

-- Ver conductores
SELECT * FROM drivers;

-- Ver pasajeros
SELECT * FROM passengers;
```

---

## 📦 Estructura de Carpetas

```
motaxi/
├── app/                    # Páginas Next.js
│   ├── auth/              # Login, registro, selección de rol
│   ├── passenger/         # Home del pasajero
│   └── driver/            # Home del conductor
├── components/            # Componentes React
│   └── MapComponent.tsx   # Mapa con Leaflet
├── lib/                   # Utilidades
│   ├── types.ts          # Tipos TypeScript
│   ├── api-client.ts     # Cliente API
│   └── auth-context.tsx  # Contexto de autenticación
└── backend/              # API Backend (Cloudflare Workers)
    └── src/              # Código del backend
```

---

## 🐛 Solución de Problemas

### ❌ Error: "Cannot find module 'next'"
```bash
npm install
```

### ❌ Error: "Port 3000 already in use"
```bash
# Matar el proceso en el puerto 3000
lsof -ti:3000 | xargs kill -9
# Luego volver a iniciar
npm run dev
```

### ❌ Error: Backend no responde
```bash
# Verificar que el backend esté corriendo
cd backend
npm run dev
```

### ❌ Error: Base de datos vacía
```bash
# Migrar la base de datos
npm run db:migrate:local
```

---

## 📚 Documentación Completa

Ver `README_NEXTJS.md` para documentación completa del proyecto.

---

## 🎯 Próximos Pasos

1. ✅ Registrar un usuario de prueba
2. ✅ Probar el login
3. ✅ Explorar la interfaz de pasajero
4. ✅ Explorar la interfaz de conductor
5. 📝 Implementar funcionalidades adicionales:
   - Autocomplete de direcciones
   - Cálculo de rutas
   - Sistema de pagos
   - Chat en tiempo real
   - Notificaciones

---

**¿Necesitas ayuda?** Revisa la documentación completa en `README_NEXTJS.md` y `MIGRACION_COMPLETADA.md`

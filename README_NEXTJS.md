# MoTaxi - Versión Next.js

Aplicación web de mototaxis construida con Next.js 15, TypeScript y Tailwind CSS.

## 🚀 Migración de React Native a Next.js

Este proyecto ha sido migrado de React Native (Expo) a Next.js para mejor acceso desde navegadores web en dispositivos móviles.

## 📋 Código Reutilizado

### ✅ Completamente Reutilizado:
- **Backend completo** (`/backend`) - Cloudflare Workers con Hono
- **Base de datos** (`cloudflare_d1_schema.sql`) - Schema SQL completo
- **Tipos TypeScript** (`lib/types.ts`) - Todas las interfaces y tipos
- **Lógica de negocio** - Autenticación, viajes, pagos, notificaciones

### ⚠️ Adaptado para Web:
- **Cliente API** - De AsyncStorage a cookies del navegador
- **Componentes UI** - De React Native a HTML/CSS con Tailwind
- **Mapas** - De react-native-maps a Leaflet
- **Navegación** - De React Navigation a Next.js App Router
- **Geolocalización** - De expo-location a Browser Geolocation API

## 🛠 Tecnologías

- **Next.js 15** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utility-first
- **Leaflet** - Mapas interactivos
- **Axios** - Cliente HTTP
- **Cloudflare Workers** - Backend serverless
- **Cloudflare D1** - Base de datos SQL

## 📦 Instalación

1. **Instalar dependencias del frontend:**
```bash
npm install
```

2. **Instalar dependencias del backend:**
```bash
cd backend
npm install
cd ..
```

3. **Configurar variables de entorno:**
```bash
cp .env.local.example .env.local
```

Editar `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8787
```

## 🚀 Desarrollo

### Iniciar el backend (Cloudflare Workers):
```bash
npm run backend:dev
```

El backend estará disponible en `http://localhost:8787`

### Iniciar el frontend (Next.js):
En otra terminal:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

### Migrar la base de datos localmente:
```bash
npm run db:migrate:local
```

## 📁 Estructura del Proyecto

```
motaxi/
├── app/                      # Next.js App Router
│   ├── auth/                 # Páginas de autenticación
│   │   ├── login/
│   │   ├── register/
│   │   └── role-selection/
│   ├── passenger/            # Páginas de pasajero
│   ├── driver/               # Páginas de conductor
│   ├── layout.tsx            # Layout principal
│   ├── page.tsx              # Página de inicio
│   └── globals.css           # Estilos globales
├── components/               # Componentes React
│   ├── MapComponent.tsx      # Componente de mapa con Leaflet
│   └── ui/                   # Componentes UI reutilizables
├── lib/                      # Utilidades y servicios
│   ├── types.ts              # Tipos TypeScript (del proyecto RN)
│   ├── api-client.ts         # Cliente API adaptado
│   └── auth-context.tsx      # Contexto de autenticación
├── backend/                  # Backend (MANTENIDO IGUAL)
│   ├── src/
│   │   ├── routes/           # Rutas del API
│   │   ├── utils/            # Utilidades
│   │   └── index.ts          # Punto de entrada
│   ├── wrangler.toml         # Config Cloudflare
│   └── package.json
├── public/                   # Archivos estáticos
├── cloudflare_d1_schema.sql  # Schema DB (MANTENIDO IGUAL)
├── next.config.ts            # Configuración Next.js
├── tailwind.config.ts        # Configuración Tailwind
├── tsconfig.json             # Configuración TypeScript
└── package.json              # Dependencias frontend
```

## 🔑 Características Implementadas

### Autenticación:
- ✅ Login con email y contraseña
- ✅ Registro de usuarios (pasajero/conductor)
- ✅ Selección de rol
- ✅ Contexto de autenticación con React Context
- ✅ Persistencia con cookies

### Pasajero:
- ✅ Vista de mapa con ubicación actual
- ✅ Input de origen y destino
- ✅ Cálculo de tarifa estimada
- ✅ Solicitud de viaje

### Conductor:
- ✅ Vista de mapa con ubicación en tiempo real
- ✅ Toggle de disponibilidad
- ✅ Resumen de ganancias
- ✅ Espera de solicitudes

## 🌐 Despliegue

### Frontend (Vercel):
```bash
npm run build
```

Luego despliega en Vercel conectando el repositorio.

### Backend (Cloudflare Workers):
```bash
npm run backend:deploy
```

## 📝 Próximos Pasos

1. **Implementar autocomplete de direcciones** (Google Places API)
2. **WebSockets para tiempo real** (Cloudflare Durable Objects)
3. **Notificaciones push web**
4. **Sistema de pagos** (integración con Wompi)
5. **Chat en tiempo real**
6. **Historial de viajes**
7. **Calificaciones y comentarios**
8. **Panel de administración**

## 🔄 Diferencias con la Versión React Native

| Aspecto | React Native | Next.js |
|---------|--------------|---------|
| Plataforma | iOS/Android nativo | Web (móvil/escritorio) |
| Mapas | react-native-maps | Leaflet |
| Navegación | React Navigation | Next.js App Router |
| Almacenamiento | AsyncStorage | Cookies/LocalStorage |
| Estilos | StyleSheet | Tailwind CSS |
| Geolocalización | expo-location | Browser API |
| Notificaciones | expo-notifications | Web Push API |

## 📚 Documentación

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Leaflet](https://leafletjs.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

## 🤝 Contribuir

El backend y la base de datos son compartidos entre ambas versiones (React Native y Next.js), así que cualquier cambio en el backend afectará ambas plataformas.

## 📄 Licencia

Privado

# ✅ Solución: Error de Network en Axios

## ❌ Error Original
```
AxiosError: Network Error
at async Object.register (lib/api-client.ts:90:22)
```

## 🔍 Causa del Error

El error se debía a **dos problemas**:

### 1. Backend no estaba corriendo
El backend de Cloudflare Workers no estaba iniciado, por lo que no había servidor en `http://localhost:8787`

### 2. Configuración de `withCredentials` con CORS
La configuración `withCredentials: true` en axios requiere que el backend envíe headers específicos de CORS para permitir credenciales, lo cual no es necesario en desarrollo local.

## ✅ Soluciones Aplicadas

### 1. Iniciar el Backend
```bash
cd backend
npm run dev
```

✅ Backend ahora corriendo en: `http://localhost:8787`

### 2. Corregir configuración de axios
Removimos `withCredentials: true` del cliente de axios ya que:
- No estamos usando cookies HttpOnly desde el backend
- Las cookies se manejan desde el navegador
- CORS está configurado con `origin: '*'` en desarrollo

**Archivo modificado:** `lib/api-client.ts`

## 🧪 Verificación

### Test del Backend:
```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","phone":"3001234567","full_name":"Test User","role":"passenger"}'
```

**Respuesta exitosa:**
```json
{
  "user": {
    "id": "e16b464f-5222-4618-8925-127239d54a80",
    "email": "test@test.com",
    "phone": "3001234567",
    "full_name": "Test User",
    "role": "passenger",
    "created_at": 1769053646
  },
  "token": "f08ddcc9-484a-41b5-87e4-f485af2ca73c",
  "expiresAt": 1771645646
}
```

## 📋 Checklist para Evitar este Error

Antes de iniciar la aplicación, verifica:

- [ ] ✅ Backend corriendo en puerto 8787
  ```bash
  cd backend
  npm run dev
  ```

- [ ] ✅ Frontend corriendo en puerto 3000
  ```bash
  npm run dev
  ```

- [ ] ✅ Variable de entorno configurada
  ```bash
  # .env.local
  NEXT_PUBLIC_API_URL=http://localhost:8787
  ```

- [ ] ✅ Ambos servidores deben estar activos simultáneamente

## 🚀 Inicio Rápido (2 Terminales)

### Terminal 1 - Backend:
```bash
cd /home/julian/Documentos/sites/motaxi/backend
npm run dev
```

Espera hasta ver:
```
Ready on http://localhost:8787
```

### Terminal 2 - Frontend:
```bash
cd /home/julian/Documentos/sites/motaxi
npm run dev
```

Espera hasta ver:
```
Ready in 2.3s
Local: http://localhost:3000
```

## ✅ Estado Actual

- ✅ Backend: Corriendo en http://localhost:8787
- ✅ Frontend: Corriendo en http://localhost:3000
- ✅ CORS: Configurado correctamente
- ✅ Axios: Configurado sin `withCredentials`
- ✅ Registro: Funcionando correctamente

## 🎯 Prueba Ahora

1. Ve a http://localhost:3000
2. Haz clic en "Regístrate aquí"
3. Selecciona "Pasajero" o "Conductor"
4. Completa el formulario
5. ✅ El registro debería funcionar sin errores

## 🐛 Si Persiste el Error

1. **Reiniciar ambos servidores:**
   ```bash
   # Matar todos los procesos
   pkill -f "next dev"
   pkill -f "wrangler dev"

   # Reiniciar
   cd backend && npm run dev &
   cd .. && npm run dev
   ```

2. **Verificar puertos:**
   ```bash
   lsof -ti:8787  # Backend
   lsof -ti:3000  # Frontend
   ```

3. **Limpiar cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

## 📚 Referencias

- Error corregido en: `lib/api-client.ts:14`
- Backend configurado en: `backend/src/index.ts`
- Variables de entorno: `.env.local`

---

**Fecha de solución:** 21 de Enero, 2026
**Estado:** ✅ Resuelto

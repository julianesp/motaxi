# 🚀 Guía Rápida: Aplicar Modo Seguridad

## ⚡ Pasos para activar las funcionalidades de emergencia

### 1. Aplicar Migración de Base de Datos

```bash
cd backend

# Aplicar migración de modo seguridad
wrangler d1 execute motaxi-db --local --file=migrations/add_emergency_features.sql
```

**Resultado esperado:**
```
🌀 Executing on local database motaxi-db from migrations/add_emergency_features.sql:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
✅ Successfully executed migrations/add_emergency_features.sql
```

### 2. Verificar Tablas Creadas

```bash
wrangler d1 execute motaxi-db --local --command "
  SELECT name FROM sqlite_master
  WHERE type='table' AND name LIKE '%emergency%' OR name LIKE '%sos%' OR name LIKE '%trip_share%'
"
```

**Deberías ver:**
- `emergency_contacts`
- `sos_alerts`
- `trip_shares`

### 3. Reiniciar Backend

```bash
# Si el backend está corriendo, reinícialo
# Ctrl+C para detener
npm run dev
```

### 4. Probar con curl

#### Crear Contacto de Emergencia:

```bash
# Primero, obtén tu token (login)
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tu@email.com", "password": "tu_password"}'

# Guarda el token
TOKEN="el_token_que_recibiste"

# Crear contacto
curl -X POST http://localhost:8787/emergency/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "María González",
    "phone": "+573001234567",
    "relationship": "Madre",
    "is_primary": true
  }'
```

#### Listar Contactos:

```bash
curl -X GET http://localhost:8787/emergency/contacts \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Probar en la App (Expo)

```bash
# En la raíz del proyecto
npm start
```

Luego en la app:
1. Ve a **Perfil → Contactos de Emergencia** (si agregaste la ruta)
2. O solicita un viaje para ver el botón SOS

---

## 🔍 Troubleshooting

### Error: "table emergency_contacts already exists"
```bash
# Ya está aplicada, no hay problema
# Verificar que las tablas existen:
wrangler d1 execute motaxi-db --local --command "SELECT * FROM emergency_contacts LIMIT 1"
```

### Error: "no such table: emergency_contacts"
```bash
# Aplicar migración nuevamente
cd backend
wrangler d1 execute motaxi-db --local --file=migrations/add_emergency_features.sql
```

### Error: "module not found: emergency.ts"
```bash
# Verificar que emergency.ts existe
ls backend/src/routes/emergency.ts

# Verificar que está importado en index.ts
grep "emergencyRoutes" backend/src/index.ts
```

---

## ✅ Verificación Final

### Checklist:
- [ ] Migración aplicada sin errores
- [ ] Tablas creadas (emergency_contacts, sos_alerts, trip_shares)
- [ ] Backend reiniciado
- [ ] Endpoint /emergency/contacts responde
- [ ] App muestra botón SOS en viajes activos

---

## 📝 Comandos Útiles

### Ver todos los contactos en BD:
```bash
wrangler d1 execute motaxi-db --local --command "SELECT * FROM emergency_contacts"
```

### Ver alertas SOS activas:
```bash
wrangler d1 execute motaxi-db --local --command "SELECT * FROM sos_alerts WHERE status = 'active'"
```

### Ver viajes compartidos:
```bash
wrangler d1 execute motaxi-db --local --command "SELECT * FROM trip_shares WHERE is_active = 1"
```

### Limpiar alertas de prueba:
```bash
wrangler d1 execute motaxi-db --local --command "DELETE FROM sos_alerts WHERE status = 'active'"
```

---

## 🎉 ¡Listo!

Si todos los pasos funcionaron, ahora tienes:
- ✅ Contactos de emergencia funcionando
- ✅ Botón SOS listo para usar
- ✅ Compartir viajes operativo

**Siguiente paso:** Prueba en la app móvil con Expo Go o crea un development build.

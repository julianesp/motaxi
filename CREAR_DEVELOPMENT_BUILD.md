# 📱 Crear Development Build - Paso a Paso

## ⚠️ Por Qué Necesitas Esto

El error que ves:
```
ERROR expo-notifications: Android Push notifications functionality was removed from Expo Go
```

**Es NORMAL**. No es un error de código, simplemente Expo Go no soporta notificaciones push remotas desde SDK 53.

**Solución**: Crear un APK personalizado (Development Build) que SÍ soporta todo.

---

## 🚀 Opción 1: EAS Build (Recomendada - 15 minutos)

### Paso 1: Login en Expo

```bash
eas login
```

Ingresa tu email y contraseña de Expo. Si no tienes cuenta:
```bash
eas register
```

### Paso 2: Crear el Build

```bash
cd /home/julian/Documentos/sites/motaxi
eas build --profile development --platform android
```

El comando te preguntará:
- **"Would you like to automatically create an EAS project?"** → `Y` (yes)
- **"Generate a new Android Keystore?"** → `Y` (yes)

### Paso 3: Esperar (~10-15 minutos)

Verás algo como:
```
✔ Build started
✔ Build URL: https://expo.dev/accounts/tu-usuario/projects/motaxi/builds/...

⏱️  Waiting for build to complete...
```

### Paso 4: Descargar el APK

Cuando termine, te dará un link:
```
✔ Build finished!
📦 Download: https://expo.dev/.../build-....apk
```

1. Abre ese link en tu teléfono
2. Descarga el APK
3. Instálalo (puede pedir "Permitir instalar de fuentes desconocidas")

### Paso 5: Abrir la App

1. **NO abras Expo Go**
2. Abre la app **MoTaxi** que acabas de instalar
3. En tu computadora, ejecuta:
   ```bash
   npm start
   ```
4. Escanea el QR con la app MoTaxi (no Expo Go)

---

## 🔧 Opción 2: Build Local (Más Rápido, Requiere Android Studio)

### Requisitos:
- Android Studio instalado
- Android SDK configurado
- ~5 GB de espacio libre

### Paso 1: Generar Archivos Nativos

```bash
cd /home/julian/Documentos/sites/motaxi
npx expo prebuild --clean
```

### Paso 2: Conectar Teléfono o Iniciar Emulador

**Opción A - Teléfono físico:**
1. Conecta tu Android por USB
2. Habilita "Depuración USB" en Opciones de Desarrollador
3. Verifica: `adb devices` (debe aparecer tu dispositivo)

**Opción B - Emulador:**
1. Abre Android Studio
2. AVD Manager → Crear/Iniciar emulador

### Paso 3: Ejecutar

```bash
npx expo run:android
```

Esto:
- Compila la app
- La instala en tu dispositivo/emulador
- La abre automáticamente

---

## ✅ Verificar que Funcionó

### 1. Icono Diferente

La app NO debe decir "Expo Go", debe decir "MoTaxi" con tu icono.

### 2. Sin Errores de Push Notifications

Al abrir la app, NO deberías ver el error:
```
expo-notifications: Android Push notifications functionality was removed...
```

### 3. Probar Notificaciones

1. Regístrate como pasajero
2. La app pedirá permisos de notificaciones → **Acepta**
3. Abre otra sesión (o usa otro dispositivo) como conductor
4. Acepta un viaje
5. El pasajero **debe recibir una notificación push** 🔔

---

## 🐛 Solución de Problemas

### "eas: command not found"

```bash
npm install -g eas-cli
eas login
```

### "Build failed: Invalid credentials"

```bash
eas logout
eas login
```

Asegúrate de usar las credenciales correctas.

### "You don't have permission to create builds"

Tu cuenta de Expo debe estar verificada. Revisa tu email.

### Build local falla con "SDK location not found"

1. Abre Android Studio
2. File → Settings → Appearance & Behavior → System Settings → Android SDK
3. Copia la ruta de "Android SDK Location"
4. Crea archivo `local.properties` en `android/`:
   ```
   sdk.dir=/ruta/a/tu/Android/Sdk
   ```

### "App instala pero no abre"

```bash
# Ver logs en tiempo real
adb logcat | grep MoTaxi
```

---

## 🔄 Actualizar el Build

Cada vez que cambies código nativo (plugins, permisos, etc.):

```bash
# Opción 1: EAS
eas build --profile development --platform android

# Opción 2: Local
npx expo prebuild --clean
npx expo run:android
```

Para cambios solo en JavaScript (pantallas, lógica, etc.):
- NO necesitas rebuild
- Solo `npm start` y la app se actualizará automáticamente

---

## 💡 Tips

### Desarrollo Más Rápido

Una vez que tengas el development build instalado:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
npm start
```

La app se actualizará automáticamente con cada cambio en el código (Hot Reload).

### QR No Funciona

Si el QR no escanea:

1. En la terminal donde corriste `npm start`, presiona `s`
2. Selecciona "Switch to production mode" → No
3. Te mostrará una URL como: `exp://192.168.1.10:8081`
4. En la app MoTaxi, toca "Enter URL manually"
5. Pega la URL

---

## 📊 Comparación

| Característica | Expo Go | Development Build |
|----------------|---------|-------------------|
| Push Notifications | ❌ No | ✅ Sí |
| Notificaciones Locales | ✅ Sí | ✅ Sí |
| Plugins Nativos | ❌ Limitado | ✅ Todos |
| Hot Reload | ✅ Sí | ✅ Sí |
| Tiempo de Setup | 0 min | 15 min |
| Tamaño App | ~200 MB | ~50 MB |

---

## 🎯 Próximos Pasos

1. **Crea el build** con una de las opciones de arriba
2. **Instálalo** en tu teléfono
3. **Prueba** las notificaciones push
4. **Continúa desarrollando** normalmente

El build solo necesitas crearlo **una vez**. Después de eso, todos los cambios en el código se actualizan automáticamente sin reconstruir.

---

## ❓ ¿Cuál Opción Elegir?

### Elige EAS Build si:
- ✅ No tienes Android Studio
- ✅ Quieres la opción más fácil
- ✅ No te importa esperar 10-15 minutos

### Elige Build Local si:
- ✅ Ya tienes Android Studio configurado
- ✅ Quieres builds más rápidos (2-3 minutos)
- ✅ Necesitas debuggear código nativo

---

**¿Listo? Ejecuta uno de los comandos de arriba y en 15 minutos tendrás tu app funcionando con push notifications.** 🚀

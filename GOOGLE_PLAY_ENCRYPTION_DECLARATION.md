# Declaración de Encriptación para Google Play Console

## ¿Tu app usa encriptación?

**Respuesta: SÍ** (marca el checkbox)

## Tipo de encriptación utilizada

Tu aplicación MoTaxi usa encriptación de la siguiente manera:

### 1. **Encriptación Estándar (Exenta de regulación)**
- ✅ HTTPS/TLS para comunicaciones con el servidor API
- ✅ Almacenamiento seguro de datos usando AsyncStorage (React Native)
- ✅ Conexiones seguras a Google Maps API

### 2. **Encriptación en el Backend (No afecta a la app móvil)**
- Bcrypt para hashear contraseñas (se ejecuta en Cloudflare Workers, no en el dispositivo)
- Tokens de sesión UUID (no es encriptación criptográfica)

## Declaración para Google Play Console

Cuando Google Play Console te pregunte sobre encriptación, debes responder:

### Pregunta 1: "¿Tu app usa encriptación?"
**Respuesta: SÍ**

### Pregunta 2: "¿Qué tipo de encriptación usa tu app?"
**Selecciona:**
- ✅ **"La app usa solo encriptación estándar proporcionada por Android"**
- ✅ **"La app usa HTTPS/TLS para comunicaciones"**

### Pregunta 3: "¿La encriptación está exenta de las regulaciones de exportación de EE.UU.?"
**Respuesta: SÍ**

**Justificación:**
- Tu app usa únicamente HTTPS/TLS estándar
- No implementa algoritmos criptográficos personalizados en el cliente
- Toda la criptografía sensible (bcrypt) se ejecuta en el servidor, no en el dispositivo
- Cumple con la excepción (b)(1) de las Export Administration Regulations (EAR)

### Pregunta 4: "¿Has agregado o modificado funciones de encriptación?"
**Respuesta: NO**
- Solo usas las bibliotecas estándar de Android y React Native
- No has creado algoritmos de encriptación personalizados

## Documentación de soporte

Si Google solicita documentación adicional, puedes proporcionar:

1. **app.config.js** - Muestra la configuración de seguridad de red
2. **package.json** - Lista de dependencias (sin bibliotecas de encriptación custom)
3. **Esta declaración** - Explicación técnica del uso de encriptación

## Configuración técnica implementada

✅ `usesCleartextTraffic: false` - Solo permite conexiones HTTPS
✅ `network_security_config.xml` - Configuración de seguridad de red
✅ Certificados del sistema como fuente de confianza
✅ Plugin `expo-build-properties` configurado

## Referencias legales

- **EAR Category 5, Part 2**: Productos de seguridad de información
- **Excepción (b)(1)**: Software que usa encriptación estándar disponible públicamente
- **Note 4 to Category 5, Part 2**: Encriptación SSL/TLS está generalmente exenta

## En resumen

Tu app **SÍ usa encriptación**, pero está **EXENTA de las regulaciones de exportación** porque:
- Solo usa HTTPS/TLS estándar
- No implementa criptografía personalizada en el cliente
- Cumple con las excepciones de las regulaciones de EE.UU.

**Marca el checkbox en Google Play Console y selecciona que la encriptación está exenta.**

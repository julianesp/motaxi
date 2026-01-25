# Tips de Desarrollo - MoTaxi

## Desarrollo Local

### 1. Configuración del Entorno

#### Instalar Expo Go en tu dispositivo
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)

#### Configurar Android Studio (para emulador Android)
```bash
# Verificar instalación
adb devices

# Iniciar emulador
emulator -avd Pixel_5_API_31
```

#### Configurar Xcode (para simulador iOS - solo macOS)
```bash
# Listar simuladores disponibles
xcrun simctl list devices

# Iniciar simulador
open -a Simulator
```

### 2. Debugging

#### React Native Debugger
```bash
# Instalar
brew install --cask react-native-debugger

# O descargar desde
# https://github.com/jhen0409/react-native-debugger/releases
```

#### Chrome DevTools
1. Ejecutar `npm start`
2. Presionar `j` para abrir debugger
3. En Chrome, abrir DevTools (F12)

#### Flipper (Recomendado)
```bash
# Instalar Flipper
# https://fbflipper.com/

# Plugins útiles:
# - Network Inspector
# - Databases
# - React DevTools
# - Logs
```

### 3. Tips de Productividad

#### Hot Reload
- Guardar archivo → cambios se reflejan automáticamente
- Si no funciona, presiona `r` en terminal

#### Fast Refresh
- Preserva el estado de componentes al hacer cambios
- Si hay errores, presiona `r` para reload completo

#### Snippets útiles de VS Code

Crear `.vscode/snippets.json`:
```json
{
  "React Native Component": {
    "prefix": "rnc",
    "body": [
      "import React from 'react';",
      "import { View, Text, StyleSheet } from 'react-native';",
      "",
      "interface ${1:ComponentName}Props {",
      "  $2",
      "}",
      "",
      "const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = (props) => {",
      "  return (",
      "    <View style={styles.container}>",
      "      <Text>$3</Text>",
      "    </View>",
      "  );",
      "};",
      "",
      "const styles = StyleSheet.create({",
      "  container: {",
      "    $4",
      "  },",
      "});",
      "",
      "export default ${1:ComponentName};"
    ]
  }
}
```

### 4. Testing en Dispositivo Real

#### Android
```bash
# Habilitar modo desarrollador en el dispositivo
# Configuración > Acerca del teléfono > Tocar 7 veces en "Número de compilación"

# Habilitar depuración USB
# Configuración > Opciones de desarrollador > Depuración USB

# Conectar dispositivo y verificar
adb devices

# Ejecutar app
npm run android
```

#### iOS (requiere macOS + dispositivo iOS)
```bash
# Abrir Xcode
# Conectar dispositivo
# Seleccionar dispositivo en Xcode
# Build & Run
```

### 5. Solución de Problemas Comunes

#### Error: "Metro bundler already running"
```bash
# Matar proceso
npx react-native start --reset-cache
# O
pkill -f "node.*metro"
```

#### Error: "Unable to resolve module"
```bash
# Limpiar caché
npm start -- --reset-cache
watchman watch-del-all
rm -rf node_modules
npm install
```

#### Error de permisos de ubicación
- Verificar en Settings del dispositivo/emulador
- Reiniciar app después de otorgar permisos

#### Maps no se muestran
1. Verificar API key en `app.config.js`
2. Verificar que Maps SDK esté habilitado en Google Cloud
3. Verificar restricciones de API key

### 6. Estructura de Commits (Recomendada)

```bash
# Formato
<type>(<scope>): <subject>

# Tipos
feat:     Nueva característica
fix:      Corrección de bug
docs:     Cambios en documentación
style:    Formateo, sin cambios de código
refactor: Refactorización de código
test:     Agregar tests
chore:    Tareas de mantenimiento

# Ejemplos
git commit -m "feat(auth): add password reset functionality"
git commit -m "fix(maps): resolve marker positioning issue"
git commit -m "docs(readme): update installation instructions"
```

### 7. Extensiones de VS Code Recomendadas

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "dsznajder.es7-react-js-snippets",
    "msjsdiag.vscode-react-native"
  ]
}
```

### 8. Configuración de ESLint y Prettier

#### .eslintrc.js
```javascript
module.exports = {
  extends: [
    'expo',
    'prettier',
  ],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
  },
};
```

#### .prettierrc
```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100,
  "arrowParens": "always"
}
```

### 9. Gestión de Estado - Mejores Prácticas

#### Cuándo usar cada hook

```typescript
// useState: Estado local simple
const [count, setCount] = useState(0);

// useEffect: Efectos secundarios
useEffect(() => {
  loadData();
}, [dependency]);

// useCallback: Memoizar funciones
const handlePress = useCallback(() => {
  doSomething(value);
}, [value]);

// useMemo: Memoizar valores computados
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// useRef: Valores que no causan re-render
const previousValue = useRef(null);
```

### 10. Performance Tips

#### Evitar renders innecesarios
```typescript
// ❌ Malo
const Component = () => {
  return (
    <TouchableOpacity onPress={() => handlePress(item.id)}>
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );
};

// ✅ Bueno
const Component = () => {
  const handleItemPress = useCallback(() => {
    handlePress(item.id);
  }, [item.id]);

  return (
    <TouchableOpacity onPress={handleItemPress}>
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );
};
```

#### Optimizar FlatList
```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={10}
/>
```

### 11. Patrones de Código Útiles

#### Custom Hooks
```typescript
// useLocation.ts
export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getLocation = async () => {
      try {
        const loc = await LocationService.getCurrentLocation();
        setLocation(loc);
      } catch (err) {
        setError(err.message);
      }
    };

    getLocation();
  }, []);

  return { location, error };
};
```

#### Error Boundaries
```typescript
// ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }

    return this.props.children;
  }
}
```

### 12. Logging y Debugging

#### Console con estilo
```typescript
const logger = {
  info: (message: string, data?: any) => {
    console.log(`ℹ️ [INFO] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`❌ [ERROR] ${message}`, error || '');
  },
  success: (message: string) => {
    console.log(`✅ [SUCCESS] ${message}`);
  },
  debug: (message: string, data?: any) => {
    if (__DEV__) {
      console.log(`🐛 [DEBUG] ${message}`, data || '');
    }
  },
};
```

### 13. Comandos Útiles

```bash
# Ver logs en tiempo real
npx react-native log-android  # Android
npx react-native log-ios      # iOS

# Limpiar build
cd android && ./gradlew clean  # Android
rm -rf ios/build              # iOS

# Verificar tipos TypeScript
npx tsc --noEmit

# Verificar linting
npx eslint . --ext .ts,.tsx

# Formatear código
npx prettier --write "**/*.{ts,tsx,json}"

# Ver bundle size
npx expo-cli customize:web
npm run analyze
```

### 14. Recursos Útiles

#### Documentación
- [React Native](https://reactnative.dev/)
- [Expo](https://docs.expo.dev/)
- [Supabase](https://supabase.com/docs)
- [React Navigation](https://reactnavigation.org/)

#### Comunidades
- [React Native Discord](https://discord.gg/reactiflux)
- [Expo Discord](https://chat.expo.dev/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native)

#### Herramientas Online
- [Snack - Expo Playground](https://snack.expo.dev/)
- [React Native Directory](https://reactnative.directory/)
- [Can I Use - React Native](https://caniuse.com/)

---

¡Feliz coding! 🚀

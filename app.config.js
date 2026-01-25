export default {
  expo: {
    name: 'MoTaxi',
    slug: 'motaxi',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#FF6B6B',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.motaxi.app',
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FF6B6B',
      },
      package: 'com.motaxi.app',
      versionCode: 1,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
      usesCleartextTraffic: true, // Permitir HTTP para desarrollo local
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.motaxi.app',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Permitir a MoTaxi usar tu ubicación para mostrarte conductores cercanos y rastrear tus viajes.',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true, // Permitir HTTP para desarrollo local
          },
        },
      ],
    ],
    extra: {
      apiUrl: process.env.API_URL || 'https://motaxi-api.julii1295.workers.dev',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      eas: {
        projectId: '6304b357-05bc-47e7-8ad7-8c3c2a87a7a8',
      },
    },
  },
};

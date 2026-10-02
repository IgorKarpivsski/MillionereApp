import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Working name only. "Millionaire" overlaps an existing TV format trademark —
 * the final name must pass a trademark check before submission (doc §11).
 * Change it here and in src/lib/brand.ts; nothing else hard-codes it.
 */
const APP_NAME = 'מיליונר הכדורגל';
const IS_PROD = process.env.APP_ENV === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? APP_NAME : `${APP_NAME} (dev)`,
  slug: 'football-millionaire',
  scheme: 'footballmillionaire',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#1B1452',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1B1452',
  },
  ios: {
    bundleIdentifier: IS_PROD ? 'com.footballmillionaire.app' : 'com.footballmillionaire.app.dev',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      CFBundleDevelopmentRegion: 'he',
      CFBundleLocalizations: ['he'],
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: IS_PROD ? 'com.footballmillionaire.app' : 'com.footballmillionaire.app.dev',
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#1B1452' },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    ['expo-localization', { supportedLocales: { ios: ['he'], android: ['he'] } }],
    ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 180, backgroundColor: '#1B1452' }],
    '@sentry/react-native',
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Hebrew-only app: always lay out right-to-left.
    supportsRTL: true,
    forcesRTL: true,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});

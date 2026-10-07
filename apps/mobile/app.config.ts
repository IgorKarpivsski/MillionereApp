import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Product name: "האלוף" (chosen 2026-10). It still needs a formal trademark
 * check before store submission (doc §11).
 * Change it here and in src/lib/brand.ts; nothing else hard-codes it.
 * The package id / slug stay as-is so installed builds update in place.
 */
const APP_NAME = 'האלוף';
const IS_PROD = process.env.APP_ENV === 'production';
// AdMob: Google's public TEST app id until the real one is set in the build env.
const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? APP_NAME : `${APP_NAME} (dev)`,
  slug: 'football-millionaire',
  scheme: 'footballmillionaire',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B2B22',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0B2B22',
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
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#0B2B22' },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-audio',
    'expo-web-browser',
    ['expo-localization', { supportedLocales: { ios: ['he'], android: ['he'] } }],
    ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 180, backgroundColor: '#0B2B22' }],
    '@sentry/react-native',
    ['react-native-google-mobile-ads', { androidAppId: ADMOB_ANDROID_APP_ID, iosAppId: ADMOB_IOS_APP_ID }],
    'expo-iap',
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#FFB000' }],
    ['expo-build-properties', { android: { kotlinVersion: '2.2.0' } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Hebrew-only app: always lay out right-to-left.
    supportsRTL: true,
    forcesRTL: true,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});

import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Product name: "טריוויה - האלוף" (chosen 2026-10-15). It still needs a formal trademark
 * check before store submission (doc §11).
 * Change it here and in src/lib/brand.ts; nothing else hard-codes it.
 * The package id / slug stay as-is so installed builds update in place.
 */
const APP_NAME = 'טריוויה - האלוף';
const IS_PROD = process.env.APP_ENV === 'production';
// AdMob: Google's public TEST app id until the real one is set in the build env.
const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-4196315436564582~1233587313';
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
  backgroundColor: '#1E1250',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1E1250',
  },
  ios: {
    bundleIdentifier: IS_PROD ? 'com.haaluf.trivia' : 'com.haaluf.trivia.dev',
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
    package: IS_PROD ? 'com.haaluf.trivia' : 'com.haaluf.trivia.dev',
    // Every store upload needs a higher number; CI passes its run number.
    versionCode: Number(process.env.VERSION_CODE) || 1,
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#5624A2' },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-audio',
    'expo-web-browser',
    ['expo-localization', { supportedLocales: { ios: ['he'], android: ['he'] } }],
    ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 180, backgroundColor: '#1E1250' }],
    '@sentry/react-native',
    ['react-native-google-mobile-ads', { androidAppId: ADMOB_ANDROID_APP_ID, iosAppId: ADMOB_IOS_APP_ID }],
    'expo-iap',
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#FFB000' }],
    ['expo-image-picker', { photosPermission: 'כדי לבחור תמונת פרופיל מהתמונות שלך', cameraPermission: false, microphonePermission: false }],
    './plugins/withoutAudioServices',
    './plugins/withGradleHeap',
    [
      'expo-build-properties',
      {
        android: {
          kotlinVersion: '2.2.0',
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          // R8 for release builds (Play's code-optimization score). Native modules keep their own rules;
          // these keep the reflection-loaded Expo / React Native / in-app purchase classes intact.
          enableMinifyInReleaseBuilds: true,
          extraProguardRules: [
            '-keep class expo.modules.** { *; }',
            '-keep class com.facebook.react.** { *; }',
            '-keep class com.facebook.hermes.** { *; }',
            '-keep class com.swmansion.** { *; }',
            '-keep class dev.hyo.** { *; }',
            '-keep class io.sentry.** { *; }',
            '-dontwarn dev.hyo.**',
            '-dontwarn io.sentry.**',
          ].join('\n'),
        },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Hebrew-only app: always lay out right-to-left.
    supportsRTL: true,
    forcesRTL: true,
    eas: { projectId: process.env.EAS_PROJECT_ID },
    // Store builds show real ads; test builds use Google's test ads.
    appEnv: process.env.APP_ENV ?? 'development',
  },
});

import { DotGothic16_400Regular } from '@expo-google-fonts/dotgothic16';
import {
  IBMPlexSansHebrew_400Regular,
  IBMPlexSansHebrew_600SemiBold,
  IBMPlexSansHebrew_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-hebrew';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ToastProvider } from '@/design-system/components';
import { colors } from '@/design-system/tokens';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { initAnalytics, track } from '@/lib/analytics';
import { strings } from '@/lib/i18n';
import { initMonitoring, wrapRoot } from '@/lib/monitoring';
import { bindOnlineManager } from '@/lib/network';
import { queryClient } from '@/lib/queryClient';
import { ensureRTL } from '@/lib/rtl';
import { initAds } from '@/features/store/ads';
import { useBackgroundMusic } from '@/design-system/feedback/music';
import { EnergySheet } from '@/features/engage/EnergySheet';
import { DealPopup } from '@/features/engage/DealPopup';

ensureRTL();
initMonitoring();
initAnalytics();
void SplashScreen.preventAutoHideAsync();

/** Holds the splash until fonts are loaded and the player has a (guest) session. */
function Gate() {
  const { booting, bootError, retryBoot } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansHebrew_400Regular,
    IBMPlexSansHebrew_600SemiBold,
    IBMPlexSansHebrew_700Bold,
    DotGothic16_400Regular,
  });
  const ready = (fontsLoaded || !!fontError) && !booting;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useBackgroundMusic();
  if (!ready) return null;

  if (bootError) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="cloud-offline-outline"
          title={strings.errors.network}
          body={strings.offline.actionBlocked}
          actionLabel={strings.common.retry}
          onAction={retryBoot}
        />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="design-system" />
        <Stack.Screen name="quiz" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="pack-open" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="match" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="shop" options={{ presentation: 'modal' }} />
        <Stack.Screen name="wheel" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pass" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="trade/[id]" options={{ presentation: 'modal' }} />
      </Stack>
      <EnergySheet />
      <DealPopup />
      <OfflineBanner />
    </>
  );
}

function RootLayout() {
  useEffect(() => {
    track('app_open', { cold_start: true });
    initAds();
    return bindOnlineManager();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <Gate />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
});

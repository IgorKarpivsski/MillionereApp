import { Rubik_400Regular, Rubik_500Medium, Rubik_700Bold, Rubik_900Black } from '@expo-google-fonts/rubik';
import { SecularOne_400Regular } from '@expo-google-fonts/secular-one';
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

ensureRTL();
initMonitoring();
initAnalytics();
void SplashScreen.preventAutoHideAsync();

/** Holds the splash until fonts are loaded and the player has a (guest) session. */
function Gate() {
  const { booting, bootError, retryBoot } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_700Bold,
    Rubik_900Black,
    SecularOne_400Regular,
  });
  const ready = (fontsLoaded || !!fontError) && !booting;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

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
      </Stack>
      <OfflineBanner />
    </>
  );
}

function RootLayout() {
  useEffect(() => {
    track('app_open', { cold_start: true });
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

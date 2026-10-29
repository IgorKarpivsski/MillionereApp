import { DotGothic16_400Regular } from '@expo-google-fonts/dotgothic16';
import {
  IBMPlexSansHebrew_400Regular,
  IBMPlexSansHebrew_600SemiBold,
  IBMPlexSansHebrew_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-hebrew';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AppAlertHost, AppText, EmptyState, ToastProvider } from '@/design-system/components';
import { colors } from '@/design-system/tokens';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { initAnalytics, track } from '@/lib/analytics';
import { strings } from '@/lib/i18n';
import { initMonitoring, reportError, wrapRoot } from '@/lib/monitoring';
import { bindFocusManager, bindOnlineManager } from '@/lib/network';
import { queryClient } from '@/lib/queryClient';
import { ensureRTL } from '@/lib/rtl';
import { AgeBandSync } from '@/features/settings/AgeBandSync';
import { AgeGate } from '@/features/settings/AgeGate';
import { useSettingsStore } from '@/features/settings/store';
import { IncomingCallHost } from '@/features/boosts/IncomingCall';
import { AutoRedeem } from '@/features/referral/AutoRedeem';
import { PurchaseRecovery } from '@/features/store/PurchaseRecovery';
import { RewardFlyHost } from '@/features/home/RewardFly';
import { TourHost } from '@/features/tour/Tour';
import { RemoveAdsUpsell } from '@/features/store/RemoveAdsUpsell';
import { initAds } from '@/features/store/ads';
import { useBackgroundMusic } from '@/design-system/feedback/music';
import { EnergySheet } from '@/features/engage/EnergySheet';
import { useReminders } from '@/features/reminders/useReminders';

ensureRTL();
initMonitoring();
initAnalytics();
void SplashScreen.preventAutoHideAsync();

/** New players go through the first-run screens before anything else. */
function OnboardingRedirect() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  const segments = useSegments();
  const [hydrated, setHydrated] = useState(useSettingsStore.persist.hasHydrated());
  useEffect(() => useSettingsStore.persist.onFinishHydration(() => setHydrated(true)), []);
  const here = segments[0] === 'onboarding' || segments[0] === 'legal';
  useEffect(() => {
    if (hydrated && !onboarded && !here) router.replace('/onboarding');
  }, [hydrated, onboarded, here]);
  return null;
}

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
  useReminders();
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
        <Stack.Screen name="session" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="worlds" />
        <Stack.Screen name="world/[slug]" />
        <Stack.Screen name="album/[slug]" />
        <Stack.Screen name="pack-open" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="match" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="blitz" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="family" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="survival" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="truefalse" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="market" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="mistakes" />
        <Stack.Screen name="submit-question" />
        <Stack.Screen name="event" />
        <Stack.Screen name="player/[id]" />
        <Stack.Screen name="shop" options={{ presentation: 'modal' }} />
        <Stack.Screen name="wheel" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pass" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="avatar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="trade/[id]" options={{ presentation: 'modal' }} />
      </Stack>
      <OnboardingRedirect />
      <EnergySheet />
      <AppAlertHost />
      <OfflineBanner />
      <AgeGate />
      <AgeBandSync />
      <IncomingCallHost />
      <AutoRedeem />
      <PurchaseRecovery />
      <RewardFlyHost />
      <TourHost />
      <RemoveAdsUpsell />
    </>
  );
}

function RootLayout() {
  useEffect(() => {
    track('app_open', { cold_start: true });
    initAds();
    const offOnline = bindOnlineManager();
    const offFocus = bindFocusManager();
    return () => {
      offOnline();
      offFocus();
    };
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

/**
 * A screen that throws while drawing shows this instead of closing the app. Expo Router mounts
 * it in place of the broken route (here: the root), so it uses nothing but plain components.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return (
    <View style={styles.crash}>
      <EmptyState
        icon="construct-outline"
        title={strings.errors.crashTitle}
        body={strings.errors.crashBody}
        actionLabel={strings.common.retry}
        onAction={() => {
          void retry();
        }}
      />
      <Pressable onPress={() => router.replace('/(tabs)')} accessibilityRole="button" hitSlop={12} style={styles.crashHome}>
        <AppText variant="label" color={colors.textMuted}>
          {strings.errors.crashHome}
        </AppText>
      </Pressable>
    </View>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  crash: { flex: 1, backgroundColor: colors.bgDeep, justifyContent: 'center', padding: 24 },
  crashHome: { alignSelf: 'center', marginTop: 16, padding: 8 },
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
});

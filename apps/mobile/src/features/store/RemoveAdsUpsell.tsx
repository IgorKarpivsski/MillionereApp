import { router } from 'expo-router';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText, Card, Glow, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';
import { useInterstitial } from './interstitial';
import { useStore } from './hooks';

/** Shown after a between-games ad now and then: one tap to the "no ads" offer. */
export function RemoveAdsUpsell() {
  const open = useInterstitial((s) => s.upsell);
  const hide = useInterstitial((s) => s.hideUpsell);
  const { data: store } = useStore();
  if (store?.ad_free) return null;
  const t = strings.interstitial;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={hide} statusBarTranslucent>
      <View style={styles.scrim}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
          <Card kind="sticker">
            <View style={styles.center}>
              <Glow size={220} strength={0.5} />
              <AppText style={styles.emoji}>🚫📺</AppText>
            </View>
            <AppText variant="title" align="center">
              {t.title}
            </AppText>
            <AppText color={colors.textMuted} align="center" style={styles.body}>
              {t.body}
            </AppText>
            <StickerButton
              label={t.cta}
              icon="sparkles"
              size="lg"
              tone="prize"
              fullWidth
              onPress={() => {
                hide();
                router.push('/shop');
              }}
            />
            <StickerButton label={t.later} tone="ghost" size="sm" fullWidth style={styles.later} onPress={hide} />
          </Card>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,4,24,0.82)', justifyContent: 'center', padding: space.lg },
  wrap: { width: '100%' },
  center: { height: 110, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 54, lineHeight: 64 },
  body: { marginVertical: space.md },
  later: { marginTop: space.sm },
});

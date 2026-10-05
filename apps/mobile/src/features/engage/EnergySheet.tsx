import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { AppText, BottomSheet, StickerButton, TicketIcon, useToast } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { RpcError } from '@/features/profile/api';
import { showRewardedAd } from '@/features/store/ads';
import { useStore } from '@/features/store/hooks';
import { fmt, strings } from '@/lib/i18n';
import { useCountdownTo, useEnergy, useRefill } from './hooks';

const t = strings.engage;

export const useEnergySheet = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

/**
 * Starts a classic run if the player has a ticket (or VIP); otherwise opens
 * the refill sheet. The server enforces the same rule.
 */
export function usePlayClassic() {
  const { data } = useEnergy();
  const show = useEnergySheet((s) => s.show);
  return () => {
    if (data && !data.unlimited && data.tickets < 1) show();
    else router.push('/quiz');
  };
}

/** Mounted once at the root: "out of tickets" and refill options. */
export function EnergySheet() {
  const { open, hide } = useEnergySheet();
  const { data } = useEnergy();
  const { data: store } = useStore();
  const refill = useRefill();
  const toast = useToast();
  const next = useCountdownTo(data?.next_at);
  if (!data) return null;
  const empty = !data.unlimited && data.tickets < 1;

  const onError = (e: unknown) =>
    toast(e instanceof RpcError && e.code === 'insufficient_funds' ? t.notEnoughGems : strings.errors.generic, 'error');

  return (
    <BottomSheet visible={open} onClose={hide} title={empty ? t.outTitle : t.tickets}>
      <View style={styles.row}>
        {Array.from({ length: Math.max(data.max, data.tickets) }, (_, i) => (
          <View key={i} style={{ opacity: i < data.tickets ? 1 : 0.25 }}>
            <TicketIcon size={36} />
          </View>
        ))}
      </View>
      <AppText color={colors.textMuted} align="center">
        {data.unlimited ? t.unlimited : fmt(t.outBody, { m: data.refill_minutes })}
      </AppText>
      {next && !data.unlimited ? (
        <AppText variant="label" color={colors.led} align="center" accessibilityLiveRegion="polite">
          {fmt(t.nextTicket, { t: next })}
        </AppText>
      ) : null}
      {!data.unlimited && data.tickets < data.max ? (
        <StickerButton
          label={fmt(t.refillGems, { n: data.gem_refill })}
          icon="diamond"
          fullWidth
          loading={refill.isPending && refill.variables === 'gems'}
          onPress={() =>
            refill.mutate('gems', {
              onSuccess: () => {
                toast(t.refilled, 'success');
                hide();
              },
              onError,
            })
          }
        />
      ) : null}
      {!data.unlimited && data.ad_left > 0 ? (
        <StickerButton
          label={t.refillAd}
          icon="play-circle"
          tone="outline"
          fullWidth
          loading={refill.isPending && refill.variables === 'ad'}
          onPress={async () => {
            if (!store?.ad_free && !(await showRewardedAd())) {
              toast(strings.store.adNotFinished, 'info');
              return;
            }
            refill.mutate('ad', { onSuccess: () => toast(t.gotTicket, 'success'), onError });
          }}
        />
      ) : null}
      {!data.unlimited ? (
        <AppText variant="caption" color={colors.textDim} align="center">
          {`${fmt(t.adLeft, { n: data.ad_left })} · ${t.freeModes}`}
        </AppText>
      ) : null}
      {!data.unlimited ? (
        <StickerButton
          label={t.goVip}
          icon="star"
          tone="ghost"
          fullWidth
          onPress={() => {
            hide();
            router.push('/shop');
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm },
});

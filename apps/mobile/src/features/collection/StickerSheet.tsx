import type { Collectible } from '@fm/shared';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, StickerButton, useToast } from '@/design-system/components';
import { playSound } from '@/design-system/feedback/sound';
import { colors, rarityColors, space } from '@/design-system/tokens';
import { RpcError } from '@/features/profile/api';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { useCraft } from './hooks';
import { LegendCard } from './LegendCard';

const t = strings.collection;

/** Sticker details: the bio for an owned sticker, or crafting it from dust when it's missing. */
export function StickerSheet({
  item,
  dust,
  craftCost,
  onClose,
}: {
  item: Collectible | null;
  dust: number;
  craftCost: Record<string, number> | undefined;
  onClose: () => void;
}) {
  const craft = useCraft();
  const toast = useToast();
  const cost = item ? craftCost?.[item.rarity] : undefined;

  return (
    <BottomSheet visible={!!item} onClose={onClose} title={item && item.count > 0 ? item.name : fmt(t.slot, { n: item?.number ?? 0 })}>
      {item ? (
        <View style={styles.sheet}>
          <LegendCard item={item} width={200} locked={item.count === 0} glow={item.glow > 0} />
          {item.count > 0 ? (
            <AppText color={colors.textMuted} align="center">
              {item.bio}
            </AppText>
          ) : (
            <>
              <AppText color={colors.textMuted} align="center">
                {fmt(t.missing, { rarity: rarityColors[item.rarity].label })}
              </AppText>
              {cost ? (
                <StickerButton
                  label={fmt(t.craft, { n: formatNumber(cost) })}
                  tone={dust >= cost ? 'primary' : 'ghost'}
                  disabled={dust < cost}
                  loading={craft.isPending}
                  fullWidth
                  onPress={() =>
                    craft.mutate(item.id, {
                      onSuccess: () => {
                        playSound('rare_reveal');
                        toast(t.crafted, 'success');
                        onClose();
                      },
                      onError: (e) =>
                        toast(e instanceof RpcError && e.code === 'insufficient_funds' ? t.noDust : strings.errors.generic, 'error'),
                    })
                  }
                />
              ) : (
                <AppText variant="caption" color={colors.textDim} align="center">
                  {t.notCraftable}
                </AppText>
              )}
            </>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { alignItems: 'center', gap: space.md },
});

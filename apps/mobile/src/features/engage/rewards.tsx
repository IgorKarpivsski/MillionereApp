import { Ionicons } from '@expo/vector-icons';
import type { Reward } from '@fm/shared';
import { View } from 'react-native';
import { CoinIcon, DustIcon, GemIcon, TicketIcon } from '@/design-system/components';
import { colors } from '@/design-system/tokens';
import { PACK_NAMES, PackArt } from '@/features/collection/PackArt';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.engage;

export function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case 'coins':
    case 'gems':
    case 'dust':
    case 'tickets':
      return fmt(t.rewards[r.kind], { n: formatNumber(r.amount) });
    case 'pack': {
      const p = PACK_NAMES[r.pack ?? 'bronze'];
      return r.amount > 1 ? fmt(t.rewards.packs, { n: r.amount, p }) : fmt(t.rewards.pack, { p });
    }
    case 'cosmetic':
      return (t.cosmetics as Record<string, string>)[r.item ?? ''] ?? t.premium;
  }
}

export function RewardIcon({ r, size = 28 }: { r: Reward; size?: number }) {
  switch (r.kind) {
    case 'coins':
      return <CoinIcon size={size} />;
    case 'gems':
      return <GemIcon size={size} />;
    case 'dust':
      return <DustIcon size={size} />;
    case 'tickets':
      return <TicketIcon size={size} />;
    case 'pack':
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <PackArt slug={r.pack ?? 'bronze'} width={size * 0.6} />
        </View>
      );
    case 'cosmetic':
      return <Ionicons name={r.item?.startsWith('avatar') ? 'happy' : r.item?.startsWith('badge') ? 'ribbon' : 'square-outline'} size={size} color={colors.led} />;
  }
}

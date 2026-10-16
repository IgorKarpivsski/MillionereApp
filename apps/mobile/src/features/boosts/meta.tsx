import { Ionicons } from '@expo/vector-icons';
import type { BoostKind } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/design-system/components';
import { strings } from '@/lib/i18n';

export const BOOST_ORDER: BoostKind[] = ['time', 'freeze', 'skip', 'shield', 'double', 'heart'];

const LOOK: Record<BoostKind, { icon: ComponentProps<typeof Ionicons>['name']; colors: [string, string] }> = {
  time: { icon: 'alarm', colors: ['#7FD1FF', '#3B6FE0'] },
  freeze: { icon: 'snow', colors: ['#C9F3FF', '#4FB4E8'] },
  skip: { icon: 'play-skip-back', colors: ['#B49CFF', '#6A44D8'] },
  shield: { icon: 'shield-checkmark', colors: ['#FFD46B', '#E08A00'] },
  double: { icon: 'flash', colors: ['#FF9AD5', '#C2368F'] },
  heart: { icon: 'heart', colors: ['#FF8A80', '#D3263A'] },
};

export function boostName(b: string): string {
  return (strings.boosts.names as Record<string, string>)[b] ?? b;
}
export function boostDesc(b: string): string {
  return (strings.boosts.desc as Record<string, string>)[b] ?? '';
}

/** A glossy round boost token. */
export function BoostIcon({ boost, size = 44, count, dim = false }: { boost: BoostKind; size?: number; count?: number; dim?: boolean }) {
  const l = LOOK[boost];
  return (
    <View style={{ width: size, height: size, opacity: dim ? 0.45 : 1 }}>
      <LinearGradient colors={l.colors} style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55]}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        {boost === 'double' ? (
          <AppText variant="label" color="#FFFFFF" style={{ fontSize: size * 0.36, lineHeight: size * 0.46 }}>
            x2
          </AppText>
        ) : (
          <Ionicons name={l.icon} size={size * 0.52} color="#FFFFFF" />
        )}
      </LinearGradient>
      {count !== undefined ? (
        <View style={[styles.badge, count === 0 && styles.badgeEmpty]}>
          <AppText variant="caption" color={count === 0 ? '#FFFFFF' : '#140C33'} style={styles.badgeText}>
            {count === 0 ? '+' : String(count)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFB000',
    borderWidth: 1.5,
    borderColor: '#140C33',
  },
  badgeEmpty: { backgroundColor: '#3DDC84' },
  badgeText: { fontFamily: 'IBMPlexSansHebrew_700Bold', fontSize: 11, lineHeight: 14 },
});

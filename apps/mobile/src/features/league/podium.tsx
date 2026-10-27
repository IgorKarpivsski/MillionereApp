import type { ReactNode } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import { AppText, Led } from '@/design-system/components';
import { colors } from '@/design-system/tokens';

/** Gold, silver and bronze for the top three of any table. */
export const PODIUM: Record<number, { color: string; tint: string; medal: string }> = {
  1: { color: '#FFC93C', tint: 'rgba(255,201,60,0.16)', medal: '🥇' },
  2: { color: '#D3DCE8', tint: 'rgba(211,220,232,0.12)', medal: '🥈' },
  3: { color: '#E0904F', tint: 'rgba(224,144,79,0.14)', medal: '🥉' },
};

/** The rank cell: a medal for the top three, the number for everyone else. */
export function RankMark({ rank, style, dim }: { rank: number; style?: TextStyle; dim?: boolean }) {
  const p = PODIUM[rank];
  if (p) {
    return (
      <AppText style={[styles.medal, style]} accessibilityLabel={String(rank)}>
        {p.medal}
      </AppText>
    );
  }
  return (
    <Led size="number" color={dim ? colors.textDim : colors.text} style={style}>
      {rank}
    </Led>
  );
}

/** A coloured ring (and a crown for the first) around a top-three avatar. */
export function PodiumFrame({ rank, size, children }: { rank: number; size: number; children: ReactNode }) {
  const p = PODIUM[rank];
  if (!p) return <>{children}</>;
  return (
    <View style={[styles.ring, { borderColor: p.color, borderRadius: size }]}>
      {children}
      {rank === 1 ? <AppText style={styles.crown}>👑</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  medal: { fontSize: 22, minWidth: 28, textAlign: 'center' },
  ring: { borderWidth: 3, padding: 1 },
  crown: { position: 'absolute', top: -14, alignSelf: 'center', fontSize: 16 },
});

import { MATCH_PUZZLES, parseEquation } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { fmt, strings } from '@/lib/i18n';
import { usePuzzlesState } from './api';
import { MatchBoard } from './MatchBoard';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';

const t = strings.puzzles;
const DEMO = parseEquation('5+7=2');

/** Entry card for the matchstick brain games. */
export function PuzzlesCard() {
  const { data } = usePuzzlesState();
  return (
    <Pressable
      onPress={() => router.push('/puzzles')}
      accessibilityRole="button"
      accessibilityLabel={t.title}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image source={WORLD_IMAGES.puzzle} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(62,42,158,0.55)', 'rgba(40,20,110,0.92)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="label" color={colors.led}>
            🧠 {t.title}
          </AppText>
          <AppText variant="title">{t.cardTitle}</AppText>
        </View>
        <View style={styles.badge}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
            {fmt(t.progress, { n: data?.solved.length ?? 0, total: MATCH_PUZZLES.length })}
          </AppText>
        </View>
      </View>
      <View style={styles.demo} pointerEvents="none">
        <MatchBoard glyphs={DEMO} width={260} placeable={false} selectable={false} onSlot={() => undefined} />
      </View>
      <AppText color={colors.text}>{t.cardBody}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderRadius: 24, overflow: 'hidden', borderBottomWidth: 6, borderBottomColor: '#24145E' },
  pressed: { transform: [{ scale: 0.98 }] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  badge: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.led, maxWidth: 130 },
  demo: { alignSelf: 'center' },
});

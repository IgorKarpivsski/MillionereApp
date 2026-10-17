import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Card, Skeleton, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useCountdownTo } from '@/features/engage/hooks';
import { useEvent } from '@/features/teen/api';
import { RankList } from '@/features/teen/RankList';
import { useWorldsConfig, worldBySlug } from '@/features/worlds/api';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { fmt, strings } from '@/lib/i18n';

const t = strings.teen;

/** This week's themed world: what it gives, how long it lasts, and who leads. */
export default function EventScreen() {
  const { data } = useEvent();
  const worlds = useWorldsConfig();
  const left = useCountdownTo(data?.active ? data.ends_at : null);
  const active = data?.active ? data : null;
  const w = active ? worldBySlug(worlds, active.world) : null;
  const days = active ? Math.floor((new Date(active.ends_at).getTime() - Date.now()) / 86_400_000) : 0;
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.flex} numberOfLines={1}>
          {w ? fmt(t.eventTitle, { world: w.name }) : t.eventTable}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!data ? <Skeleton height={200} rounded={18} /> : null}
        {active && w ? (
          <>
            <View style={styles.hero}>
              <LinearGradient colors={['#FFB000', w.color, '#4B2A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              {WORLD_IMAGES[w.icon] ? <Image source={WORLD_IMAGES[w.icon]!} style={styles.art} /> : null}
              <AppText variant="heading" align="center">
                {fmt(t.eventBody, { world: w.name, mult: active.coins_mult })}
              </AppText>
              <AppText variant="label" align="center">
                {`⏳ ${fmt(t.eventEnds, { t: days >= 1 ? fmt(t.eventDays, { n: days }) : (left ?? '') })}`}
              </AppText>
              <StickerButton
                label={t.eventPlay}
                icon="play"
                tone="prize"
                fullWidth
                onPress={() => router.push({ pathname: '/world/[slug]', params: { slug: w.slug } })}
              />
            </View>
            <Card kind="sticker" padding={space.md}>
              <AppText variant="label" align="center">
                {active.me ? fmt(t.eventRank, { n: active.me.rank }) : t.eventNoRank}
              </AppText>
            </Card>
            <AppText variant="heading">{t.eventTable}</AppText>
            {active.rows.length ? (
              <RankList rows={active.rows} />
            ) : (
              <AppText color={colors.textMuted} align="center">
                {t.eventEmpty}
              </AppText>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  hero: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,226,122,0.8)',
    overflow: 'hidden',
  },
  art: { width: 110, height: 110, borderRadius: 26 },
});

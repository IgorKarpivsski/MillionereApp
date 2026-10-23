import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Icon, Screen, Sheen, Sloth, StickerButton, useCountdownToMidnight } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useEnergySheet, usePlaySession } from '@/features/engage/EnergySheet';
import { useEnergy } from '@/features/engage/hooks';
import { ModeTile } from '@/features/home/ModeTile';
import { useBlitzInfo, useSurvivalInfo, useTfInfo } from '@/features/modes/api';
import { useDailyStatus } from '@/features/quiz/hooks';
import { useSettingsStore } from '@/features/settings/store';
import { EventCard } from '@/features/teen/HomeCards';
import { useWorldsConfig, useWorldsState } from '@/features/worlds/api';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { fmt, strings } from '@/lib/i18n';

const t = strings.modes;
const p = strings.playTab;

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLine} />
      <AppText variant="heading">{children}</AppText>
      <View style={styles.sectionLine} />
    </View>
  );
}

/** The big door into the knowledge worlds (topics, level by level). */
function WorldsDoor() {
  const all = useWorldsConfig();
  const { data } = useWorldsState();
  const stars = data?.total_stars ?? 0;
  return (
    <Pressable
      onPress={() => router.push('/worlds')}
      style={({ pressed }) => [styles.door, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${t.worlds}. ${t.worldsBody}`}
    >
      <LinearGradient colors={['#2E8B57', '#1E6E8C', '#3B3FB6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      <Image source={WORLD_IMAGES.globe!} style={styles.doorArt} />
      <View style={styles.flex}>
        <AppText variant="title" color={colors.textOnBright}>
          {t.worlds}
        </AppText>
        <AppText variant="label" color={colors.textOnBright}>
          {t.worldsBody}
        </AppText>
        <View style={styles.doorChips}>
          <View style={styles.doorChip}>
            <AppText variant="caption" color={colors.text} style={styles.bold}>
              {fmt(p.worldsCount, { n: all.length })}
            </AppText>
          </View>
          {stars > 0 ? (
            <View style={styles.doorChip}>
              <AppText variant="caption" color={colors.text} style={styles.bold}>
                {fmt(p.starsCount, { n: stars })}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-back" size={28} color={colors.textOnBright} />
    </Pressable>
  );
}

/** The "play" tab: every way to play, all in one place. */
export default function PlayScreen() {
  const play = usePlaySession();
  const { data: daily } = useDailyStatus();
  const countdown = useCountdownToMidnight();
  const { data: blitz } = useBlitzInfo();
  const { data: survival } = useSurvivalInfo();
  const { data: tf } = useTfInfo();
  const { data: energy } = useEnergy();
  const showEnergy = useEnergySheet((s) => s.show);
  const dailyDone = daily?.state === 'done';
  const seen = useSettingsStore((s) => s.seenModes);
  const isNew = (m: string) => !seen.includes(m);
  const needTicket = (go: () => void) => () => {
    if (energy && !energy.unlimited && energy.tickets < 1) showEnergy();
    else go();
  };

  return (
    <Screen header={<TopBar />}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="title">{p.title}</AppText>
          <AppText color={colors.textMuted}>{p.subtitle}</AppText>
        </View>
        <Sloth head size={76} bob={false} />
      </View>

      <StickerButton label={`${t.quick} · ${t.quickBody}`} icon="flash" size="lg" tone="prize" fullWidth onPress={() => play('mix')} />

      <WorldsDoor />

      <SectionTitle>{p.together}</SectionTitle>
      <ModeTile
        wide
        index={0}
        title={t.family}
        body={t.familyBody}
        icon="family"
        art={<Icon name="family" size={70} />}
        colors={['#FF6FB5', '#B14CFF', '#6A3CFF']}
        chip={isNew('family') ? t.new : strings.teen.free}
        chipTone={isNew('family') ? 'gold' : 'green'}
        onPress={() => router.push('/family')}
      />
      <View style={styles.row}>
        <ModeTile
          index={1}
          title={t.random}
          body={t.randomBody}
          icon="dice"
          colors={['#3DDC84', '#119E8C']}
          chip={isNew('random') ? t.new : null}
          chipTone="gold"
          onPress={() => router.push({ pathname: '/match', params: { mode: 'random' } })}
        />
        <ModeTile
          index={2}
          title={t.friend}
          body={t.friendBody}
          icon="friends"
          colors={['#14A3B8', '#2F5FD0']}
          chip={strings.teen.free}
          chipTone="green"
          onPress={() => router.push('/match')}
        />
      </View>

      <SectionTitle>{p.solo}</SectionTitle>
      <View style={styles.row}>
        <ModeTile
          index={3}
          title={t.blitz}
          body={t.blitzBody}
          icon="timer"
          colors={['#FF8A3D', '#E8463A']}
          chip={blitz?.best ? fmt(t.blitzBest, { n: blitz.best }) : isNew('blitz') ? t.new : null}
          chipTone={blitz?.best ? 'dark' : 'gold'}
          onPress={needTicket(() => router.push('/blitz'))}
        />
        <ModeTile
          index={4}
          title={t.survival}
          body={t.survivalBody}
          icon="trophy"
          colors={['#8E5CFF', '#4B2BB5']}
          chip={survival?.week_best ? fmt(t.survivalWeek, { n: survival.week_best }) : isNew('survival') ? t.new : null}
          chipTone={survival?.week_best ? 'dark' : 'gold'}
          onPress={needTicket(() => router.push('/survival'))}
        />
      </View>
      <View style={styles.row}>
        <ModeTile
          index={5}
          title={t.tf}
          body={t.tfBody}
          icon="bolt"
          colors={['#14B8A6', '#0E7490']}
          chip={tf?.best ? fmt(t.blitzBest, { n: tf.best }) : isNew('tf') ? t.new : null}
          chipTone={tf?.best ? 'dark' : 'gold'}
          onPress={needTicket(() => router.push('/truefalse'))}
        />
        <ModeTile
          index={6}
          title={t.daily}
          body={dailyDone ? t.dailyDone : t.dailyBody}
          icon="daily"
          colors={['#3E8EF7', '#5C4CE0']}
          chip={dailyDone ? countdown : strings.teen.free}
          chipTone={dailyDone ? 'dark' : 'green'}
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
      </View>

      <EventCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  sectionLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,214,140,0.35)' },
  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    minHeight: 120,
  },
  doorArt: { width: 84, height: 84, borderRadius: 20 },
  doorChips: { flexDirection: 'row', gap: space.xs, marginTop: space.xs, flexWrap: 'wrap' },
  doorChip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(14,8,38,0.55)' },
  pressed: { transform: [{ scale: 0.98 }] },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});

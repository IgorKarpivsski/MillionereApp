import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Icon, Screen, Sheen, Sloth, StickerButton, useCountdownToMidnight } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useEnergySheet, usePlaySession } from '@/features/engage/EnergySheet';
import { useEnergy } from '@/features/engage/hooks';
import { BubbleColumns, useRewardBubbles } from '@/features/home/RewardBubbles';
import { ModeTile } from '@/features/home/ModeTile';
import { useLeague } from '@/features/league/api';
import { LeagueBadge } from '@/features/league/LeagueBadge';
import { useBlitzInfo } from '@/features/modes/api';
import { useMyState } from '@/features/profile/hooks';
import { useDailyStatus } from '@/features/quiz/hooks';
import { useUnreadTotal } from '@/features/social/hooks';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { fmt, strings } from '@/lib/i18n';

const t = strings.modes;

/** The sloth, centre stage, with every prize floating around him. */
function Hero() {
  const { data } = useMyState();
  const bubbles = useRewardBubbles();
  const play = usePlaySession();
  const name = data?.profile.username ?? '';
  // a different line each time the app opens
  const line = useMemo(() => t.slothHello[Math.floor(Math.random() * t.slothHello.length)]!, []);
  return (
    <BubbleColumns
      bubbles={bubbles}
      center={
        <View style={styles.heroCenter}>
          <Sloth size={148} say={name ? fmt(line, { name }) : t.slothHello[2]} />
          <StickerButton label={strings.home.playCta} icon="play" size="lg" tone="prize" fullWidth onPress={() => play('mix')} />
        </View>
      }
    />
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLine} />
      <AppText variant="heading">{children}</AppText>
      <View style={styles.sectionLine} />
    </View>
  );
}

function Modes() {
  const { data: daily } = useDailyStatus();
  const countdown = useCountdownToMidnight();
  const { data: blitz } = useBlitzInfo();
  const { data: energy } = useEnergy();
  const showEnergy = useEnergySheet((s) => s.show);
  const dailyDone = daily?.state === 'done';
  const needTicket = (go: () => void) => () => {
    if (energy && !energy.unlimited && energy.tickets < 1) showEnergy();
    else go();
  };
  return (
    <>
      <SectionTitle>{t.title}</SectionTitle>
      <ModeTile
        wide
        index={0}
        title={t.family}
        body={t.familyBody}
        icon="family"
        art={<Icon name="family" size={70} />}
        colors={['#FF6FB5', '#B14CFF', '#6A3CFF']}
        chip={t.new}
        chipTone="gold"
        onPress={() => router.push('/family')}
      />
      <View style={styles.row}>
        <ModeTile
          index={1}
          title={t.blitz}
          body={t.blitzBody}
          icon="timer"
          colors={['#FF8A3D', '#E8463A']}
          chip={blitz?.best ? fmt(t.blitzBest, { n: blitz.best }) : t.new}
          chipTone={blitz?.best ? 'dark' : 'gold'}
          onPress={needTicket(() => router.push('/blitz'))}
        />
        <ModeTile
          index={2}
          title={t.random}
          body={t.randomBody}
          icon="dice"
          colors={['#3DDC84', '#119E8C']}
          chip={t.new}
          chipTone="gold"
          onPress={() => router.push({ pathname: '/match', params: { mode: 'random' } })}
        />
      </View>
      <View style={styles.row}>
        <ModeTile
          index={3}
          title={t.daily}
          body={dailyDone ? t.dailyDone : t.dailyBody}
          icon="daily"
          colors={['#3E8EF7', '#5C4CE0']}
          chip={countdown}
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
        <ModeTile
          index={4}
          title={t.friend}
          body={t.friendBody}
          icon="friends"
          colors={['#14A3B8', '#2F5FD0']}
          onPress={() => router.push('/match')}
        />
      </View>
      <ModeTile
        wide
        index={5}
        title={t.worlds}
        body={t.worldsBody}
        art={<Image source={WORLD_IMAGES.globe!} style={styles.worldArt} />}
        colors={['#2E8B57', '#1E6E8C']}
        onPress={() => router.push('/(tabs)/play')}
      />
    </>
  );
}

function SmallEntry({
  label,
  art,
  colors: grad,
  badge,
  onPress,
}: {
  label: string;
  art: React.ReactNode;
  colors: [string, string];
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.small, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      {art}
      <AppText variant="label" style={styles.flex} numberOfLines={1}>
        {label}
      </AppText>
      {badge ? (
        <View style={styles.count}>
          <AppText variant="caption" style={styles.bold}>
            {String(badge)}
          </AppText>
        </View>
      ) : (
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      )}
    </Pressable>
  );
}

function Social() {
  const { data: league } = useLeague();
  const unread = useUnreadTotal();
  return (
    <View style={styles.row}>
      <SmallEntry
        label={league ? league.tier_name : t.league}
        art={league ? <LeagueBadge tier={league.tier} size={34} /> : <Icon name="podium" size={34} />}
        colors={['#2E2263', '#4B2A8A']}
        onPress={() => router.push('/(tabs)/leaderboard')}
      />
      <SmallEntry
        label={t.friends}
        art={<Icon name="chat" size={32} />}
        colors={['#14A3B8', '#2F5FD0']}
        badge={unread}
        onPress={() => router.push('/friends')}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { refetch, isRefetching } = useMyState();
  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Hero />
      <Modes />
      <Social />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCenter: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  sectionLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,214,140,0.35)' },
  row: { flexDirection: 'row', gap: space.md },
  worldArt: { width: 70, height: 70, borderRadius: 16 },
  small: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm + 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  pressed: { transform: [{ scale: 0.97 }] },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});

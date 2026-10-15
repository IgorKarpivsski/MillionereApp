import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Icon, Screen } from '@/design-system/components';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { QuickPlayCard, WorldsGrid } from '@/features/worlds/WorldCards';
import { strings } from '@/lib/i18n';

const t = strings.worlds;

export default function PlayScreen() {
  return (
    <Screen header={<TopBar />}>
      <View>
        <AppText variant="title">{t.title}</AppText>
        <AppText color={colors.textMuted}>{t.subtitle}</AppText>
      </View>
      <QuickPlayCard />
      <WorldsGrid />
      <View style={styles.row}>
        <Pressable
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
        >
          <LinearGradient colors={['#7FD1FF', '#5C7CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Icon name="daily" size={44} />
          <AppText variant="heading" color={colors.textOnBright} align="center">
            {strings.home.dailyTitle}
          </AppText>
        </Pressable>
        <Pressable onPress={() => router.push('/match')} accessibilityRole="button" style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
          <LinearGradient colors={['#FF8AD8', '#B14CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Icon name="friends" size={44} />
          <AppText variant="heading" color={colors.textOnBright} align="center">
            {strings.match.playCard}
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.97 }] },
  row: { flexDirection: 'row', gap: space.md },
  mini: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: palette.night950,
  },
});

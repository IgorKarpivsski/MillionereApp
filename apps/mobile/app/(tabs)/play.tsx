import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Screen, Sloth } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { WorldsGrid } from '@/features/worlds/WorldCards';
import { strings } from '@/lib/i18n';

const t = strings.worlds;

/** The "play" tab: every knowledge world, question topics level by level. */
export default function PlayScreen() {
  return (
    <Screen header={<TopBar />}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="title">{t.title}</AppText>
          <AppText color={colors.textMuted}>{t.subtitle}</AppText>
        </View>
        <Sloth head size={84} bob={false} />
      </View>
      <WorldsGrid />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});

import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Sloth, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { WorldsGrid } from '@/features/worlds/WorldCards';
import { strings } from '@/lib/i18n';

const t = strings.worlds;

/** Every knowledge world: question topics, level by level. Opened from the play tab. */
export default function WorldsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <Sloth head size={64} bob={false} />
        <View style={styles.flex}>
          <AppText variant="title">{t.title}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t.subtitle}
          </AppText>
        </View>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <WorldsGrid />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
});

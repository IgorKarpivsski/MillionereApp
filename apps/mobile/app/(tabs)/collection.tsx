import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, EmptyState, ProgressBar, RarityFrame, Screen } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';

const SLOTS = 9;

export default function CollectionScreen() {
  return (
    <Screen header={<TopBar />}>
      <AppText variant="title">{strings.collection.title}</AppText>
      <ProgressBar value={0} color={colors.gem} accessibilityLabel="השלמת האלבום: 0 אחוז" />
      <View style={styles.grid}>
        {Array.from({ length: SLOTS }, (_, i) => (
          <RarityFrame key={i} rarity="common" locked width={100}>
            <Ionicons name="help" size={32} color={colors.textMuted} />
          </RarityFrame>
        ))}
      </View>
      <EmptyState
        icon="albums-outline"
        title={strings.collection.empty}
        body={strings.home.albumEmpty}
        actionLabel={strings.home.playCta}
        onAction={() => router.push('/(tabs)/play')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
});

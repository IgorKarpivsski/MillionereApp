import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop, EmptyState, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';

/** A full screen whose data hasn't arrived: a spinner while loading, a retry and a way out on failure. */
export function LoadingOrError({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.center}>
        {error ? (
          <>
            <EmptyState
              icon="cloud-offline-outline"
              title={strings.errors.loadTitle}
              body={strings.errors.network}
              actionLabel={strings.common.retry}
              onAction={onRetry}
            />
            <StickerButton label={strings.common.back} tone="ghost" onPress={() => router.back()} />
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.led} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
});

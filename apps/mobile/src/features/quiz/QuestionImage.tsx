import type { QuestionImage as QImage } from '@fm/shared';
import * as WebBrowser from 'expo-web-browser';
import { memo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { QuestionMap } from './QuestionMap';

/** Wikimedia asks apps that load its files to identify themselves. */
const UA = 'HaAlufTrivia/1.0 (Android; https://github.com/IgorKarpivsski/MillionereApp)';

/** A Wikimedia Commons photo with its author/license credit underneath (required by the licenses). */
export const QuestionPhoto = memo(function QuestionPhoto({ image, height = 200 }: { image: Extract<QImage, { kind: 'photo' }>; height?: number }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const contain = image.fit === 'contain';
  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, { height }, contain && styles.contain]}>
        <Image
          source={{ uri: image.url, headers: { 'User-Agent': UA } }}
          style={StyleSheet.absoluteFill}
          resizeMode={contain ? 'contain' : 'cover'}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        {state === 'loading' ? <ActivityIndicator color={colors.cardMuted} /> : null}
        {state === 'error' ? (
          <AppText variant="caption" color={colors.cardMuted}>
            התמונה לא נטענה
          </AppText>
        ) : null}
      </View>
      <Pressable
        onPress={() => (image.page ? void WebBrowser.openBrowserAsync(image.page) : undefined)}
        disabled={!image.page}
        hitSlop={6}
        accessibilityRole="link"
        accessibilityLabel={`קרדיט לתמונה: ${image.credit}`}
      >
        <AppText variant="caption" color={colors.cardMuted} numberOfLines={1} style={styles.credit}>
          {`📷 ${image.credit}`}
        </AppText>
      </Pressable>
    </View>
  );
});

export function QuestionImageView({ image }: { image: QImage }) {
  return image.kind === 'map' ? <QuestionMap image={image} /> : <QuestionPhoto image={image} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  frame: {
    borderRadius: radius.board,
    overflow: 'hidden',
    backgroundColor: '#E9E5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contain: { backgroundColor: '#F1EEFA', padding: space.sm },
  credit: { fontSize: 11, lineHeight: 15 },
});

import type { QuestionImage as QImage } from '@fm/shared';
import * as WebBrowser from 'expo-web-browser';
import { memo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText } from '@/design-system/components';
import { colors, radius } from '@/design-system/tokens';
import { QuestionMap } from './QuestionMap';

/** Wikimedia asks apps that load its files to identify themselves. */
const UA = 'HaAlufTrivia/1.0 (Android; https://github.com/IgorKarpivsski/MillionereApp)';

/**
 * A Wikimedia Commons photo with its author/license credit underneath (required by the licenses).
 * The photo is always shown WHOLE: a soft, blurred copy fills the frame behind it, so a tall
 * portrait never loses its head to the frame's wide shape.
 */
export const QuestionPhoto = memo(function QuestionPhoto({ image, height: fixed }: { image: Extract<QImage, { kind: 'photo' }>; height?: number }) {
  // big enough to recognise a face; on small phones the photo gives way first to keep the answers on screen
  const { height: screenH } = useWindowDimensions();
  const height = fixed ?? (screenH < 700 ? 150 : screenH < 800 ? 200 : 250);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const source = { uri: image.url, headers: { 'User-Agent': UA } };
  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, { height }]}>
        {state === 'ok' ? (
          <>
            <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} accessible={false} />
            <View style={styles.dim} />
          </>
        ) : null}
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
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
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,50,0.25)' },
  credit: { fontSize: 11, lineHeight: 15 },
});

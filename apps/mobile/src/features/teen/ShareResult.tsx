import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AppText, BottomSheet, Led, Sloth, StickerButton, TrophyLogo, useToast } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { strings, fmt } from '@/lib/i18n';
import { useMyState } from '@/features/profile/hooks';

const t = strings.teen;

/** The picture that gets shared: big result, the sloth, the app's name. */
function ShareCard({ big, line }: { big: string; line: string }) {
  const { data } = useMyState();
  return (
    <View style={styles.card} collapsable={false}>
      <LinearGradient colors={['#FF8A3D', '#B14CFF', '#2A1A6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <AppText variant="label" color={colors.text} align="center" style={styles.brand}>
        {t.shareBrand}
      </AppText>
      <View style={styles.row}>
        <Sloth size={110} bob={false} />
        <View style={styles.flex}>
          <TrophyLogo size={46} color={colors.led} />
          <Led size="ledXL">{big}</Led>
        </View>
      </View>
      <AppText variant="heading" align="center">
        {line}
      </AppText>
      {data ? (
        <AppText variant="caption" align="center" color={colors.text}>
          {data.profile.username}
        </AppText>
      ) : null}
      <View style={styles.cta}>
        <AppText variant="caption" color={colors.textOnBright} align="center" style={styles.bold}>
          {t.shareCardCta}
        </AppText>
      </View>
    </View>
  );
}

/** "Share result": previews a picture card and sends it to WhatsApp / TikTok / anywhere. */
export function ShareResultButton({ big, line }: { big: string; line: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = useRef<View>(null);
  const toast = useToast();
  const message = fmt(t.shareMsg, { line });
  const share = async () => {
    setBusy(true);
    try {
      if (card.current && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t.share });
      } else {
        await Share.share({ message });
      }
      setOpen(false);
    } catch {
      try {
        await Share.share({ message });
      } catch {
        toast(t.shareFailed, 'error');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <StickerButton label={t.share} icon="share-social" tone="outline" fullWidth onPress={() => setOpen(true)} />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t.share}>
        <View ref={card} collapsable={false} style={styles.capture}>
          <ShareCard big={big} line={line} />
        </View>
        <StickerButton label={t.share} icon="logo-whatsapp" tone="prize" fullWidth loading={busy} onPress={() => void share()} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  capture: { alignSelf: 'center', borderRadius: 24, overflow: 'hidden' },
  card: { width: 300, padding: space.lg, gap: space.sm, alignItems: 'center', overflow: 'hidden', borderRadius: 24 },
  brand: { letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { alignItems: 'center' },
  cta: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.led, marginTop: space.xs },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});

import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AppText, AvatarBadge, BottomSheet, Led, Sloth, StickerButton, TrophyLogo, useToast } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';
import { inviteLink, useReferral } from '@/features/referral/api';
import { fmt, strings } from '@/lib/i18n';
import { showName } from '@/lib/names';

const t = strings.teen;

/**
 * What the card brags about. A weak score ("3/10") is never put on show: then the card
 * challenges friends instead, so kids are happy to send it.
 */
function brag(big: string, line: string): { big: string; line: string } {
  const m = /^(\d+)\/(\d+)$/.exec(big);
  if (m && Number(m[1]) < Math.ceil(Number(m[2]) * 0.6)) return { big: '🏆', line: t.shareChallenge };
  return { big, line };
}

/** The picture that gets shared: the result, the player, the sloth, and a code that brings friends in. */
function ShareCard({ big, line, story }: { big: string; line: string; story: boolean }) {
  const { data } = useMyState();
  const { data: ref } = useReferral();
  return (
    <View style={[styles.card, story && styles.story]} collapsable={false}>
      <LinearGradient colors={['#FF8A3D', '#B14CFF', '#2A1A6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <AppText variant="label" color={colors.text} align="center" style={styles.brand}>
        {t.shareBrand}
      </AppText>
      {data ? (
        <View style={styles.me}>
          {/* never the real photo on a picture that leaves the app */}
          <AvatarBadge avatarId={data.profile.avatar_id} frame={data.profile.frame} size={story ? 72 : 52} />
          <AppText variant="bodyStrong" color={colors.text}>
            {showName(data.profile.username)}
          </AppText>
        </View>
      ) : null}
      <View style={styles.row}>
        <Sloth size={story ? 130 : 100} bob={false} />
        <View style={styles.center}>
          <TrophyLogo size={story ? 60 : 44} color={colors.led} />
          <Led size="ledXL">{big}</Led>
        </View>
      </View>
      <AppText variant="heading" align="center">
        {line}
      </AppText>
      {ref?.code ? (
        <View style={styles.code}>
          <AppText variant="caption" color={colors.text} align="center">
            {t.shareCodeLabel}
          </AppText>
          <Led size="ledM" color={colors.led}>
            {ref.code}
          </Led>
        </View>
      ) : null}
      <View style={styles.cta}>
        <AppText variant="caption" color={colors.textOnBright} align="center" style={styles.bold}>
          {t.shareCardCta}
        </AppText>
      </View>
    </View>
  );
}

/** "Share result": previews a picture card (square or story size) and sends it anywhere. */
export function ShareResultButton({ big: rawBig, line: rawLine }: { big: string; line: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [story, setStory] = useState(false);
  const card = useRef<View>(null);
  const toast = useToast();
  const { data: ref } = useReferral();
  const { big, line } = brag(rawBig, rawLine);
  const message = ref?.code
    ? fmt(t.shareMsgCode, { line, code: ref.code, link: inviteLink(ref.code) })
    : fmt(t.shareMsg, { line });
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
        <View style={styles.formats} accessibilityRole="tablist">
          {([false, true] as const).map((s) => (
            <Pressable
              key={String(s)}
              onPress={() => setStory(s)}
              accessibilityRole="tab"
              accessibilityState={{ selected: story === s }}
              style={[styles.format, story === s && styles.formatOn]}
            >
              <AppText variant="label" color={story === s ? colors.textOnBright : colors.textMuted}>
                {s ? t.shareStory : t.sharePost}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View ref={card} collapsable={false} style={styles.capture}>
          <ShareCard big={big} line={line} story={story} />
        </View>
        <StickerButton label={t.share} icon="share-social" tone="prize" fullWidth loading={busy} onPress={() => void share()} />
        <AppText variant="caption" color={colors.textMuted} align="center">
          {t.shareWhere}
        </AppText>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  capture: { alignSelf: 'center', borderRadius: 24, overflow: 'hidden' },
  card: { width: 300, padding: space.lg, gap: space.sm, alignItems: 'center', overflow: 'hidden', borderRadius: 24 },
  story: { width: 270, height: 480, justifyContent: 'space-between' },
  brand: { letterSpacing: 1 },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  center: { alignItems: 'center' },
  code: { alignItems: 'center', paddingHorizontal: space.md, paddingVertical: 4, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)' },
  cta: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.led, marginTop: space.xs },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  formats: { flexDirection: 'row', alignSelf: 'center', gap: space.xs, padding: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)' },
  format: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999 },
  formatOn: { backgroundColor: colors.led },
});

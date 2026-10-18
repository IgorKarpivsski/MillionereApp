import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, AvatarBadge, Backdrop, Sloth, StickerButton, useToast } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { StatsSection } from '@/features/profile/Stats';
import { teenApi, useFriendProfile } from '@/features/teen/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.teen;

/** A friend's card: avatar, frame, title and their statistics. */
export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useFriendProfile(id ?? '');
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const challenge = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const r = await teenApi.challenge(id);
      toast(fmt(t.revengeSent, { name: data?.profile.username ?? '' }), 'success');
      router.push({ pathname: '/match', params: { room: r.room_id } });
    } catch {
      toast(strings.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.flex} numberOfLines={1}>
          {data ? fmt(t.friendProfile, { name: data.profile.username }) : ''}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {isLoading ? <ActivityIndicator color={colors.led} /> : null}
        {isError ? <Sloth size={120} say={t.friendHidden} /> : null}
        {data ? (
          <>
            <View style={styles.header}>
              <AvatarBadge avatarId={data.profile.avatar_id} photo={data.profile.photo} level={data.profile.level} frame={data.profile.frame} size={110} ring={colors.led} />
              <AppText variant="title">{data.profile.username}</AppText>
              {data.profile.title ? (
                <AppText variant="label" color={colors.led}>
                  {`★ ${data.profile.title} ★`}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <StickerButton label={t.friendChallenge} icon="flash" tone="prize" loading={busy} onPress={() => void challenge()} />
                <StickerButton
                  label={t.friendChat}
                  icon="chatbubble-ellipses"
                  tone="ghost"
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: data.id, name: data.profile.username } })}
                />
              </View>
            </View>
            <StatsSection
              gender={data.profile.gender}
              stats={{ ...data.stats, xp: 0 }}
              title={fmt(t.friendProfile, { name: data.profile.username })}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  header: { alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
});

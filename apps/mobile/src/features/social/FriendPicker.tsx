import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, AvatarBadge, BottomSheet, StickerButton } from '@/design-system/components';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';
import { useFriends } from './hooks';

const t = strings.social;

/** Pick a friend to trade duplicates with (online friends first). */
export function TradeFriendSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data } = useFriends();
  const friends = (data?.friends ?? []).filter((f) => f.status === 'accepted');
  const go = (id: string, name: string, mode?: 'gift') => {
    onClose();
    router.push({ pathname: '/trade/[id]', params: mode ? { id, name, mode } : { id, name } });
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.pickFriend}>
      {friends.length === 0 ? (
        <>
          <AppText color={colors.textMuted} align="center">
            {t.noFriendsYet}
          </AppText>
          <StickerButton
            label={strings.teen.friendsAdd}
            icon="person-add"
            fullWidth
            onPress={() => {
              onClose();
              router.push('/friends');
            }}
          />
        </>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.body}>
          {friends.map((f) => (
            <View key={f.id} style={styles.row}>
              <View>
                <AvatarBadge avatarId={f.avatar_id} photo={f.photo} size={40} />
                <View style={[styles.dot, { backgroundColor: f.online ? colors.correct : palette.night600 }]} />
              </View>
              <AppText variant="label" style={styles.flex} numberOfLines={1}>
                {f.username}
              </AppText>
              <Pressable onPress={() => go(f.id, f.username, 'gift')} style={styles.btn} accessibilityRole="button" accessibilityLabel={`${t.giftBtn} ${f.username}`}>
                <Ionicons name="gift" size={20} color={colors.prize} />
              </Pressable>
              <Pressable onPress={() => go(f.id, f.username)} style={styles.btn} accessibilityRole="button" accessibilityLabel={`${t.trade} ${f.username}`}>
                <Ionicons name="swap-horizontal" size={20} color={colors.led} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 380 },
  body: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.board, backgroundColor: colors.board },
  dot: { position: 'absolute', top: 0, start: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: palette.night950 },
  flex: { flex: 1 },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

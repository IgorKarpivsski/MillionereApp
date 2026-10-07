import { levelFromXp } from '@fm/economy-config';
import { USERNAME_REGEX } from '@fm/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  AppText,
  AvatarBadge,
  BottomSheet,
  Card,
  ProgressBar,
  Screen,
  Skeleton,
  StickerButton,
  useToast,
} from '@/design-system/components';
import { colors, fontFamily, palette, radius, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Provider } from '@/features/auth/oauth';
import { RpcError } from '@/features/profile/api';
import { useMyState, useUpdateProfile } from '@/features/profile/hooks';
import { formatNumber, ltr } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { useIsOnline } from '@/lib/network';

const t = strings.profile;

function EditNameSheet({ visible, onClose, current }: { visible: boolean; onClose: () => void; current: string }) {
  const [name, setName] = useState(current);
  const update = useUpdateProfile();
  const toast = useToast();
  const valid = USERNAME_REGEX.test(name.trim());

  const save = () =>
    update.mutate(
      { username: name.trim() },
      {
        onSuccess: () => {
          toast(t.nameSaved, 'success');
          onClose();
        },
        onError: (e) => {
          const code = e instanceof RpcError ? e.code : 'unknown';
          toast(
            code === 'username_taken'
              ? strings.errors.usernameTaken
              : code === 'invalid_input'
                ? strings.errors.usernameInvalid
                : code === 'rate_limited'
                  ? strings.errors.rateLimited
                  : strings.errors.generic,
            'error',
          );
        },
      },
    );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.editName}>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={20}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={t.editName}
        accessibilityHint={t.nameHint}
        style={[styles.input, !valid && name.length > 0 && styles.inputError]}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => valid && save()}
      />
      <AppText variant="caption" color={valid || !name ? colors.textMuted : colors.danger}>
        {valid || !name ? t.nameHint : strings.errors.usernameInvalid}
      </AppText>
      <StickerButton label={strings.common.save} fullWidth disabled={!valid} loading={update.isPending} onPress={save} />
    </BottomSheet>
  );
}

function LinkAccountCard() {
  const { link } = useAuth();
  const toast = useToast();
  const online = useIsOnline();
  const [busy, setBusy] = useState<Provider | null>(null);

  const go = async (p: Provider) => {
    setBusy(p);
    const res = await link(p);
    setBusy(null);
    if (res.ok) toast(t.linked, 'success');
    else if (res.reason === 'identity_taken') toast(strings.errors.identityTaken, 'error');
    else if (res.reason !== 'cancelled') toast(strings.errors.generic, 'error');
  };

  return (
    <Card kind="sticker" tint={palette.night700}>
      <View style={styles.row}>
        <Ionicons name="shield-checkmark" size={30} color={colors.prize} />
        <View style={styles.flex}>
          <AppText variant="heading">{t.guestTitle}</AppText>
          <AppText color={colors.textMuted}>{t.guestBody}</AppText>
        </View>
      </View>
      <View style={styles.linkButtons}>
        <StickerButton
          label={t.linkApple}
          icon="logo-apple"
          tone="ghost"
          fullWidth
          disabled={!online || busy !== null}
          loading={busy === 'apple'}
          onPress={() => void go('apple')}
        />
        <StickerButton
          label={t.linkGoogle}
          icon="logo-google"
          tone="ghost"
          fullWidth
          disabled={!online || busy !== null}
          loading={busy === 'google'}
          onPress={() => void go('google')}
        />
      </View>
    </Card>
  );
}

export default function ProfileScreen() {
  const { data } = useMyState();
  const { isGuest, signOut } = useAuth();
  const [editing, setEditing] = useState(false);

  if (!data) {
    return (
      <Screen>
        <Skeleton height={160} rounded={radius.card} />
      </Screen>
    );
  }

  const lvl = levelFromXp(data.profile.xp);

  const confirmSignOut = () => {
    if (!isGuest) return void signOut();
    Alert.alert(t.signOut, t.signOutGuestWarning, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.signOut, style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/avatar')}
          accessibilityRole="button"
          accessibilityLabel={t.editAvatar}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : null)}
        >
          <AvatarBadge avatarId={data.profile.avatar_id} level={data.profile.level} size={120} ring={colors.led} />
          <View style={styles.editDot}>
            <Ionicons name="brush" size={16} color={colors.textOnBright} />
          </View>
        </Pressable>
        <StickerButton label={t.editAvatar} size="sm" tone="outline" icon="color-palette" onPress={() => router.push('/avatar')} />
        <View style={styles.nameRow}>
          <AppText variant="title" numberOfLines={1}>
            {data.profile.username}
          </AppText>
          <StickerButton label={t.editName} size="sm" tone="ghost" icon="pencil" onPress={() => setEditing(true)} />
        </View>
      </View>

      <Card>
        <View style={styles.levelRow}>
          <AppText variant="heading">{`${strings.common.level} ${lvl.level}`}</AppText>
          <AppText variant="number" color={colors.textMuted}>
            {ltr(`${formatNumber(lvl.intoLevel)} / ${formatNumber(lvl.needed)} XP`)}
          </AppText>
        </View>
        <ProgressBar
          value={lvl.intoLevel / lvl.needed}
          color={colors.prize}
          accessibilityLabel={`התקדמות לשלב ${lvl.level + 1}`}
        />
      </Card>

      {isGuest ? <LinkAccountCard /> : (
        <Card>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={26} color={colors.success} />
            <AppText variant="bodyStrong">{t.linked}</AppText>
          </View>
        </Card>
      )}

      <StickerButton label={t.settings} icon="settings" tone="ghost" fullWidth onPress={() => router.push('/settings')} />
      <StickerButton label={t.signOut} icon="log-out" tone="ghost" fullWidth onPress={confirmSignOut} />
      {__DEV__ ? (
        <StickerButton label="Design system" tone="ghost" size="sm" onPress={() => router.push('/design-system')} />
      ) : null}

      <EditNameSheet visible={editing} onClose={() => setEditing(false)} current={data.profile.username} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  editDot: {
    position: 'absolute',
    top: 0,
    start: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.led,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: space.xxs },
  header: { alignItems: 'center', gap: space.md, paddingTop: space.md },
  nameRow: { alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  linkButtons: { gap: space.sm, marginTop: space.lg },
  input: {
    height: 56,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: palette.night950,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fontFamily.uiMedium,
    fontSize: 18,
    textAlign: 'right',
  },
  inputError: { borderColor: colors.danger },
});

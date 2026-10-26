import { levelFromXp } from '@fm/economy-config';
import { USERNAME_REGEX } from '@fm/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { appAlert, AppText,
  AvatarBadge,
  BottomSheet,
  Card,
  Glow,
  ProgressBar,
  Screen,
  Skeleton,
  StickerButton,
  TitleTag,
  useToast, } from '@/design-system/components';
import { colors, fontFamily, palette, radius, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Provider } from '@/features/auth/oauth';
import { RpcError } from '@/features/profile/api';
import { useMyState, useUpdateProfile } from '@/features/profile/hooks';
import { googlePhotoUrl, pickAndUploadPhoto, useSetPhoto } from '@/features/profile/photo';
import { StatsSection } from '@/features/profile/Stats';
import { useSettingsStore } from '@/features/settings/store';
import { FlairSheet } from '@/features/teen/Flair';
import { StreakFreezeCard } from '@/features/teen/StreakFreeze';
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

function PhotoSheet({ visible, onClose, hasPhoto }: { visible: boolean; onClose: () => void; hasPhoto: boolean }) {
  const { session } = useAuth();
  const setPhoto = useSetPhoto();
  const toast = useToast();
  const [busy, setBusy] = useState<'device' | 'google' | 'remove' | null>(null);
  const google = googlePhotoUrl(session);
  const save = async (kind: 'device' | 'google' | 'remove') => {
    setBusy(kind);
    try {
      const url = kind === 'device' ? await pickAndUploadPhoto(session!.user.id) : kind === 'google' ? google : null;
      if (kind === 'device' && !url) return;
      await setPhoto.mutateAsync(url);
      toast(kind === 'remove' ? t.photoRemoved : t.photoSaved, 'success');
      onClose();
    } catch {
      toast(strings.errors.generic, 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.photoTitle}>
      <StickerButton label={t.photoDevice} icon="images" fullWidth loading={busy === 'device'} disabled={busy !== null || !session} onPress={() => void save('device')} />
      {google ? (
        <StickerButton label={t.photoGoogle} icon="logo-google" tone="outline" fullWidth loading={busy === 'google'} disabled={busy !== null} onPress={() => void save('google')} />
      ) : (
        <AppText variant="caption" color={colors.textMuted} align="center">
          {t.photoGoogleHint}
        </AppText>
      )}
      <StickerButton
        label={t.editAvatar}
        icon="color-palette"
        tone="ghost"
        fullWidth
        disabled={busy !== null}
        onPress={() => {
          onClose();
          router.push('/avatar');
        }}
      />
      {hasPhoto ? (
        <StickerButton label={t.photoRemove} icon="trash" tone="ghost" fullWidth loading={busy === 'remove'} disabled={busy !== null} onPress={() => void save('remove')} />
      ) : null}
      <AppText variant="caption" color={colors.textDim} align="center">
        {t.photoPrivate}
      </AppText>
    </BottomSheet>
  );
}

function LinkAccountCard() {
  const { link, signIn } = useAuth();
  const toast = useToast();
  const online = useIsOnline();
  const [busy, setBusy] = useState<Provider | null>(null);

  const go = async (p: Provider) => {
    setBusy(p);
    const res = await link(p);
    setBusy(null);
    if (res.ok) toast(t.linked, 'success');
    else if (res.reason === 'identity_taken') askSwitch(p);
    else if (res.reason !== 'cancelled') toast(strings.errors.generic, 'error');
  };

  // This Google account already belongs to a saved player (e.g. from another phone): switch to it.
  const switchTo = async (p: Provider) => {
    setBusy(p);
    const res = await signIn(p);
    setBusy(null);
    if (res.ok) toast(t.welcomeBack, 'success');
    else if (res.reason !== 'cancelled') toast(strings.errors.generic, 'error');
  };
  const askSwitch = (p: Provider) =>
    appAlert(t.switchTitle, t.switchBody, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.switchConfirm, onPress: () => void switchTo(p) },
    ]);

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
        {/* Sign in with Apple is offered on iPhone only. */}
        {Platform.OS === 'ios' ? (
          <StickerButton
            label={t.linkApple}
            icon="logo-apple"
            tone="ghost"
            fullWidth
            disabled={!online || busy !== null}
            loading={busy === 'apple'}
            onPress={() => void go('apple')}
          />
        ) : null}
        <StickerButton
          label={t.linkGoogle}
          icon="logo-google"
          tone="ghost"
          fullWidth
          disabled={!online || busy !== null}
          loading={busy === 'google'}
          onPress={() => void go('google')}
        />
        <Pressable onPress={() => askSwitch('google')} disabled={!online || busy !== null} accessibilityRole="button" hitSlop={8}>
          <AppText variant="label" color={colors.led} align="center" style={styles.haveAccount}>
            {t.haveAccount}
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

export default function ProfileScreen() {
  const { data } = useMyState();
  const { isGuest, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [flairOpen, setFlairOpen] = useState(false);

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
    appAlert(t.signOut, t.signOutGuestWarning, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.signOut, style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.glowSpot}>
          <Glow size={300} strength={0.5} />
        </View>
        <Pressable
          onPress={() => setPhotoOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t.photoTitle}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : null)}
        >
          <AvatarBadge avatarId={data.profile.avatar_id} photo={data.profile.photo_url} frame={data.profile.frame} level={data.profile.level} size={120} ring={colors.led} />
          <View style={styles.editDot}>
            <Ionicons name="camera" size={16} color={colors.textOnBright} />
          </View>
        </Pressable>
        <StickerButton label={t.photoTitle} size="sm" tone="outline" icon="camera" onPress={() => setPhotoOpen(true)} />
        <View style={styles.nameRow}>
          <AppText variant="title" numberOfLines={1}>
            {data.profile.username}
          </AppText>
          {data.profile.title ? (
            <TitleTag title={data.profile.title} size="lg" center />
          ) : null}
          <View style={styles.headerBtns}>
            <StickerButton label={t.editName} size="sm" tone="ghost" icon="pencil" onPress={() => setEditing(true)} />
            <StickerButton label={strings.teen.flairEdit} size="sm" tone="ghost" icon="ribbon" onPress={() => setFlairOpen(true)} />
          </View>
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

      <StatsSection gender={data.profile.gender} />

      <StreakFreezeCard />
      <View style={styles.entries}>
        <StickerButton label={strings.teen.mistakesEntry} icon="refresh" tone="outline" fullWidth onPress={() => router.push('/mistakes')} />
        <StickerButton label={strings.teen.submitEntry} icon="create" tone="outline" fullWidth onPress={() => router.push('/submit-question')} />
      </View>

      <StickerButton
        label={strings.tour.replay}
        icon="school"
        tone="ghost"
        fullWidth
        onPress={() => {
          useSettingsStore.getState().set({ tourDone: false });
          router.navigate('/(tabs)');
        }}
      />
      <StickerButton label={t.settings} icon="settings" tone="ghost" fullWidth onPress={() => router.push('/settings')} />
      <StickerButton label={t.signOut} icon="log-out" tone="ghost" fullWidth onPress={confirmSignOut} />
      {__DEV__ ? (
        <StickerButton label="Design system" tone="ghost" size="sm" onPress={() => router.push('/design-system')} />
      ) : null}

      <EditNameSheet visible={editing} onClose={() => setEditing(false)} current={data.profile.username} />
      <FlairSheet visible={flairOpen} onClose={() => setFlairOpen(false)} />
      <PhotoSheet visible={photoOpen} onClose={() => setPhotoOpen(false)} hasPhoto={!!data.profile.photo_url} />
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
    borderColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: space.xxs },
  header: { alignItems: 'center', gap: space.md, paddingTop: space.md },
  glowSpot: { position: 'absolute', top: -70, alignItems: 'center', justifyContent: 'center', width: 300, height: 300 },
  nameRow: { alignItems: 'center', gap: space.sm },
  headerBtns: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  entries: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  linkButtons: { gap: space.sm, marginTop: space.lg },
  haveAccount: { paddingVertical: space.xs },
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

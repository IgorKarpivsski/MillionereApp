import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { router } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { appAlert, AppText, Card, Screen, StickerButton, useToast } from '@/design-system/components';
import { colors, palette, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToggleSetting } from '@/features/settings/hooks';
import { useSettingsStore } from '@/features/settings/store';
import { askForRemindersOnce } from '@/features/reminders/useReminders';
import { useAdminStatus } from '@/features/admin/api';
import { AdminUnlockSheet, RedeemSheet } from '@/features/admin/CodeSheets';
import { brand } from '@/lib/brand';
import { fmt, strings } from '@/lib/i18n';
import { useIsOnline } from '@/lib/network';
import { GenderChoice, useSaveGender } from '@/features/profile/gender';
import { useMyState } from '@/features/profile/hooks';

const t = strings.settings;
type ToggleKey = 'sound' | 'music' | 'haptics' | 'reducedMotion' | 'extendedTime';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ROW_ICONS: Record<string, IconName> = {
  sound: 'volume-high',
  music: 'musical-notes',
  haptics: 'phone-portrait',
  reducedMotion: 'pause-circle',
  extendedTime: 'time',
  largeText: 'text',
  reminders: 'notifications',
};

/** Small lit icon chip at the start of each settings row. */
function RowIcon({ name }: { name: IconName }) {
  return (
    <View style={styles.icon}>
      <Ionicons name={name} size={18} color={colors.led} />
    </View>
  );
}

/** "פועל" / "כבוי" next to every switch, so its state never depends on the colour alone. */
function OnOff({ on }: { on: boolean }) {
  return (
    <AppText variant="caption" color={on ? colors.correct : colors.textDim} style={styles.onOff}>
      {on ? strings.settings.on : strings.settings.off}
    </AppText>
  );
}

function ToggleRow({ k, label, hint }: { k: ToggleKey; label: string; hint?: string }) {
  const value = useSettingsStore((s) => s[k]);
  const toggle = useToggleSetting();
  return (
    <View style={styles.row}>
      {ROW_ICONS[k] ? <RowIcon name={ROW_ICONS[k]} /> : null}
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color={colors.textMuted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <OnOff on={value} />
      <Switch
        value={value}
        onValueChange={(v) => toggle.mutate({ key: k, value: v })}
        accessibilityLabel={label}
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: colors.correct }}
        thumbColor={value ? palette.white : '#9A93B8'}
        ios_backgroundColor={palette.night950}
      />
    </View>
  );
}

/** Device-only switches (not synced to the server). */
function LocalToggleRow({ k, label, hint }: { k: 'largeText' | 'reminders'; label: string; hint: string }) {
  const value = useSettingsStore((s) => s[k]);
  const set = useSettingsStore((s) => s.set);
  return (
    <View style={styles.row}>
      {ROW_ICONS[k] ? <RowIcon name={ROW_ICONS[k]} /> : null}
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {hint}
        </AppText>
      </View>
      <OnOff on={value} />
      <Switch
        value={value}
        onValueChange={(v) => {
          set({ [k]: v });
          if (k === 'reminders' && v) {
            set({ remindersAsked: false });
            void askForRemindersOnce();
          }
        }}
        accessibilityLabel={label}
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: colors.correct }}
        thumbColor={value ? palette.white : '#9A93B8'}
        ios_backgroundColor={palette.night950}
      />
    </View>
  );
}

function LinkRow({ label, onPress, icon = 'document-text' }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <RowIcon name={icon} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { deleteAccount } = useAuth();
  const toast = useToast();
  const online = useIsOnline();
  const [deleting, setDeleting] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const admin = useAdminStatus();

  const confirmDelete = () =>
    appAlert(t.deleteTitle, t.deleteBody, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.deleteConfirm,
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteAccount();
            toast(t.deleted, 'success');
            router.dismissAll();
          } catch {
            toast(strings.errors.generic, 'error');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  return (
    <Screen
      header={
        <View style={styles.header}>
          <AppText variant="title">{t.title}</AppText>
          <StickerButton label={strings.common.close} size="sm" tone="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      <GenderCard />

      <Card>
        <ToggleRow k="sound" label={t.sound} />
        <ToggleRow k="music" label={t.music} />
        <ToggleRow k="haptics" label={t.haptics} />
        <LocalToggleRow k="reminders" label={t.reminders} hint={t.remindersHint} />
      </Card>

      <Card>
        <AppText variant="label" color={colors.textMuted} accessibilityRole="header">
          {t.accessibility}
        </AppText>
        <ToggleRow k="reducedMotion" label={t.reducedMotion} hint={t.reducedMotionHint} />
        <LocalToggleRow k="largeText" label={t.largeText} hint={t.largeTextHint} />
        <ToggleRow k="extendedTime" label={t.extendedTime} hint={t.extendedTimeHint} />
        <LinkRow icon="accessibility" label={t.a11yStatement} onPress={() => router.push('/legal/accessibility')} />
      </Card>

      <Card>
        <LinkRow icon="gift" label={strings.redeem.entry} onPress={() => setRedeemOpen(true)} />
        {admin.data?.admin ? <LinkRow icon="shield-checkmark" label={strings.admin.entry} onPress={() => router.push('/admin')} /> : null}
      </Card>

      <Card>
        <AppText variant="label" color={colors.textMuted} accessibilityRole="header">
          {t.legal}
        </AppText>
        <LinkRow label={t.terms} onPress={() => router.push('/legal/terms')} />
        <LinkRow icon="lock-closed" label={t.privacy} onPress={() => router.push('/legal/privacy')} />
        <LinkRow icon="mail" label={t.support} onPress={() => void Linking.openURL(`mailto:${brand.supportEmail}`)} />
      </Card>

      <StickerButton
        label={t.deleteAccount}
        tone="danger"
        icon="trash"
        fullWidth
        disabled={!online}
        loading={deleting}
        onPress={confirmDelete}
      />
      {/* Long-press the version for the owner's admin unlock (the server still checks the secret code). */}
      <Pressable onLongPress={() => setUnlockOpen(true)} delayLongPress={2500} accessible={false}>
        <AppText variant="caption" color={colors.textMuted} align="center">
          {fmt(t.version, { v: Application.nativeApplicationVersion ?? '0.1.0' })}
        </AppText>
      </Pressable>
      <RedeemSheet visible={redeemOpen} onClose={() => setRedeemOpen(false)} />
      <AdminUnlockSheet visible={unlockOpen} onClose={() => setUnlockOpen(false)} />
    </Screen>
  );
}

/** Boy / girl / other, so Hebrew texts address the player correctly. */
function GenderCard() {
  const { data } = useMyState();
  const save = useSaveGender();
  const toast = useToast();
  const online = useIsOnline();
  const current = save.isPending ? save.variables : data?.profile.gender;
  return (
    <Card>
      <AppText variant="label" color={colors.textMuted} accessibilityRole="header">
        {t.aboutMe}
      </AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {t.aboutMeHint}
      </AppText>
      <GenderChoice
        value={current}
        disabled={!online || save.isPending || !data}
        onPick={(g) => {
          if (g === data?.profile.gender) return;
          save.mutate(g, {
            onSuccess: () => toast(t.genderSaved, 'success'),
            onError: () => toast(t.genderError, 'error'),
          });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  onOff: { minWidth: 36, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  pressed: { opacity: 0.7 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,176,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,0,0.3)',
  },
  flex: { flex: 1 },
});

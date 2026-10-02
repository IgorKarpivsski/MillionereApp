import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { AppText, Card, Screen, StickerButton, useToast } from '@/design-system/components';
import { colors, palette, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToggleSetting } from '@/features/settings/hooks';
import { useSettingsStore } from '@/features/settings/store';
import { brand } from '@/lib/brand';
import { fmt, strings } from '@/lib/i18n';
import { useIsOnline } from '@/lib/network';

const t = strings.settings;
type ToggleKey = 'sound' | 'music' | 'haptics' | 'reducedMotion';

function ToggleRow({ k, label, hint }: { k: ToggleKey; label: string; hint?: string }) {
  const value = useSettingsStore((s) => s[k]);
  const toggle = useToggleSetting();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color={colors.textMuted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => toggle.mutate({ key: k, value: v })}
        accessibilityLabel={label}
        trackColor={{ false: palette.night950, true: colors.primary }}
        thumbColor={colors.sticker}
        ios_backgroundColor={palette.night950}
      />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={styles.row}>
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

  const confirmDelete = () =>
    Alert.alert(t.deleteTitle, t.deleteBody, [
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
      <Card>
        <ToggleRow k="sound" label={t.sound} />
        <ToggleRow k="music" label={t.music} />
        <ToggleRow k="haptics" label={t.haptics} />
        <ToggleRow k="reducedMotion" label={t.reducedMotion} hint={t.reducedMotionHint} />
      </Card>

      <Card>
        <AppText variant="label" color={colors.textMuted}>
          {t.legal}
        </AppText>
        <LinkRow label={t.terms} onPress={() => router.push('/legal/terms')} />
        <LinkRow label={t.privacy} onPress={() => router.push('/legal/privacy')} />
        <LinkRow label={t.support} onPress={() => void Linking.openURL(`mailto:${brand.supportEmail}`)} />
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
      <AppText variant="caption" color={colors.textMuted} align="center">
        {fmt(t.version, { v: Application.nativeApplicationVersion ?? '0.1.0' })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  flex: { flex: 1 },
});

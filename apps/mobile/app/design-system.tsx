import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  AvatarBadge,
  Card,
  CurrencyPill,
  EmptyState,
  ProgressBar,
  RarityFrame,
  Screen,
  Skeleton,
  StickerButton,
  StreakFlame,
  useToast,
} from '@/design-system/components';
import { colors, palette, rarityColors, space, textStyles, type RarityKey } from '@/design-system/tokens';

/** Dev-only catalogue of every design-system component (the "internal Storybook"). */
export default function DesignSystemScreen() {
  const toast = useToast();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen
      header={
        <View style={styles.header}>
          <AppText variant="title">Design system</AppText>
          <StickerButton label="סגור" size="sm" tone="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      <AppText variant="heading">טיפוגרפיה</AppText>
      {(Object.keys(textStyles) as (keyof typeof textStyles)[]).map((v) => (
        <AppText key={v} variant={v}>{`${v} · מי הבקיע בגמר?`}</AppText>
      ))}

      <AppText variant="heading">כפתורים</AppText>
      <StickerButton label="שחק עכשיו" icon="football" size="lg" fullWidth onPress={() => toast('ראשי', 'success')} />
      <View style={styles.row}>
        <StickerButton label="פרס" tone="prize" onPress={() => toast('פרס', 'info')} />
        <StickerButton label="רצף" tone="danger" onPress={() => toast('שגיאה', 'error')} />
        <StickerButton label="יהלום" tone="gem" onPress={() => {}} />
      </View>
      <View style={styles.row}>
        <StickerButton label="משני" tone="ghost" onPress={() => {}} />
        <StickerButton label="טוען" loading onPress={() => {}} />
        <StickerButton label="כבוי" disabled onPress={() => {}} />
      </View>

      <AppText variant="heading">מטבעות ושחקן</AppText>
      <View style={styles.row}>
        <CurrencyPill currency="coins" amount={12500} />
        <CurrencyPill currency="gems" amount={80} />
        <CurrencyPill currency="dust" amount={340} />
      </View>
      <View style={styles.row}>
        <AvatarBadge avatarId="avatar_01" level={3} />
        <AvatarBadge avatarId="avatar_05" level={27} />
        <StreakFlame count={0} />
        <StreakFlame count={7} />
      </View>

      <AppText variant="heading">התקדמות</AppText>
      <ProgressBar value={0.62} accessibilityLabel="62%" />
      <ProgressBar value={0.3} color={colors.prize} accessibilityLabel="30%" />

      <AppText variant="heading">נדירות</AppText>
      <View style={styles.wrap}>
        {(Object.keys(rarityColors) as RarityKey[]).map((r) => (
          <RarityFrame key={r} rarity={r} width={96}>
            <Ionicons name="star" size={30} color={palette.night950} />
          </RarityFrame>
        ))}
        <RarityFrame rarity="common" locked width={96}>
          <Ionicons name="help" size={30} color={colors.textMuted} />
        </RarityFrame>
      </View>

      <AppText variant="heading">כרטיסים ומצבים</AppText>
      <Card>
        <AppText>כרטיס רגיל</AppText>
      </Card>
      <Card kind="sticker" tint={palette.night700}>
        <AppText>כרטיס מדבקה</AppText>
      </Card>
      <Skeleton height={60} />
      <EmptyState icon="albums-outline" title="ריק" body="מצב ריק עם פעולה" actionLabel="פעולה" onAction={() => {}} />
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
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});

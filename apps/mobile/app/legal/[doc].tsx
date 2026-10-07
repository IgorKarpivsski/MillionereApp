import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Screen, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { brand } from '@/lib/brand';
import { strings } from '@/lib/i18n';

/**
 * PLACEHOLDERS. Real Terms and Privacy Policy must be written by a lawyer
 * before submission (App Store requires a privacy policy URL as well).
 */
const DOCS: Record<string, { title: string; body: string[] }> = {
  accessibility: {
    title: strings.settings.a11yStatement,
    body: [
      'אנחנו רוצים שכל אחד יוכל לשחק ב"האלוף", כולל אנשים עם מוגבלות.',
      'מה כבר עשינו: תמיכה בקורא מסך (TalkBack ו-VoiceOver) עם תיאור בעברית לכפתורים, לתמונות ולמצב המשחק; התשובות ממוספרות ומסומנות גם בסמל (וי או איקס) ולא רק בצבע; ניגודיות צבעים לפי WCAG AA; כפתורים בגודל 44 נקודות לפחות; תמיכה בהגדלת גופן של המכשיר ובאפשרות "טקסט גדול"; אפשרות "הפחתת תנועה" שמבטלת אנימציות; כיבוי צלילים, מוזיקה ורטט בכל רגע.',
      'מה עוד לא מושלם: יש שאלות עם מגבלת זמן; אנחנו עובדים על מצב עם זמן מורחב.',
      `נתקלת בבעיית נגישות? נשמח לשמוע ולתקן: ${brand.supportEmail}`,
      'עודכן לאחרונה: אוקטובר 2026.',
    ],
  },
  terms: {
    title: strings.settings.terms,
    body: [
      'טיוטה. המסמך הסופי ייכתב בליווי עורך דין לפני ההשקה.',
      'המשחק מיועד לבידור. מטבעות, יהלומים ופריטים במשחק אינם כסף ואין להם ערך מחוץ למשחק.',
      'אסור להשתמש בתוכנות עזר, בבוטים או בניצול באגים כדי לקבל פרסים.',
    ],
  },
  privacy: {
    title: strings.settings.privacy,
    body: [
      'טיוטה. המסמך הסופי ייכתב בליווי עורך דין לפני ההשקה.',
      'אנחנו שומרים את ההתקדמות שלך במשחק, את ההגדרות ואת היסטוריית המטבעות, כדי שתוכל לשחק מכל מכשיר.',
      'אפשר למחוק את החשבון וכל הנתונים שלו מתוך ההגדרות בכל רגע.',
      `לשאלות: ${brand.supportEmail}`,
    ],
  },
};

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = DOCS[doc ?? ''] ?? DOCS.terms!;
  return (
    <Screen
      header={
        <View style={styles.header}>
          <AppText variant="title">{d.title}</AppText>
          <StickerButton label={strings.common.close} size="sm" tone="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      <Card>
        <View style={styles.body}>
          {d.body.map((p, i) => (
            <AppText key={i} color={i === 0 && doc !== 'accessibility' ? colors.prize : colors.text}>
              {p}
            </AppText>
          ))}
        </View>
      </Card>
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
  body: { gap: space.md },
});

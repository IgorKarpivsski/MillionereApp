import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Screen, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { brand } from '@/lib/brand';
import { strings } from '@/lib/i18n';

/**
 * Short in-app summaries; the full Terms and Privacy Policy live on the public
 * site (docs/ in the repo, served by GitHub Pages) and open from here.
 */
const DOCS: Record<string, { title: string; body: string[]; url?: string }> = {
  accessibility: {
    title: strings.settings.a11yStatement,
    body: [
      'אנחנו רוצים שכל אחד יוכל לשחק ב"האלוף", כולל אנשים עם מוגבלות.',
      'מה כבר עשינו: תמיכה בקורא מסך (TalkBack ו-VoiceOver) עם תיאור בעברית לכפתורים, לתמונות ולמצב המשחק; התשובות ממוספרות ומסומנות גם בסמל (וי או איקס) ולא רק בצבע; ניגודיות צבעים לפי WCAG AA; כפתורים בגודל 44 נקודות לפחות; תמיכה בהגדלת גופן של המכשיר ובאפשרות "טקסט גדול"; אפשרות "הפחתת תנועה" שמבטלת אנימציות; כיבוי צלילים, מוזיקה ורטט בכל רגע.',
      'זמן מורחב: בהגדרות אפשר לקבל פי 1.5 זמן לכל שאלה במשחק הרגיל ובאתגר היומי.',
      'מה עוד לא מושלם: במשחק מול חבר הזמן שווה לשני השחקנים.',
      `נתקלת בבעיית נגישות? נשמח לשמוע ולתקן: ${brand.supportEmail}`,
      'עודכן לאחרונה: אוקטובר 2026.',
    ],
  },
  terms: {
    title: strings.settings.terms,
    url: `${brand.siteUrl}/terms.html`,
    body: [
      'המשחק מיועד לבידור. מטבעות, יהלומים ופריטים במשחק אינם כסף ואין להם ערך מחוץ למשחק.',
      'תוכן החבילות אקראי, והסיכויים מוצגים לפני כל פתיחה. אפשר להשלים כל אלבום בלי לשלם כסף אמיתי.',
      'אסור להשתמש בתוכנות עזר, בבוטים או בניצול באגים, ואסור להטריד או לקלל בצ\'אט.',
    ],
  },
  privacy: {
    title: strings.settings.privacy,
    url: `${brand.siteUrl}/privacy.html`,
    body: [
      'אנחנו שומרים את ההתקדמות שלך במשחק, את ההגדרות ואת היסטוריית המטבעות, כדי שתוכל לשחק מכל מכשיר.',
      'לא אוספים מיקום, אנשי קשר או תמונות. הפרסומות אינן מותאמות אישית, ולילדים הן מוגבלות לתוכן לכל הגילאים.',
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
            <AppText key={i} color={colors.text}>
              {p}
            </AppText>
          ))}
          {d.url ? <StickerButton label={strings.settings.fullDoc} icon="open-outline" tone="outline" onPress={() => void WebBrowser.openBrowserAsync(d.url!)} /> : null}
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

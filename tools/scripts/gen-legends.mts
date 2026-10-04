// Builds the "אגדות" catalogue: 96 ORIGINAL fictional football legends in 8
// albums, with deterministic caricature parameters. Writes the seed migration.
//
//   node --experimental-strip-types tools/scripts/gen-legends.mts
// Names are invented first-name + nickname pairs; no real player is depicted.
import { writeFileSync } from 'node:fs';

type Era = '70s' | '80s' | '90s' | '00s' | 'modern';
type Pos = 'GK' | 'DEF' | 'MID' | 'FWD';
const ALBUMS: Array<{ slug: string; title: string; blurb: string; era: Era | 'mix'; pos?: Pos; rarities: string[] }> = [
  { slug: 'seventies', title: 'אגדות שנות ה-70', blurb: 'שפמים, פאות ומגרשי בוץ.', era: '70s', rarities: [] },
  { slug: 'eighties', title: 'קוסמי שנות ה-80', blurb: 'מאלטים, סרטי ראש ובעיטות מסובבות.', era: '80s', rarities: [] },
  { slug: 'nineties', title: 'כוכבי הניינטיז', blurb: 'חולצות רחבות וגולים מהחצי.', era: '90s', rarities: [] },
  { slug: 'millennium', title: 'דור המילניום', blurb: 'ג\'ל בשיער ונעליים צבעוניות.', era: '00s', rarities: [] },
  { slug: 'keepers', title: 'שוערים אגדיים', blurb: 'הידיים הכי בטוחות בליגה.', era: 'mix', pos: 'GK', rarities: [] },
  { slug: 'defenders', title: 'חומת הברזל', blurb: 'אף חלוץ לא עבר אותם.', era: 'mix', pos: 'DEF', rarities: [] },
  { slug: 'strikers', title: 'מלכי השערים', blurb: 'רואים רשת — בועטים.', era: 'mix', pos: 'FWD', rarities: [] },
  { slug: 'hall', title: 'היכל התהילה', blurb: 'הנדירים מכולם.', era: 'mix', rarities: ['epic', 'epic', 'epic', 'epic', 'legendary', 'legendary', 'legendary', 'legendary', 'legendary', 'iconic', 'iconic', 'iconic'] },
];
const NORMAL = ['common', 'common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'legendary'];
const ERA_POS: Pos[] = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];

const FIRST = ['אבנר', 'בועז', 'גדעון', 'דני', 'הראל', 'ויקטור', 'זיו', 'חזי', 'טוביה', 'יגאל', 'כפיר', 'ליאור', 'מוטי', 'נחום',
  'סער', 'עמוס', 'פיני', 'צביקה', 'קובי', 'רפי', 'שמוליק', 'תומר', 'אלון', 'ברק', 'גיל', 'דודו', 'הדר', 'זאביק', 'חיליק', 'יוחאי',
  'לייבו', 'מני', 'ניסו', 'סולי', 'עופר', 'פלג', 'צחי', 'קלמן', 'רוני', 'שאולי', 'תמיר', 'אושרי', 'בני', 'גבי', 'דורון', 'הלל',
  'ז\'קי', 'חנוך', 'ירון', 'כרמי', 'לולו', 'מאיר', 'נוני', 'סשה', 'עזרא', 'פרץ', 'צדוק', 'קיקי', 'רמי', 'שוקי', 'תקווה', 'אריק',
  'בצלאל', 'גוני', 'דוביד', 'הנס', 'וולי', 'זוהר', 'חמי', 'ישי', 'כוכי', 'לזר', 'מישל', 'נתי', 'סמי', 'עידו', 'פאבל', 'צפריר',
  'קוקו', 'רובי', 'שלמי', 'תדי', 'איקא', 'בוקי', 'גולי', 'דידי', 'הוגו', 'זנגי', 'חביבי', 'יאנקו', 'כדורי', 'לוקה', 'מוקי', 'נפתלי',
  'סטפן', 'עמי', 'פיפו', 'ציון', 'קרול', 'רולי'];
const NICK: Record<Pos, string[]> = {
  GK: ['החתול', 'הכספת', 'התמנון', 'הקפיץ', 'הכפפה', 'המגנט', 'הזיקית', 'הצוללן', 'הענק', 'הדלת', 'המלאך', 'הקורה', 'השקט', 'הנץ', 'הגומי', 'הבונקר'],
  DEF: ['הקיר', 'הבולדוזר', 'הסלע', 'הטנק', 'המחסום', 'הברזל', 'השוטר', 'הצל', 'הפטיש', 'המגדל', 'הדוב', 'הבטון', 'השריון', 'השער הנעול', 'הסכר', 'המלקחיים', 'הגדר', 'החומה', 'הרוטווילר', 'המטאטא'],
  MID: ['הקוסם', 'הפרופסור', 'המנוע', 'המצפן', 'הדירקטור', 'האמן', 'השעון', 'המנצח', 'הגאון', 'המאסטרו', 'הרדאר', 'הלב', 'המתזמר', 'הנווט', 'הפסנתרן', 'המהנדס', 'האדריכל', 'השף'],
  FWD: ['הטיל', 'הרכבת', 'הנמר', 'הצלף', 'הברק', 'השועל', 'הטורנדו', 'הפנתר', 'התותח', 'הסילון', 'הנחש', 'הצ\'יטה', 'הפגז', 'העקרב', 'הזיקוק', 'הסופה', 'הראש', 'הבומבה', 'הרקטה', 'הכדורון'],
};
const BIO: Record<Pos, string[]> = {
  GK: ['עצר שלושה פנדלים בגמר אחד, ועוד אחד באימון אחרי.', 'צעק על ההגנה כל כך חזק שהקהל ביציע התיישר.', 'אף פעם לא כבסו לו את הכפפות — "זה מביא מזל".', 'יצא מהשער לכדרר והגיע עד הקו האמצעי.', 'קפץ כל כך גבוה שנגע בקורה עם המרפק.', 'שיחק משחק שלם עם כובע מצחייה נגד השמש.'],
  DEF: ['אף פעם לא קיבל כרטיס אדום. צהובים — זה סיפור אחר.', 'הוציא כדור מהקו עם הראש, בזמן שהיה על הקרקע.', 'חלוצי היריבה ביקשו להחליף צד כשראו אותו.', 'כבש רק שער אחד בקריירה — בדרבי, כמובן.', 'התיקול שלו נשמע עד הלשכה של המאמן.', 'רץ 90 דקות בלי לשתות מים, לפי האגדה.'],
  MID: ['מסר מסירות שאף אחד חוץ ממנו לא ראה.', 'בעט פינה ישר לרשת. פעמיים.', 'ידע את המיקום של כל שחקן במגרש בלי להסתכל.', 'השעון של המגרש היה מתכוונן לפי הקצב שלו.', 'כידרר את כל ההגנה ואז מסר לחבר שיכבוש.', 'אמרו שהוא יכול לעצור כדור על הבוהן ולשתות קפה.'],
  FWD: ['כבש מכל זווית — כולל מהזווית שלא קיימת.', 'הבקיע שלושה שערים בתוך שמונה דקות.', 'הבעיטה שלו קרעה את הרשת, והמשחק נעצר לתיקון.', 'חגג כל גול עם אותו ריקוד מוזר.', 'נגח מגובה של שחקן כדורסל.', 'השוער היריב עדיין חולם עליו בלילות.'],
};
const ERAS: Era[] = ['70s', '80s', '90s', '00s', 'modern'];

let seed = 7001;
const used = new Set<string>();
let fi = 0;
const rows: string[] = [];
const albums: string[] = [];
ALBUMS.forEach((al, ai) => {
  albums.push(`('${al.slug}', '${al.title.replace(/'/g, "''")}', '${al.blurb.replace(/'/g, "''")}', ${ai + 1})`);
  const rarities = al.rarities.length ? al.rarities : NORMAL;
  for (let n = 1; n <= 12; n++) {
    const pos: Pos = al.pos ?? (al.slug === 'hall' ? (['GK', 'DEF', 'MID', 'FWD'] as Pos[])[n % 4]! : ERA_POS[n - 1]!);
    const era: Era = al.era === 'mix' ? ERAS[(n + ai) % ERAS.length]! : al.era;
    let name = '';
    for (let tries = 0; tries < 200; tries++) {
      const first = FIRST[(fi++ * 7) % FIRST.length]!;
      const nick = NICK[pos][(seed + tries) % NICK[pos].length]!;
      const cand = `${first} "${nick}"`;
      if (!used.has(cand) && ![...used].some((u) => u.endsWith(`"${nick}"`) && used.size < 0)) { name = cand; used.add(cand); break; }
    }
    const artSeed = seed;
    seed += 97;
    const bio = BIO[pos][(n + ai * 5) % BIO[pos].length]!;
    const id = `${al.slug}_${String(n).padStart(2, '0')}`;
    rows.push(`('${id}', '${al.slug}', ${n}, '${rarities[n - 1]}', '${name.replace(/'/g, "''")}', '${pos}', '${era}', '${bio.replace(/'/g, "''")}', ${artSeed})`);
  }
});

const sql = `-- Generated by tools/scripts/gen-legends.mts — do not edit by hand.
-- 96 ORIGINAL fictional legends (no real players), 8 albums of 12.
insert into public.albums (slug, title, blurb, sort) values
  ${albums.join(',\n  ')}
on conflict (slug) do update set title = excluded.title, blurb = excluded.blurb, sort = excluded.sort;

insert into public.collectibles (id, album, number, rarity, name_he, position, era, bio_he, art_seed) values
  ${rows.join(',\n  ')}
on conflict (id) do update set rarity = excluded.rarity, name_he = excluded.name_he, position = excluded.position,
  era = excluded.era, bio_he = excluded.bio_he, art_seed = excluded.art_seed;
`;
writeFileSync('supabase/migrations/20261004000007_collection_seed.sql', sql);
console.log(`albums ${albums.length}, items ${rows.length}`);

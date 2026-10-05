// The full sticker catalogue: 8 albums of ORIGINAL fictional legends + 5 object
// albums (stadiums, shirts, balls, fictional clubs, merch). Every album runs from
// common to the ultra-rare "מיתי" (iconic) tier.
//
//   node --experimental-strip-types tools/scripts/gen-catalog.mts
// Writes:
//   supabase/migrations/20261005000002_catalog_seed.sql   (albums + collectibles)
//   tools/art/prompts.json                                 (AI art prompts, one per card)
import { writeFileSync } from 'node:fs';
import { legendParams, type LegendArtParams } from '../../packages/shared/src/legendArt.ts';

type Era = '70s' | '80s' | '90s' | '00s' | 'modern';
type Pos = 'GK' | 'DEF' | 'MID' | 'FWD' | 'OBJ';
const RAR = ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'legendary', 'iconic'];

const STYLE =
  'Bold pop-art comic illustration, thick black ink outlines, Ben-Day halftone dots, vibrant flat colors, cartoon caricature proportions.';
const NO_TEXT = 'No text, no letters, no numbers, no logos, no brand marks, no crests of real clubs.';
const RARITY_FX: Record<string, string> = {
  common: 'Simple bright background.',
  uncommon: 'Bright background with speed lines.',
  rare: 'Electric blue sunburst background with sparkles.',
  epic: 'Purple cosmic energy background, glowing outline.',
  legendary: 'Radiant golden sunburst background, golden aura, sparkles.',
  iconic: 'Prismatic holographic rainbow background, fiery golden aura, lightning, epic glow — the rarest card.',
};

// ---------------------------------------------------------------- players
const PLAYER_ALBUMS: Array<{ slug: string; title: string; blurb: string; era: Era | 'mix'; pos?: Pos }> = [
  { slug: 'seventies', title: 'אגדות שנות ה-70', blurb: 'שפמים, פאות ומגרשי בוץ.', era: '70s' },
  { slug: 'eighties', title: 'קוסמי שנות ה-80', blurb: 'מאלטים, סרטי ראש ובעיטות מסובבות.', era: '80s' },
  { slug: 'nineties', title: 'כוכבי הניינטיז', blurb: 'חולצות רחבות וגולים מהחצי.', era: '90s' },
  { slug: 'millennium', title: 'דור המילניום', blurb: "ג'ל בשיער ונעליים צבעוניות.", era: '00s' },
  { slug: 'keepers', title: 'שוערים אגדיים', blurb: 'הידיים הכי בטוחות בליגה.', era: 'mix', pos: 'GK' },
  { slug: 'defenders', title: 'חומת הברזל', blurb: 'אף חלוץ לא עבר אותם.', era: 'mix', pos: 'DEF' },
  { slug: 'strikers', title: 'מלכי השערים', blurb: 'רואים רשת — בועטים.', era: 'mix', pos: 'FWD' },
  { slug: 'hall', title: 'היכל התהילה', blurb: 'האגדות של כל הזמנים.', era: 'mix' },
];
const ERA_POS: Pos[] = ['GK', 'DEF', 'DEF', 'MID', 'DEF', 'MID', 'FWD', 'MID', 'DEF', 'FWD', 'MID', 'FWD'];
const ERAS: Era[] = ['70s', '80s', '90s', '00s', 'modern'];
const FIRST = ['אבנר', 'בועז', 'גדעון', 'דני', 'הראל', 'ויקטור', 'זיו', 'חזי', 'טוביה', 'יגאל', 'כפיר', 'ליאור', 'מוטי', 'נחום',
  'סער', 'עמוס', 'פיני', 'צביקה', 'קובי', 'רפי', 'שמוליק', 'תומר', 'אלון', 'ברק', 'גיל', 'דודו', 'הדר', 'זאביק', 'חיליק', 'יוחאי',
  'לייבו', 'מני', 'ניסו', 'סולי', 'עופר', 'פלג', 'צחי', 'קלמן', 'רוני', 'שאולי', 'תמיר', 'אושרי', 'בני', 'גבי', 'דורון', 'הלל',
  "ז'קי", 'חנוך', 'ירון', 'כרמי', 'לולו', 'מאיר', 'נוני', 'סשה', 'עזרא', 'פרץ', 'צדוק', 'קיקי', 'רמי', 'שוקי', 'אריק',
  'בצלאל', 'גוני', 'דוביד', 'הנס', 'וולי', 'זוהר', 'חמי', 'ישי', 'כוכי', 'לזר', 'מישל', 'נתי', 'סמי', 'עידו', 'פאבל', 'צפריר',
  'קוקו', 'רובי', 'שלמי', 'תדי', 'איקא', 'בוקי', 'גולי', 'דידי', 'הוגו', 'זנגי', 'חביבי', 'יאנקו', 'כדורי', 'לוקה', 'מוקי', 'נפתלי',
  'סטפן', 'עמי', 'פיפו', 'ציון', 'קרול', 'רולי'];
const NICK: Record<Exclude<Pos, 'OBJ'>, string[]> = {
  GK: ['החתול', 'הכספת', 'התמנון', 'הקפיץ', 'הכפפה', 'המגנט', 'הזיקית', 'הצוללן', 'הענק', 'הדלת', 'המלאך', 'הקורה', 'השקט', 'הנץ', 'הגומי', 'הבונקר'],
  DEF: ['הקיר', 'הבולדוזר', 'הסלע', 'הטנק', 'המחסום', 'הברזל', 'השוטר', 'הצל', 'הפטיש', 'המגדל', 'הדוב', 'הבטון', 'השריון', 'השער הנעול', 'הסכר', 'המלקחיים', 'הגדר', 'החומה', 'הרוטווילר', 'המטאטא'],
  MID: ['הקוסם', 'הפרופסור', 'המנוע', 'המצפן', 'הדירקטור', 'האמן', 'השעון', 'המנצח', 'הגאון', 'המאסטרו', 'הרדאר', 'הלב', 'המתזמר', 'הנווט', 'הפסנתרן', 'המהנדס', 'האדריכל', 'השף'],
  FWD: ['הטיל', 'הרכבת', 'הנמר', 'הצלף', 'הברק', 'השועל', 'הטורנדו', 'הפנתר', 'התותח', 'הסילון', 'הנחש', "הצ'יטה", 'הפגז', 'העקרב', 'הזיקוק', 'הסופה', 'הראש', 'הבומבה', 'הרקטה', 'הכדורון'],
};
const BIO: Record<Exclude<Pos, 'OBJ'>, string[]> = {
  GK: ['עצר שלושה פנדלים בגמר אחד, ועוד אחד באימון אחרי.', 'צעק על ההגנה כל כך חזק שהקהל ביציע התיישר.', 'אף פעם לא כבסו לו את הכפפות — "זה מביא מזל".', 'יצא מהשער לכדרר והגיע עד הקו האמצעי.', 'קפץ כל כך גבוה שנגע בקורה עם המרפק.', 'שיחק משחק שלם עם כובע מצחייה נגד השמש.'],
  DEF: ['אף פעם לא קיבל כרטיס אדום. צהובים — זה סיפור אחר.', 'הוציא כדור מהקו עם הראש, בזמן שהיה על הקרקע.', 'חלוצי היריבה ביקשו להחליף צד כשראו אותו.', 'כבש רק שער אחד בקריירה — בדרבי, כמובן.', 'התיקול שלו נשמע עד הלשכה של המאמן.', 'רץ 90 דקות בלי לשתות מים, לפי האגדה.'],
  MID: ['מסר מסירות שאף אחד חוץ ממנו לא ראה.', 'בעט פינה ישר לרשת. פעמיים.', 'ידע את המיקום של כל שחקן במגרש בלי להסתכל.', 'השעון של המגרש היה מתכוונן לפי הקצב שלו.', 'כידרר את כל ההגנה ואז מסר לחבר שיכבוש.', 'אמרו שהוא יכול לעצור כדור על הבוהן ולשתות קפה.'],
  FWD: ['כבש מכל זווית — כולל מהזווית שלא קיימת.', 'הבקיע שלושה שערים בתוך שמונה דקות.', 'הבעיטה שלו קרעה את הרשת, והמשחק נעצר לתיקון.', 'חגג כל גול עם אותו ריקוד מוזר.', 'נגח מגובה של שחקן כדורסל.', 'השוער היריב עדיין חולם עליו בלילות.'],
};

const SKIN = ['fair', 'light', 'tan', 'olive-brown', 'brown', 'dark brown'];
const HAIRC = ['black', 'dark brown', 'brown', 'golden blond', 'light blond', 'ginger', 'grey', 'white'];
const HAIR: Record<LegendArtParams['hair'], string> = {
  afro: 'a big round afro', mullet: 'a classic mullet haircut', bald: 'a shiny bald head with side fringe', curly: 'short tight curly hair',
  sidepart: 'neatly side-parted hair', buzz: 'a buzz cut', long: 'long flowing shoulder-length hair', spiky: 'spiky gelled hair', receding: 'a receding hairline',
};
const COLOR: Record<string, string> = {
  '#C8102E': 'red', '#FFFFFF': 'white', '#0B5FA5': 'royal blue', '#1E8E3E': 'green', '#F2C200': 'yellow', '#1A1714': 'black',
  '#6A2C91': 'purple', '#E35205': 'orange', '#00A3AD': 'teal', '#7A0019': 'maroon', '#7FB2E5': 'sky blue', '#2B2B2B': 'charcoal',
};
const PATTERN: Record<LegendArtParams['kit']['pattern'], string> = {
  plain: 'plain', stripes: 'vertical-striped', hoops: 'horizontal-hooped', sash: 'diagonal-sash', half: 'half-and-half',
};
const POSE: Record<Exclude<Pos, 'OBJ'>, string[]> = {
  GK: ['diving sideways with big goalkeeper gloves stretched out', 'catching a ball against his chest with goalkeeper gloves', 'punching the ball away with goalkeeper gloves'],
  DEF: ['arms crossed with a tough confident look', 'sliding into a tackle', 'heading the ball powerfully'],
  MID: ['controlling a ball on his chest', 'pointing forward like a conductor', 'doing a step-over with the ball'],
  FWD: ['celebrating a goal with a fist pump', 'striking a volley', 'knee-sliding in celebration with arms wide'],
};
const ERA_TXT: Record<Era, string> = { '70s': '1970s', '80s': '1980s', '90s': '1990s', '00s': '2000s', modern: 'modern-day' };

function playerPrompt(p: LegendArtParams, era: Era, pos: Exclude<Pos, 'OBJ'>, rarity: string, n: number): string {
  const facial = [
    p.mustache ? { chevron: 'a thick chevron moustache', handlebar: 'a handlebar moustache', pencil: 'a thin pencil moustache' }[p.mustache] : null,
    p.beard ? { full: 'a full beard', goatee: 'a goatee', stubble: 'stubble' }[p.beard] : null,
    p.sideburns ? 'long sideburns' : null,
    p.headband ? 'a sweatband headband' : null,
  ].filter(Boolean).join(', ');
  const mood = { smile: 'a warm smile', grin: 'a huge cheeky grin', shout: 'shouting with passion', smirk: 'a confident smirk' }[p.mouth];
  const kit = `${PATTERN[p.kit.pattern]} ${COLOR[p.kit.a] ?? 'red'} and ${COLOR[p.kit.b] ?? 'white'} ${era === '70s' || era === '80s' ? 'retro collared' : ''} football jersey`;
  return [
    STYLE,
    `An ORIGINAL fictional ${ERA_TXT[era]} footballer (not a real person), ${SKIN[p.skin]} skin, ${HAIR[p.hair]} (${HAIRC[p.hairColor]}),`,
    facial ? `${facial},` : '',
    `${mood}, wearing a ${kit} with no logos, no crests and no numbers, ${POSE[pos][n % 3]}.`,
    'Big head, expressive face, upper body framed like a collectible sticker.',
    RARITY_FX[rarity],
    NO_TEXT,
  ].join(' ');
}

// ---------------------------------------------------------------- objects
type Obj = { name: string; bio: string; art: string };
const OBJECT_ALBUMS: Array<{ slug: string; title: string; blurb: string; items: Obj[] }> = [
  {
    slug: 'stadiums', title: 'אצטדיוני הלילה', blurb: 'המגרשים שכל אוהד חולם לבקר בהם.',
    items: [
      { name: 'מגרש השכונה', bio: 'שני תיקים במקום שער, והמשחק הכי חשוב בעולם.', art: 'a tiny neighbourhood pitch between apartment blocks with backpacks as goalposts at sunset' },
      { name: 'אצטדיון החוף', bio: 'כל קרן מסתיימת בקפיצה לים.', art: 'a small stadium right on a sandy beach with waves and palm trees' },
      { name: 'מגרש הכפר', bio: 'הפרות צופות מעבר לגדר.', art: 'a muddy village pitch with a wooden fence and cows watching' },
      { name: 'אצטדיון הגשם', bio: 'משחקים גם כשהשמיים נופלים.', art: 'a stadium in pouring rain with puddles and umbrellas in the stands' },
      { name: 'הקערה האדומה', bio: '30 אלף אוהדים ששרים כמו אחד.', art: 'a bowl-shaped stadium packed with a red-scarfed crowd, flares smoke' },
      { name: 'זירת הזכוכית', bio: 'גג שקוף שרואים דרכו כוכבים.', art: 'a futuristic stadium with a glass roof and stars above' },
      { name: 'אצטדיון ההר', bio: 'הכדור עף יותר רחוק באוויר הדליל.', art: 'a stadium on top of a mountain with snowy peaks around' },
      { name: 'הטירה', bio: 'אצטדיון עתיק עם חומות אבן.', art: 'an ancient stone castle-like stadium with towers and banners' },
      { name: 'הספינה', bio: 'מגרש שצף על המים.', art: 'a football pitch floating on a giant ship at sea' },
      { name: 'אצטדיון הזיקוקים', bio: 'כל גול — שמיים מוארים.', art: 'a night stadium with huge colourful fireworks exploding above' },
      { name: 'מקדש הכדורגל', bio: 'כאן נולדות האגדות.', art: 'a majestic golden stadium glowing like a temple under floodlights' },
      { name: 'האצטדיון בעננים', bio: 'יש אומרים שהוא קיים רק בחלומות.', art: 'a magical stadium floating on clouds with rainbow floodlights' },
    ],
  },
  {
    slug: 'shirts', title: 'ארון החולצות', blurb: 'חולצות שאי אפשר לשכוח.',
    items: [
      { name: 'הלבנה הקלאסית', bio: 'פשוטה, נקייה, נצחית.', art: 'a plain white retro football shirt with a round collar' },
      { name: 'פסי הזברה', bio: 'שחור-לבן, בלי פשרות.', art: 'a black and white vertical-striped football shirt' },
      { name: 'הצווארון של סבא', bio: 'כפתורים, שרוכים ונוסטלגיה.', art: 'a vintage laced-collar football shirt in deep green' },
      { name: 'הכתומה הבוערת', bio: 'רואים אותה מכל היציע.', art: 'a bright orange football shirt with black trim' },
      { name: 'חולצת הטבעות', bio: 'פסים לרוחב, אופנה לגובה.', art: 'a blue and white horizontal-hooped football shirt' },
      { name: 'האלכסון', bio: 'פס אחד שמשנה הכל.', art: 'a white football shirt with a bold red diagonal sash' },
      { name: 'חולצת השוער המטורפת', bio: 'כל צבעי הקשת בבת אחת.', art: 'a wild 1990s goalkeeper shirt with crazy neon geometric patterns' },
      { name: 'הניינטיז הרחבה', bio: 'שלוש מידות מעל, כמו שצריך.', art: 'an oversized 1990s football shirt with bold abstract shapes in purple and teal' },
      { name: 'חולצת החצי-חצי', bio: 'חצי אדום, חצי כחול, כולו לב.', art: 'a half red half blue football shirt' },
      { name: 'הסוואה', bio: 'אף מגן לא ימצא אותך.', art: 'a football shirt with a camouflage pattern in greens' },
      { name: 'חולצת הזהב', bio: 'לובשים אותה רק בגמר.', art: 'a shiny metallic gold football shirt on a hanger, glowing' },
      { name: 'חולצת הכוכבים', bio: 'תפורה מחוטים של לילה.', art: 'a dark navy football shirt covered in glowing constellations and stars' },
    ],
  },
  {
    slug: 'balls', title: 'כדורי האגדה', blurb: 'מכדור עור עם שרוכים ועד כדור מהעתיד.',
    items: [
      { name: 'כדור הסמרטוטים', bio: 'כך הכל התחיל — בגרביים ישנים.', art: 'a homemade football made of rags and string' },
      { name: 'כדור העור עם השרוך', bio: 'כבד כמו אבן כשהוא רטוב.', art: 'an antique brown leather football with laces' },
      { name: 'כדור הפנלים', bio: 'מחומשים שחורים, משושים לבנים.', art: 'a classic black and white panelled football' },
      { name: 'כדור החוף', bio: 'קל, צבעוני ובלתי צפוי.', art: 'a colourful inflatable beach ball on sand' },
      { name: 'כדור הרחוב', bio: 'שרד אלף קירות.', art: 'a scuffed worn street football against a graffiti-free brick wall' },
      { name: 'הכדור הכתום', bio: 'למשחקים בשלג.', art: 'a bright orange football in snow' },
      { name: 'כדור הניאון', bio: 'זוהר בחושך.', art: 'a glowing neon green and pink football in the dark' },
      { name: 'כדור האימון', bio: 'ספג יותר בעיטות מכל כדור אחר.', art: 'a pile of training footballs in a net bag' },
      { name: 'כדור הגמר', bio: 'נגע בו רק מי שכבש.', art: 'a shiny white and silver match ball on a pedestal with spotlight' },
      { name: 'כדור הלבה', bio: 'חם מדי לנגיחות.', art: 'a football made of glowing lava cracks, fiery' },
      { name: 'כדור הזהב', bio: 'מוצג בוויטרינה, לא בועטים.', art: 'a solid gold football glittering in a glass display' },
      { name: 'הכדור מהעתיד', bio: 'מרחף, מסתובב, מחייך.', art: 'a futuristic hovering football with holographic light rings' },
    ],
  },
  {
    slug: 'clubs', title: 'קבוצות מהאגדות', blurb: 'קבוצות דמיוניות עם קמעות אמיתיים מדי.',
    items: [
      { name: 'הצבים מהשכונה', bio: 'איטיים — אבל אף פעם לא מוותרים.', art: 'a cartoon turtle mascot in a green kit, original fictional club badge shape without text' },
      { name: 'יוני הנמל', bio: 'עפים על כל כדור גבוה.', art: 'a cheeky pigeon mascot in a grey kit by a harbour' },
      { name: 'עזי ההר', bio: 'מטפסים מהליגה התחתונה.', art: 'a determined mountain goat mascot in a brown kit' },
      { name: 'דבורי העמק', bio: 'עוקצות בהתקפות מתפרצות.', art: 'a buzzing bee mascot in a yellow and black striped kit' },
      { name: 'הקיפודים', bio: 'קשה מאוד לעבור את ההגנה.', art: 'a spiky hedgehog mascot in a red kit guarding a goal' },
      { name: 'פילי המדבר', bio: 'גדולים, חזקים, זוכרים כל הפסד.', art: 'a strong elephant mascot in a sand-coloured kit in the desert' },
      { name: 'השועלים האדומים', bio: 'ערמומיים בכל מסירה.', art: 'a sly red fox mascot in an orange kit' },
      { name: 'כרישי המפרץ', bio: 'מריחים גול מקילומטר.', art: 'a grinning shark mascot in a blue kit leaping from the sea' },
      { name: 'ינשופי הלילה', bio: 'משחקים הכי טוב אחרי חצות.', art: 'a wise owl mascot in a purple kit under the moon' },
      { name: 'דרקוני הצפון', bio: 'הקהל שלהם יורק אש.', art: 'a friendly green dragon mascot in a green and gold kit' },
      { name: 'האריות המוזהבים', bio: 'שואגים בכל גמר.', art: 'a majestic lion mascot with a golden mane in a gold kit' },
      { name: 'עוף החול', bio: 'קם מכל ירידת ליגה.', art: 'a blazing phoenix mascot rising from flames in a red and gold kit' },
    ],
  },
  {
    slug: 'merch', title: 'חנות המזכרות', blurb: 'כל מה שאוהד אמיתי צריך.',
    items: [
      { name: 'הצעיף', bio: 'נלבש גם באוגוסט.', art: 'a knitted striped football scarf without text' },
      { name: 'כובע הגרב', bio: 'עם פונפון, כמובן.', art: 'a striped bobble hat for football fans' },
      { name: 'האצבע הענקית', bio: 'מספר אחד ביציע.', art: 'a giant foam finger in bright colours' },
      { name: 'הספל של שבת', bio: 'קפה לפני המשחק, תה אחרי.', art: 'a chunky mug decorated with a football pattern, steam rising' },
      { name: 'משרוקית השופט', bio: 'הכי לא אהובה ביציע.', art: 'a shiny referee whistle on a lanyard' },
      { name: 'התוף של היציע', bio: 'קובע את הקצב לאלפים.', art: 'a big fan drum with drumsticks in the stands' },
      { name: 'הנעליים הראשונות', bio: 'קטנות מדי, אבל אי אפשר לזרוק.', art: 'a pair of worn small football boots tied by the laces' },
      { name: 'הכרטיס לגמר', bio: 'שמור בארנק כבר 20 שנה.', art: 'an old stadium match ticket stub without readable text, framed' },
      { name: 'הדגל של הקהל', bio: 'מתנופף מהשורה הראשונה.', art: 'a huge waving fan flag with bold stripes, no text' },
      { name: 'מחזיק המפתחות', bio: 'כדור קטן שתמיד בכיס.', art: 'a tiny football keychain' },
      { name: 'הגביע מהלגו', bio: 'נבנה בחמש שעות, נשבר בשנייה.', art: 'a trophy built from colourful toy bricks' },
      { name: 'הגביע האמיתי', bio: 'אף אחד לא יודע מי הביא אותו לכאן.', art: 'a gleaming golden football trophy with a glowing aura' },
    ],
  },
];

// ---------------------------------------------------------------- build
let seed = 7001;
let fi = 0;
const used = new Set<string>();
const albums: string[] = [];
const rows: string[] = [];
const prompts: Array<{ id: string; prompt: string }> = [];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
let sort = 0;

PLAYER_ALBUMS.forEach((al, ai) => {
  albums.push(`(${q(al.slug)}, ${q(al.title)}, ${q(al.blurb)}, ${++sort}, 'players')`);
  for (let n = 1; n <= 12; n++) {
    const pos = (al.pos ?? (al.slug === 'hall' ? (['GK', 'DEF', 'MID', 'FWD'] as Pos[])[n % 4]! : ERA_POS[n - 1]!)) as Exclude<Pos, 'OBJ'>;
    const era: Era = al.era === 'mix' ? ERAS[(n + ai) % ERAS.length]! : al.era;
    let name = '';
    for (let tries = 0; tries < 300 && !name; tries++) {
      const cand = `${FIRST[(fi++ * 7) % FIRST.length]} "${NICK[pos][(seed + tries) % NICK[pos].length]}"`;
      if (!used.has(cand)) { name = cand; used.add(cand); }
    }
    const params = legendParams(seed, era);
    const rarity = RAR[n - 1]!;
    const id = `${al.slug}_${String(n).padStart(2, '0')}`;
    rows.push(`(${q(id)}, ${q(al.slug)}, ${n}, ${q(rarity)}, ${q(name)}, ${q(pos)}, ${q(era)}, ${q(BIO[pos][(n + ai * 5) % 6]!)}, ${seed}, 'player')`);
    prompts.push({ id, prompt: playerPrompt(params, era, pos, rarity, n) });
    seed += 97;
  }
});

OBJECT_ALBUMS.forEach((al) => {
  albums.push(`(${q(al.slug)}, ${q(al.title)}, ${q(al.blurb)}, ${++sort}, 'objects')`);
  al.items.forEach((it, i) => {
    const n = i + 1;
    const rarity = RAR[i]!;
    const id = `${al.slug}_${String(n).padStart(2, '0')}`;
    rows.push(`(${q(id)}, ${q(al.slug)}, ${n}, ${q(rarity)}, ${q(it.name)}, 'OBJ', 'modern', ${q(it.bio)}, ${seed}, 'object')`);
    prompts.push({ id, prompt: `${STYLE} ${it.art[0]!.toUpperCase()}${it.art.slice(1)}, centred like a collectible sticker. ${RARITY_FX[rarity]} ${NO_TEXT}` });
    seed += 97;
  });
});

writeFileSync('supabase/migrations/20261005000002_catalog_seed.sql', `-- Generated by tools/scripts/gen-catalog.mts — do not edit by hand.
-- ${rows.length} ORIGINAL cards (fictional legends and objects), ${albums.length} albums of 12.
insert into public.albums (slug, title, blurb, sort, kind) values
  ${albums.join(',\n  ')}
on conflict (slug) do update set title = excluded.title, blurb = excluded.blurb, sort = excluded.sort, kind = excluded.kind;

insert into public.collectibles (id, album, number, rarity, name_he, position, era, bio_he, art_seed, kind) values
  ${rows.join(',\n  ')}
on conflict (id) do update set rarity = excluded.rarity, name_he = excluded.name_he, position = excluded.position,
  era = excluded.era, bio_he = excluded.bio_he, art_seed = excluded.art_seed, kind = excluded.kind;
`);
writeFileSync('tools/art/prompts.json', JSON.stringify(prompts, null, 1));
console.log(`albums ${albums.length}, cards ${rows.length}`);

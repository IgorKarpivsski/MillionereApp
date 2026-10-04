// Hebrew Wikipedia pass, for Israeli football:
//   * categories "שחקני <club>" (who played where, as maintained by hewiki editors)
//   * the player infobox of every Israeli footballer (career table)
//   * 12-month pageviews on he.wikipedia (how well-known something is in Israel)
//   * a few list articles (champions, top scorers, national-team coaches)
//
//   node tools/question-gen/fetch-hewiki.mjs  →  data/hewiki/*.json
// Wikipedia text is CC BY-SA; we only extract facts and link back to the article.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'data/hewiki';
mkdirSync(OUT, { recursive: true });
const UA = 'HaAlufQuizBot/0.2 (https://github.com/IgorKarpivsski/MillionereApp; football trivia, fact extraction)';
const API = 'https://he.wikipedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = (name, data) => writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Polite client: one request at a time per host family, backs off on 429.
let gap = 120;
async function get(url, tries = 10) {
  for (let i = 1; i <= tries; i++) {
    try {
      await sleep(gap);
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after')) || 0;
        gap = Math.min(2000, gap * 2);
        await sleep(Math.max(ra * 1000, 3000 * i));
        throw new Error(`HTTP ${res.status}`);
      }
      gap = Math.max(60, gap * 0.95);
      return await res.json();
    } catch (e) {
      if (i === tries) throw e;
    }
  }
}
const have = (name) => existsSync(`${OUT}/${name}.json`);
const read = (name) => JSON.parse(readFileSync(`${OUT}/${name}.json`, 'utf8'));

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', maxlag: '5', ...params })) u.searchParams.set(k, v);
  return get(u.toString());
}

async function pool(items, n, fn) {
  let i = 0;
  const out = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// ---------------------------------------------------------------- categories
async function allCategories(prefix) {
  const out = [];
  let cont = {};
  do {
    const r = await api({ action: 'query', list: 'allcategories', acprefix: prefix, aclimit: 'max', acprop: 'size', ...cont });
    for (const c of r.query.allcategories) out.push({ title: c.category, pages: c.pages ?? c.size ?? 0 });
    cont = r.continue ?? null;
  } while (cont);
  return out;
}

async function members(cat, ns = '0') {
  const out = [];
  let cont = {};
  do {
    const r = await api({ action: 'query', list: 'categorymembers', cmtitle: `קטגוריה:${cat}`, cmnamespace: ns, cmlimit: 'max', ...cont });
    if (!r?.query) break;
    for (const m of r.query.categorymembers) out.push(m.title);
    cont = r.continue ?? null;
  } while (cont);
  return out;
}

log('categories…');
const cats = await allCategories('שחקני ');
save('categories_index', cats);
// Football-ish player categories (skip obvious other sports; the generator filters further by club).
const OTHER_SPORT = /(כדורסל|כדוריד|כדורעף|הוקי|פוטסל|כדור מים|טניס|שחמט|בייסבול|פוטבול|רוגבי|קריקט)/;
const playerCats = cats.filter((c) => c.pages > 0 && !OTHER_SPORT.test(c.title));
log(`player categories: ${playerCats.length} of ${cats.length}`);
const catMembers = have('category_members') ? read('category_members') : {};
let n = 0;
await pool(playerCats.filter((c) => !(c.title in catMembers)), 1, async (c) => {
  catMembers[c.title] = await members(c.title);
  if (++n % 50 === 0) save('category_members', catMembers);
});
save('category_members', catMembers);

const extraCats = ['כדורגלנים ישראלים', 'שחקני נבחרת ישראל בכדורגל', 'מאמני נבחרת ישראל בכדורגל', 'מאמני כדורגל ישראלים',
  'כדורגלניות ישראליות', 'מועדוני כדורגל בישראל', 'אצטדיוני כדורגל בישראל'];
const extra = {};
for (const c of extraCats) extra[c] = await members(c);
save('category_members_extra', extra);
log('extra', Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.length])));

// ---------------------------------------------------------------- infoboxes
function firstTemplate(text) {
  const start = text.indexOf('{{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; continue; }
    if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}
function infobox(text) {
  // The infobox is the first template whose name mentions a person/club box.
  let rest = text;
  for (let k = 0; k < 6; k++) {
    const t = firstTemplate(rest);
    if (!t) return null;
    if (/^\{\{\s*(אישיות|כדורגלן|ספורטאי|מועדון|קבוצת|שחקן|מאמן|אצטדיון|מתקן)/.test(t) || t.length > 600) return t;
    rest = rest.slice(rest.indexOf(t) + t.length);
  }
  return null;
}

const israeliPlayers = new Set([...extra['כדורגלנים ישראלים'], ...extra['כדורגלניות ישראליות'], ...extra['שחקני נבחרת ישראל בכדורגל']]);
for (const r of JSON.parse(readFileSync('data/wikidata/players_israeli.json', 'utf8'))) if (r.he) israeliPlayers.add(r.he);
const boxTitles = [...israeliPlayers, ...extra['מאמני נבחרת ישראל בכדורגל'], ...extra['מועדוני כדורגל בישראל'], ...extra['אצטדיוני כדורגל בישראל']];
const uniq = [...new Set(boxTitles)];
log(`infobox pages: ${uniq.length}`);
const boxes = {};
const batches = [];
for (let i = 0; i < uniq.length; i += 40) batches.push(uniq.slice(i, i + 40));
const boxesPrev = have('infoboxes') ? read('infoboxes') : null;
if (boxesPrev) Object.assign(boxes, boxesPrev);
else await pool(batches, 1, async (b) => {
  const r = await api({ action: 'query', prop: 'revisions|pageprops', rvprop: 'content', rvslots: 'main', titles: b.join('|'), redirects: '1', ppprop: 'wikibase_item' });
  for (const p of r?.query?.pages ?? []) {
    const text = p.revisions?.[0]?.slots?.main?.content;
    if (!text) continue;
    boxes[p.title] = { qid: p.pageprops?.wikibase_item ?? null, box: infobox(text), cats: [...text.matchAll(/\[\[קטגוריה:([^\]|]+)/g)].map((m) => m[1].trim()) };
  }
});
save('infoboxes', boxes);
log(`infoboxes: ${Object.keys(boxes).length}`);

// ---------------------------------------------------------------- list articles
const LIST_CANDIDATES = [
  'ליגת העל בכדורגל', 'אליפות ישראל בכדורגל', 'רשימת אלופות ישראל בכדורגל', 'גביע המדינה בכדורגל',
  'מלך השערים של ליגת העל בכדורגל', 'רשימת מלכי השערים בליגה הבכירה בכדורגל בישראל', 'מלך השערים בליגה הבכירה בישראל',
  'נבחרת ישראל בכדורגל', 'רשימת מאמני נבחרת ישראל בכדורגל', 'רשימת שחקני נבחרת ישראל בכדורגל',
  'גביע הטוטו', 'אלוף האלופים בכדורגל', 'שחקן העונה בכדורגל הישראלי', 'ליגת העל בכדורגל 2024/2025', 'ליגת העל בכדורגל 2025/2026',
];
const searches = {};
for (const q of ['מלך השערים ליגת העל', 'רשימת מלכי השערים כדורגל ישראל', 'מאמני נבחרת ישראל בכדורגל', 'רשימת אלופות ישראל בכדורגל', 'שחקן העונה כדורגל ישראל']) {
  const r = await api({ action: 'query', list: 'search', srsearch: q, srlimit: '10', srnamespace: '0' });
  searches[q] = (r?.query?.search ?? []).map((s) => s.title);
}
save('searches', searches);
const listTitles = [...new Set([...LIST_CANDIDATES, ...Object.values(searches).flat().filter((t) => /רשימ|מלך|מאמני|אלוף|ליגת העל|גביע|נבחרת ישראל/.test(t))])];
const lists = {};
for (let i = 0; i < listTitles.length; i += 20) {
  const r = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: listTitles.slice(i, i + 20).join('|'), redirects: '1' });
  for (const p of r?.query?.pages ?? []) {
    const text = p.revisions?.[0]?.slots?.main?.content;
    if (text) lists[p.title] = text;
  }
}
save('lists', lists);
log(`lists: ${Object.keys(lists).length}`);

// ---------------------------------------------------------------- pageviews
const titles = new Set(Object.keys(boxes));
for (const r of JSON.parse(readFileSync('data/wikidata/wiki_titles.json', 'utf8'))) if (r.he) titles.add(r.he);
for (const v of Object.values(catMembers)) for (const t of v) if (israeliPlayers.has(t)) titles.add(t);
const prev = existsSync(`${OUT}/pageviews.json`) ? JSON.parse(readFileSync(`${OUT}/pageviews.json`, 'utf8')) : {};
const todo = [...titles].filter((t) => !(t in prev));
log(`pageviews: ${todo.length} to fetch`);
let done = 0;
await pool(todo, 4, async (t) => {
  const art = encodeURIComponent(t.replace(/ /g, '_'));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/he.wikipedia/all-access/user/${art}/monthly/2025090100/2026083100`;
  try {
    const r = await get(url);
    prev[t] = r?.items ? r.items.reduce((s, x) => s + x.views, 0) : 0;
  } catch {
    /* skip; retried next run */
  }
  if (++done % 2000 === 0) { log(`pageviews ${done}/${todo.length}`); save('pageviews', prev); }
});
save('pageviews', prev);
log('done');

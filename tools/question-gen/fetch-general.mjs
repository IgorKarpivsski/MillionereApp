// Fetches general-knowledge facts from Wikidata (CC0) and image credits from
// Wikimedia Commons for the general trivia generator (gen_general.py).
// Runs on GitHub Actions (the dev sandbox cannot reach Wikimedia).
//
//   node tools/question-gen/fetch-general.mjs  →  data/general/*.json
//
// Every dataset is saved raw. A dataset that already exists is skipped, so a
// re-run only retries what failed. Delete a file to refresh it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'data/general';
mkdirSync(OUT, { recursive: true });

const UA = 'HaAlufTriviaBot/0.2 (https://github.com/IgorKarpivsski/MillionereApp; igorzz2626@gmail.com)';
const SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WD_API = 'https://www.wikidata.org/w/api.php';
const logPath = `${OUT}/_log.json`;
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (name) => existsSync(`${OUT}/${name}.json`);
const load = (name) => (has(name) ? JSON.parse(readFileSync(`${OUT}/${name}.json`, 'utf8')) : []);
const save = (name, rows) => writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rows));

function simplify(json) {
  return json.results.bindings.map((b) => {
    const o = {};
    for (const [k, v] of Object.entries(b)) {
      o[k] = v.type === 'uri' && v.value.startsWith('http://www.wikidata.org/entity/')
        ? v.value.slice('http://www.wikidata.org/entity/'.length)
        : v.type === 'uri' && v.value.startsWith('http://commons.wikimedia.org/wiki/Special:FilePath/')
          ? decodeURIComponent(v.value.slice('http://commons.wikimedia.org/wiki/Special:FilePath/'.length))
          : v.value;
    }
    return o;
  });
}

async function sparqlRaw(name, query, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(SPARQL, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const rows = simplify(await res.json());
      await sleep(800);
      return { rows, ms: Date.now() - t0 };
    } catch (e) {
      console.warn(`${name} attempt ${attempt} failed: ${e.message}`);
      log.push({ name, error: String(e.message).slice(0, 300), attempt, at: new Date().toISOString() });
      await sleep(4000 * attempt);
    }
  }
  return null;
}

/** Runs one query and saves it, unless it's already on disk. */
async function q(name, query) {
  if (has(name)) return load(name);
  const r = await sparqlRaw(name, query);
  if (!r) return [];
  save(name, r.rows);
  log.push({ name, rows: r.rows.length, ms: r.ms });
  console.log(`${name}: ${r.rows.length} rows (${r.ms} ms)`);
  return r.rows;
}

/** Same query over batches of ids (VALUES ?x). Saved only if every batch worked. */
async function qBatched(name, ids, size, build) {
  if (has(name)) return load(name);
  const all = [];
  let ok = true;
  for (let i = 0; i < ids.length; i += size) {
    const r = await sparqlRaw(`${name}#${i / size}`, build(ids.slice(i, i + size)));
    if (!r) { ok = false; continue; }
    all.push(...r.rows);
  }
  if (ok) save(name, all);
  log.push({ name, rows: all.length, ok });
  console.log(`${name}: ${all.length} rows${ok ? '' : ' (INCOMPLETE, not saved)'}`);
  return all;
}

const vals = (v, ids) => `VALUES ${v} { ${ids.map((i) => `wd:${i}`).join(' ')} }`;
const HEWIKI = (v) => `?hw_${v.slice(1)} schema:about ${v} ; schema:isPartOf <https://he.wikipedia.org/> .`;

async function search(term) {
  const url = `${WD_API}?${new URLSearchParams({ action: 'wbsearchentities', search: term, language: 'en', format: 'json', limit: '3' })}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const j = await res.json();
    return j.search?.[0]?.id ?? null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------
await q('countries', `
SELECT ?x ?sl ?pop ?area ?flag WHERE {
  ?x wdt:P31 wd:Q3624078 ; wikibase:sitelinks ?sl .
  FILTER NOT EXISTS { ?x wdt:P576 [] }
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P1082 ?pop }
  OPTIONAL { ?x wdt:P2046 ?area }
  OPTIONAL { ?x wdt:P41 ?flag }
}`);
const countryIds = [...new Set(load('countries').map((r) => r.x))];
for (const [name, prop] of [['country_capital', 'P36'], ['country_continent', 'P30'], ['country_currency', 'P38'],
  ['country_language', 'P37'], ['country_border', 'P47'], ['country_highest', 'P610'], ['country_driving', 'P1622'],
  ['country_anthem', 'P85']]) {
  await q(name, `SELECT ?x ?v WHERE { ${vals('?x', countryIds)} ?x p:${prop} ?st . ?st ps:${prop} ?v .
    FILTER NOT EXISTS { ?st pq:P582 [] } ?st wikibase:rank ?rank FILTER(?rank != wikibase:DeprecatedRank) }`);
}

await q('cities', `
SELECT ?x ?c ?pop ?sl ?img WHERE {
  ?x wdt:P1082 ?pop . FILTER(?pop >= 150000)
  ?x wdt:P31/wdt:P279* wd:Q515 .
  ?x wdt:P17 ?c ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P18 ?img }
}`);

for (const [name, cls, minSl, extra] of [
  ['rivers', 'Q4022', 25, 'OPTIONAL { ?x wdt:P2043 ?len } OPTIONAL { ?x wdt:P403 ?mouth }'],
  ['mountains', 'Q8502', 20, 'OPTIONAL { ?x wdt:P2044 ?elev } OPTIONAL { ?x wdt:P4552 ?range }'],
  ['lakes', 'Q23397', 25, 'OPTIONAL { ?x wdt:P2046 ?area }'],
  ['islands', 'Q23442', 30, 'OPTIONAL { ?x wdt:P2046 ?area }'],
  ['volcanoes', 'Q8072', 25, 'OPTIONAL { ?x wdt:P2044 ?elev }'],
  ['deserts', 'Q8514', 20, 'OPTIONAL { ?x wdt:P2046 ?area }'],
  ['waterfalls', 'Q34038', 20, ''],
  ['seas', 'Q165', 20, ''],
]) {
  await q(name, `
SELECT ?x ?sl ?c ?cont ?img ${extra.match(/\?\w+(?= \})/g)?.join(' ') ?? ''} WHERE {
  ?x wdt:P31 wd:${cls} ; wikibase:sitelinks ?sl . FILTER(?sl >= ${minSl})
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P17 ?c }
  OPTIONAL { ?x wdt:P30 ?cont }
  OPTIONAL { ?x wdt:P18 ?img }
  ${extra}
}`);
}

// Landmarks: well-known structures with a photo.
const LANDMARK_TYPES = ['Q12518', 'Q16560', 'Q23413', 'Q16970', 'Q2977', 'Q32815', 'Q44539', 'Q33506', 'Q12280',
  'Q4989906', 'Q179700', 'Q11303', 'Q1440300', 'Q41176', 'Q57821', 'Q839954', 'Q15243209', 'Q570116', 'Q11707',
  'Q44613', 'Q1081138', 'Q2319498', 'Q24354', 'Q483110', 'Q1107656', 'Q12570', 'Q207694', 'Q162875', 'Q19860854',
  'Q46169', 'Q1785071', 'Q131596', 'Q25550691'];
await q('landmarks', `
SELECT ?x ?t ?sl ?c ?img ?city ?arch ?inception WHERE {
  ${vals('?t', LANDMARK_TYPES)}
  ?x wdt:P31 ?t ; wikibase:sitelinks ?sl . FILTER(?sl >= 30)
  ${HEWIKI('?x')}
  ?x wdt:P18 ?img .
  OPTIONAL { ?x wdt:P17 ?c }
  OPTIONAL { ?x wdt:P131 ?city }
  OPTIONAL { ?x wdt:P84 ?arch }
  OPTIONAL { ?x wdt:P571 ?inception }
}`);
await q('unesco', `
SELECT ?x ?sl ?c ?img WHERE {
  ?x wdt:P1435 wd:Q9259 ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P17 ?c }
  OPTIONAL { ?x wdt:P18 ?img }
}`);

// ---------------------------------------------------------------------------
// Nature
// ---------------------------------------------------------------------------
let species = await q('species', `
SELECT ?x ?sl ?img WHERE {
  ?x wdt:P105 wd:Q7432 ; wikibase:sitelinks ?sl . FILTER(?sl >= 45)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P18 ?img }
}`);
if (!species.length) {
  // Fallback: walk down from the big animal classes.
  const all = [];
  for (const cls of ['Q7377', 'Q5113', 'Q10811', 'Q10908', 'Q127282', 'Q25371', 'Q1390', 'Q1358']) {
    const r = await sparqlRaw(`species_${cls}`, `
SELECT ?x ?sl ?img WHERE {
  ?x wdt:P171* wd:${cls} ; wdt:P105 wd:Q7432 ; wikibase:sitelinks ?sl . FILTER(?sl >= 35)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P18 ?img }
}`);
    if (r) all.push(...r.rows);
  }
  if (all.length) { save('species', all); species = all; }
}
const ANIMAL_CLASSES = ['Q7377', 'Q5113', 'Q10811', 'Q10908', 'Q127282', 'Q25371', 'Q1390', 'Q1358', 'Q25326',
  'Q25364', 'Q25329', 'Q25336', 'Q756', 'Q1364', 'Q11004', 'Q506', 'Q764'];
await qBatched('species_class', [...new Set(species.map((r) => r.x))], 200, (ids) => `
SELECT ?x ?cls WHERE { ${vals('?x', ids)} ${vals('?cls', ANIMAL_CLASSES)} ?x wdt:P171+ ?cls . }`);
await qBatched('species_status', [...new Set(species.map((r) => r.x))], 250, (ids) => `
SELECT ?x ?status WHERE { ${vals('?x', ids)} ?x wdt:P141 ?status . }`);

await q('dog_breeds', `
SELECT ?x ?sl ?img ?origin WHERE {
  ?x wdt:P31 wd:Q39367 ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P18 ?img }
  OPTIONAL { ?x wdt:P495 ?origin }
}`);

// ---------------------------------------------------------------------------
// Science & space
// ---------------------------------------------------------------------------
await q('elements', `
SELECT ?x ?num ?sym ?disc ?date ?sl WHERE {
  ?x wdt:P31 wd:Q11344 ; wdt:P1086 ?num ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P246 ?sym }
  OPTIONAL { ?x wdt:P61 ?disc }
  OPTIONAL { ?x wdt:P575 ?date }
}`);
const PLANETS = ['Q308', 'Q313', 'Q2', 'Q111', 'Q319', 'Q193', 'Q324', 'Q332', 'Q339'];
await q('moons', `
SELECT ?x ?p ?sl ?img WHERE {
  ${vals('?p', PLANETS)}
  ?x wdt:P397 ?p ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P18 ?img }
}`);
await q('planets', `
SELECT ?x ?sl ?img ?mass ?radius WHERE {
  ${vals('?x', PLANETS)}
  ?x wikibase:sitelinks ?sl .
  OPTIONAL { ?x wdt:P18 ?img }
  OPTIONAL { ?x wdt:P2067 ?mass }
  OPTIONAL { ?x wdt:P2120 ?radius }
}`);
await q('constellations', `
SELECT ?x ?sl ?img WHERE {
  ?x wdt:P31 wd:Q8928 ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P18 ?img }
}`);
await q('stars', `
SELECT ?x ?sl ?con WHERE {
  ?x wdt:P59 ?con ; wikibase:sitelinks ?sl . FILTER(?sl >= 25)
  ?con wdt:P31 wd:Q8928 .
  ${HEWIKI('?x')}
}`);
await q('astronauts', `
SELECT ?x ?sl ?c WHERE {
  ?x wdt:P106 wd:Q11631 ; wikibase:sitelinks ?sl . FILTER(?sl >= 15)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P27 ?c }
}`);
await q('nobel', `
SELECT ?x ?award ?date ?sl WHERE {
  VALUES ?award { wd:Q38104 wd:Q44585 wd:Q80061 wd:Q37922 wd:Q35637 wd:Q47170 }
  ?x p:P166 ?st . ?st ps:P166 ?award . ?x wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?st pq:P585 ?date }
}`);

// ---------------------------------------------------------------------------
// People, works, history. "Who made X" relations between two Hebrew articles.
// ---------------------------------------------------------------------------
for (const [name, prop, minSl] of [
  ['rel_author', 'P50', 8], ['rel_director', 'P57', 12], ['rel_creator', 'P170', 8], ['rel_composer', 'P86', 8],
  ['rel_architect', 'P84', 10], ['rel_discoverer', 'P61', 10], ['rel_founder', 'P112', 12], ['rel_performer', 'P175', 12],
  ['rel_origin', 'P495', 12], ['rel_hq', 'P159', 20], ['rel_location', 'P276', 15], ['rel_lyricist', 'P676', 6],
]) {
  await q(name, `
SELECT ?x ?v ?t ?sl ?date ?img WHERE {
  ?x wdt:${prop} ?v ; wikibase:sitelinks ?sl . FILTER(?sl >= ${minSl})
  ${HEWIKI('?x')}
  ${HEWIKI('?v')}
  OPTIONAL { ?x wdt:P31 ?t }
  OPTIONAL { ?x wdt:P577 ?date }
  OPTIONAL { ?x wdt:P18 ?img }
}`);
}

const people = await q('people', `
SELECT ?x ?sl WHERE {
  ?x wikibase:sitelinks ?sl . FILTER(?sl >= 70)
  ?x wdt:P31 wd:Q5 .
  ${HEWIKI('?x')}
}`);
const israelis = await q('people_israel', `
SELECT ?x ?sl WHERE {
  ?x wdt:P27 wd:Q801 ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?sl . FILTER(?sl >= 12)
  ${HEWIKI('?x')}
}`);
const personIds = [...new Set([...people, ...israelis].map((r) => r.x))];
await qBatched('people_facts', personIds, 200, (ids) => `
SELECT ?x ?gender ?birth ?death ?img WHERE { ${vals('?x', ids)}
  OPTIONAL { ?x wdt:P21 ?gender } OPTIONAL { ?x wdt:P569 ?birth } OPTIONAL { ?x wdt:P570 ?death } OPTIONAL { ?x wdt:P18 ?img } }`);
await qBatched('people_occupation', personIds, 200, (ids) => `
SELECT ?x ?v WHERE { ${vals('?x', ids)} ?x wdt:P106 ?v . }`);
await qBatched('people_country', personIds, 200, (ids) => `
SELECT ?x ?v WHERE { ${vals('?x', ids)} ?x wdt:P27 ?v . }`);
await qBatched('people_birthplace', personIds, 200, (ids) => `
SELECT ?x ?v WHERE { ${vals('?x', ids)} ?x wdt:P19 ?v . }`);

await q('wars', `
SELECT ?x ?sl ?start ?end WHERE {
  ?x wdt:P31/wdt:P279* wd:Q198 ; wikibase:sitelinks ?sl . FILTER(?sl >= 30)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P580 ?start }
  OPTIONAL { ?x wdt:P582 ?end }
}`);
await q('events', `
SELECT ?x ?t ?sl ?date ?start WHERE {
  VALUES ?t { wd:Q178561 wd:Q10931 wd:Q3839081 wd:Q7944 wd:Q2223653 wd:Q1190554 wd:Q131569 wd:Q8016240 }
  ?x wdt:P31 ?t ; wikibase:sitelinks ?sl . FILTER(?sl >= 35)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P585 ?date }
  OPTIONAL { ?x wdt:P580 ?start }
}`);

// Office holders (searched by English name; the resolved ids are logged).
const OFFICES = {
  us_president: 'President of the United States', il_pm: 'Prime Minister of Israel', il_president: 'President of Israel',
  uk_pm: 'Prime Minister of the United Kingdom', fr_president: 'President of France', de_chancellor: 'Chancellor of Germany',
  un_sg: 'Secretary-General of the United Nations', pope: 'pope', ru_president: 'President of Russia',
  il_chief_of_staff: 'Chief of the General Staff (Israel)',
};
if (!has('offices')) {
  const resolved = {};
  for (const [k, term] of Object.entries(OFFICES)) { resolved[k] = await search(term); await sleep(300); }
  const ids = Object.values(resolved).filter(Boolean);
  const r = await sparqlRaw('offices', `
SELECT ?office ?x ?start ?end ?ord WHERE {
  ${vals('?office', ids)}
  ?x p:P39 ?st . ?st ps:P39 ?office .
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P1545 ?ord }
  ${HEWIKI('?x')}
}`);
  if (r) { save('offices', r.rows); save('_offices_resolved', resolved); }
}

// ---------------------------------------------------------------------------
// Sport, food, music, Israel
// ---------------------------------------------------------------------------
await q('olympics', `
SELECT ?x ?t ?sl ?city ?c ?date WHERE {
  VALUES ?t { wd:Q159821 wd:Q82414 }
  ?x wdt:P31 ?t ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P276 ?city }
  OPTIONAL { ?x wdt:P17 ?c }
  OPTIONAL { ?x wdt:P585 ?date }
}`);
await q('sports', `
SELECT ?x ?sl ?players ?img WHERE {
  ?x wdt:P31/wdt:P279* wd:Q349 ; wikibase:sitelinks ?sl . FILTER(?sl >= 25)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P1873 ?players }
  OPTIONAL { ?x wdt:P18 ?img }
}`);
await q('dishes', `
SELECT ?x ?sl ?origin ?img WHERE {
  ?x wdt:P31/wdt:P279* wd:Q746549 ; wikibase:sitelinks ?sl . FILTER(?sl >= 12)
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P495 ?origin }
  OPTIONAL { ?x wdt:P18 ?img }
}`);
await q('foods', `
SELECT ?x ?sl ?cls ?img WHERE {
  VALUES ?cls { wd:Q1364 wd:Q11004 wd:Q10943 wd:Q1421401 wd:Q2095 wd:Q8495 wd:Q40050 }
  { ?x wdt:P279+ ?cls } UNION { ?x wdt:P31 ?cls }
  ?x wikibase:sitelinks ?sl . FILTER(?sl >= 25)
  ${HEWIKI('?x')}
  ?x wdt:P18 ?img .
}`);
await q('instruments', `
SELECT ?x ?sl ?img ?hs WHERE {
  { ?x wdt:P279+ wd:Q34379 } UNION { ?x wdt:P31 wd:Q34379 }
  ?x wikibase:sitelinks ?sl . FILTER(?sl >= 20)
  ${HEWIKI('?x')}
  ?x wdt:P18 ?img .
  OPTIONAL { ?x wdt:P1762 ?hs }
}`);
await q('eurovision', `
SELECT ?x ?sl ?date ?city ?c ?winner WHERE {
  ?x wdt:P31 wd:Q276 ; wikibase:sitelinks ?sl .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P585 ?date }
  OPTIONAL { ?x wdt:P276 ?city }
  OPTIONAL { ?x wdt:P17 ?c }
  OPTIONAL { ?x wdt:P1346 ?winner }
}`);
await q('israel_places', `
SELECT ?x ?sl ?pop ?img ?inception ?t WHERE {
  ?x wdt:P17 wd:Q801 ; wdt:P31 ?t ; wikibase:sitelinks ?sl . FILTER(?sl >= 6)
  ?t wdt:P279* wd:Q486972 .
  ${HEWIKI('?x')}
  OPTIONAL { ?x wdt:P1082 ?pop }
  OPTIONAL { ?x wdt:P18 ?img }
  OPTIONAL { ?x wdt:P571 ?inception }
}`);
await q('israel_district', `
SELECT ?x ?d WHERE {
  ?x wdt:P17 wd:Q801 ; wdt:P131+ ?d .
  ?d wdt:P31 ?dt . ?dt wdt:P279* wd:Q193556 .
  ${HEWIKI('?x')}
}`);
await q('israel_sites', `
SELECT ?x ?t ?sl ?img WHERE {
  ?x wdt:P17 wd:Q801 ; wdt:P31 ?t ; wikibase:sitelinks ?sl . FILTER(?sl >= 10)
  ${HEWIKI('?x')}
  ?x wdt:P18 ?img .
  FILTER NOT EXISTS { ?t wdt:P279* wd:Q486972 }
  FILTER NOT EXISTS { ?x wdt:P31 wd:Q5 }
}`);

// ---------------------------------------------------------------------------
// Names: Hebrew Wikipedia title + English title + sitelinks for every id used.
// ---------------------------------------------------------------------------
const ids = new Set();
const isQ = (s) => typeof s === 'string' && /^Q\d+$/.test(s);
for (const f of (await import('node:fs')).readdirSync(OUT)) {
  if (!f.endsWith('.json') || f.startsWith('_') || f === 'titles.json' || f === 'commons.json') continue;
  for (const r of load(f.slice(0, -5))) for (const v of Object.values(r)) if (isQ(v)) ids.add(v);
}
const known = new Set(load('titles').map((r) => r.e));
const missing = [...ids].filter((i) => !known.has(i));
console.log(`titles: ${ids.size} ids, ${missing.length} missing`);
if (missing.length) {
  const rows = load('titles');
  for (let i = 0; i < missing.length; i += 300) {
    const r = await sparqlRaw(`titles#${i}`, `
SELECT ?e ?he ?en ?sl WHERE { ${vals('?e', missing.slice(i, i + 300))}
  OPTIONAL { ?h schema:about ?e ; schema:isPartOf <https://he.wikipedia.org/> ; schema:name ?he }
  OPTIONAL { ?w schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en }
  OPTIONAL { ?e wikibase:sitelinks ?sl } }`);
    if (r) rows.push(...r.rows);
  }
  save('titles', rows);
}

// ---------------------------------------------------------------------------
// Commons: thumbnail URL + author + license for every image.
// ---------------------------------------------------------------------------
const files = new Set();
for (const f of (await import('node:fs')).readdirSync(OUT)) {
  if (!f.endsWith('.json') || f.startsWith('_') || f === 'titles.json' || f === 'commons.json') continue;
  for (const r of load(f.slice(0, -5))) for (const k of ['img', 'flag']) if (r[k]) files.add(r[k]);
}
const commons = Object.fromEntries(load('commons').map((r) => [r.file, r]));
const todo = [...files].filter((f) => !commons[f]);
console.log(`commons: ${files.size} files, ${todo.length} to fetch`);
const strip = (h) => (h ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
for (let i = 0; i < todo.length; i += 50) {
  const batch = todo.slice(i, i + 50);
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '500', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Restrictions',
    titles: batch.map((f) => `File:${f}`).join('|'),
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${COMMONS}?${params}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const norm = Object.fromEntries((j.query?.normalized ?? []).map((n) => [n.to, n.from]));
      for (const p of j.query?.pages ?? []) {
        const from = (norm[p.title] ?? p.title).replace(/^File:/, '');
        const ii = p.imageinfo?.[0];
        if (!ii) { commons[from] = { file: from, missing: true }; continue; }
        const m = ii.extmetadata ?? {};
        commons[from] = {
          file: from, thumb: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, mime: ii.mime, page: ii.descriptionurl,
          artist: strip(m.Artist?.value).slice(0, 120), license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value ?? null,
          restrictions: strip(m.Restrictions?.value),
        };
      }
      break;
    } catch (e) {
      console.warn(`commons batch ${i} attempt ${attempt}: ${e.message}`);
      await sleep(3000 * attempt);
    }
  }
  await sleep(300);
  if (i % 1000 === 0) save('commons', Object.values(commons));
}
save('commons', Object.values(commons));
writeFileSync(logPath, JSON.stringify(log, null, 1));
console.log('done');

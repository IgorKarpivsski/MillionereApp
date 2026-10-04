// Second Wikidata pass: Hebrew/English Wikipedia article titles (vetted names
// and source links) for every entity the generator uses, plus the history of
// the Israeli top flight before 1999.
//
//   node tools/question-gen/fetch-wikidata-2.mjs  →  data/wikidata/*.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'data/wikidata';
mkdirSync(OUT, { recursive: true });
const UA = 'FootballMillionaireQuestionBot/0.1 (https://github.com/IgorKarpivsski/MillionereApp)';
const SPARQL = 'https://query.wikidata.org/sparql';
const API = 'https://www.wikidata.org/w/api.php';
const log = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => JSON.parse(readFileSync(`${OUT}/${f}.json`, 'utf8'));

function simplify(json) {
  return json.results.bindings.map((b) => {
    const o = {};
    for (const [k, v] of Object.entries(b)) {
      o[k] = v.type === 'uri' && v.value.startsWith('http://www.wikidata.org/entity/')
        ? v.value.slice('http://www.wikidata.org/entity/'.length) : v.value;
    }
    return o;
  });
}

async function sparql(name, query) {
  for (let attempt = 1; attempt <= 4; attempt++) {
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
      log.push({ name, rows: rows.length, ms: Date.now() - t0, attempt });
      console.log(`${name}: ${rows.length}`);
      await sleep(1200);
      return rows;
    } catch (e) {
      log.push({ name, error: String(e.message).slice(0, 300), attempt });
      console.warn(`${name} attempt ${attempt}: ${e.message}`);
      await sleep(5000 * attempt);
    }
  }
  return [];
}

async function batched(name, ids, size, build) {
  const all = [];
  for (let i = 0; i < ids.length; i += size) all.push(...(await sparql(`${name}.${i / size}`, build(ids.slice(i, i + size)))));
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(all));
  console.log(`${name}: ${all.length} total`);
  return all;
}

const values = (v, ids) => `VALUES ${v} { ${ids.map((i) => `wd:${i}`).join(' ')} }`;

// Every entity id the generator may name in a question or an answer.
const ids = new Set();
for (const r of read('players_famous')) ids.add(r.p);
for (const r of read('players_israeli')) ids.add(r.p);
for (const r of read('clubs_top')) ids.add(r.c);
for (const r of read('clubs_israeli')) ids.add(r.c);
for (const r of read('player_teams')) ids.add(r.team);
for (const r of read('seasons')) { if (r.winner) ids.add(r.winner); if (r.host) ids.add(r.host); ids.add(r.season); }
for (const r of read('national_teams')) ids.add(r.t);
for (const r of read('awards')) ids.add(r.p);
for (const r of read('player_facts')) { if (r.bpCountry) ids.add(r.bpCountry); }
for (const r of read('club_facts')) { for (const k of ['venue', 'city', 'venueCity', 'country']) if (r[k]) ids.add(r[k]); }
const list = [...ids].filter((x) => /^Q\d+$/.test(x));
console.log(`entities: ${list.length}`);

await batched('wiki_titles', list, 250, (chunk) => `
SELECT ?e ?he ?en ?sl WHERE {
  ${values('?e', chunk)}
  OPTIONAL { ?a schema:about ?e ; schema:isPartOf <https://he.wikipedia.org/> ; schema:name ?he }
  OPTIONAL { ?b schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en }
  OPTIONAL { ?e wikibase:sitelinks ?sl }
}`);

// Occupations, to drop people famous for something other than football.
const people = [...new Set([...read('players_famous'), ...read('players_israeli')].map((r) => r.p))];
await batched('player_occupations', people, 300, (chunk) => `
SELECT ?p ?occ WHERE { ${values('?p', chunk)} ?p wdt:P106 ?occ . }`);

// Israeli top flight before Ligat HaAl (1999): Liga Leumit and Liga Alef.
const found = {};
for (const term of ['Liga Leumit', 'Liga Alef', 'Israeli Super Cup']) {
  const url = `${API}?${new URLSearchParams({ action: 'wbsearchentities', search: term, language: 'en', format: 'json', limit: '5' })}`;
  const j = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
  found[term] = (j.search ?? []).map((s) => ({ id: s.id, label: s.label, description: s.description }));
  await sleep(500);
}
writeFileSync(`${OUT}/_resolved_2.json`, JSON.stringify(found, null, 2));
const israelComps = Object.values(found).map((r) => r.find((x) => /israel/i.test(x.description ?? ''))?.id).filter(Boolean);

const rows = await sparql('seasons_israel_history', `
SELECT ?comp ?season ?seasonEn ?seasonHe ?start ?end ?pit ?winner ?winnerEn ?winnerHe ?rank WHERE {
  ${values('?comp', israelComps)}
  ?season wdt:P3450 ?comp .
  OPTIONAL { ?season rdfs:label ?seasonEn FILTER(LANG(?seasonEn) = "en") }
  OPTIONAL { ?season rdfs:label ?seasonHe FILTER(LANG(?seasonHe) = "he") }
  OPTIONAL { ?season wdt:P580 ?start } OPTIONAL { ?season wdt:P582 ?end } OPTIONAL { ?season wdt:P585 ?pit }
  OPTIONAL { ?season p:P1346 ?ws . ?ws ps:P1346 ?winner . OPTIONAL { ?ws pq:P1352 ?rank }
             OPTIONAL { ?winner rdfs:label ?winnerEn FILTER(LANG(?winnerEn) = "en") }
             OPTIONAL { ?winner rdfs:label ?winnerHe FILTER(LANG(?winnerHe) = "he") } }
}`);
writeFileSync(`${OUT}/seasons_israel_history.json`, JSON.stringify(rows));

const winners = [...new Set(rows.map((r) => r.winner).filter(Boolean))].filter((x) => !ids.has(x));
if (winners.length) await batched('wiki_titles_extra', winners, 250, (chunk) => `
SELECT ?e ?he ?en ?sl WHERE {
  ${values('?e', chunk)}
  OPTIONAL { ?a schema:about ?e ; schema:isPartOf <https://he.wikipedia.org/> ; schema:name ?he }
  OPTIONAL { ?b schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en }
  OPTIONAL { ?e wikibase:sitelinks ?sl }
}`);

writeFileSync(`${OUT}/_log_2.json`, JSON.stringify({ fetchedAt: new Date().toISOString(), log }, null, 2));
console.log('done');

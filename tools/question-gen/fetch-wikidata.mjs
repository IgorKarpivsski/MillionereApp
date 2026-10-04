// Fetches football facts from Wikidata (CC0) for the question generator.
// Runs on GitHub Actions (the dev sandbox cannot reach Wikidata).
//
//   node tools/question-gen/fetch-wikidata.mjs  →  data/wikidata/*.json
//
// Every query result is saved raw (simplified bindings) so generation is
// reproducible offline and every fact keeps its Wikidata item id as source.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'data/wikidata';
mkdirSync(OUT, { recursive: true });

const UA = 'FootballMillionaireQuestionBot/0.1 (https://github.com/IgorKarpivsski/MillionereApp)';
const SPARQL = 'https://query.wikidata.org/sparql';
const API = 'https://www.wikidata.org/w/api.php';
const log = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function simplify(json) {
  return json.results.bindings.map((b) => {
    const o = {};
    for (const [k, v] of Object.entries(b)) {
      o[k] = v.type === 'uri' && v.value.startsWith('http://www.wikidata.org/entity/')
        ? v.value.slice('http://www.wikidata.org/entity/'.length)
        : v.value;
    }
    return o;
  });
}

async function sparql(name, query, { save = true } = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(SPARQL, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ query }),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const rows = simplify(await res.json());
      log.push({ name, rows: rows.length, ms: Date.now() - t0, attempt });
      if (save) writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rows));
      console.log(`${name}: ${rows.length} rows (${Date.now() - t0} ms)`);
      await sleep(1500);
      return rows;
    } catch (e) {
      console.warn(`${name} attempt ${attempt} failed: ${e.message}`);
      log.push({ name, error: String(e.message).slice(0, 300), attempt });
      await sleep(5000 * attempt);
    }
  }
  return [];
}

async function search(term) {
  const url = `${API}?${new URLSearchParams({ action: 'wbsearchentities', search: term, language: 'en', format: 'json', limit: '5' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const j = await res.json();
  return (j.search ?? []).map((s) => ({ id: s.id, label: s.label, description: s.description }));
}

const HE = (v, label) => `OPTIONAL { ${v} rdfs:label ${label} FILTER(LANG(${label}) = "he") }`;
const EN = (v, label) => `OPTIONAL { ${v} rdfs:label ${label} FILTER(LANG(${label}) = "en") }`;
const values = (v, ids) => `VALUES ${v} { ${ids.map((i) => `wd:${i}`).join(' ')} }`;

async function batched(name, ids, size, build) {
  const all = [];
  for (let i = 0; i < ids.length; i += size) {
    const rows = await sparql(`${name}.${i / size}`, build(ids.slice(i, i + size)), { save: false });
    all.push(...rows);
  }
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(all));
  console.log(`${name}: ${all.length} rows total`);
  return all;
}

// ---------------------------------------------------------------------------
// 1. Competitions. Known ids + ids resolved by search (recorded for review).
// ---------------------------------------------------------------------------
const KNOWN = {
  world_cup: 'Q19317',
  euro: 'Q260858',
  champions_league: 'Q18756',
  europa_league: 'Q18760',
  premier_league: 'Q9448',
  la_liga: 'Q324867',
  serie_a: 'Q15804',
  bundesliga: 'Q82595',
  ligue_1: 'Q13394',
};
const SEARCH = {
  israeli_premier_league: 'Israeli Premier League',
  israel_state_cup: 'Israel State Cup',
  israel_toto_cup: 'Toto Cup',
  england_first_division: 'Football League First Division',
  copa_america: 'Copa América',
  africa_cup: 'Africa Cup of Nations',
  club_world_cup: 'FIFA Club World Cup',
  fa_cup: 'FA Cup',
  copa_del_rey: 'Copa del Rey',
  israel_national_team: 'Israel national football team',
};

const resolved = { known: KNOWN, searched: {} };
for (const [key, term] of Object.entries(SEARCH)) {
  try {
    resolved.searched[key] = await search(term);
  } catch (e) {
    resolved.searched[key] = { error: e.message };
  }
  await sleep(500);
}
writeFileSync(`${OUT}/_resolved.json`, JSON.stringify(resolved, null, 2));
const pick = (key) => resolved.searched[key]?.[0]?.id;
const comps = { ...KNOWN };
for (const key of Object.keys(SEARCH)) if (pick(key) && key !== 'israel_national_team') comps[key] = pick(key);

await sparql('competition_labels', `
SELECT ?comp ?en ?he ?desc WHERE {
  ${values('?comp', Object.values(comps))}
  ${EN('?comp', '?en')} ${HE('?comp', '?he')}
  OPTIONAL { ?comp schema:description ?desc FILTER(LANG(?desc) = "en") }
}`);

await sparql('seasons', `
SELECT ?comp ?season ?seasonEn ?seasonHe ?start ?end ?pit ?winner ?winnerEn ?winnerHe ?rank ?host ?hostEn ?hostHe WHERE {
  ${values('?comp', Object.values(comps))}
  ?season wdt:P3450 ?comp .
  ${EN('?season', '?seasonEn')} ${HE('?season', '?seasonHe')}
  OPTIONAL { ?season wdt:P580 ?start }
  OPTIONAL { ?season wdt:P582 ?end }
  OPTIONAL { ?season wdt:P585 ?pit }
  OPTIONAL {
    ?season p:P1346 ?ws . ?ws ps:P1346 ?winner .
    OPTIONAL { ?ws pq:P1352 ?rank }
    ${EN('?winner', '?winnerEn')} ${HE('?winner', '?winnerHe')}
  }
  OPTIONAL { ?season wdt:P17 ?host . ${EN('?host', '?hostEn')} ${HE('?host', '?hostHe')} }
}`);

// Ballon d'Or and other individual awards.
await sparql('awards', `
SELECT ?award ?awardEn ?awardHe ?p ?pEn ?pHe ?date ?rank WHERE {
  VALUES ?award { wd:Q166177 wd:Q180478 wd:Q1043985 }
  ?p p:P166 ?st . ?st ps:P166 ?award .
  OPTIONAL { ?st pq:P585 ?date }
  OPTIONAL { ?st pq:P1352 ?rank }
  ${EN('?award', '?awardEn')} ${HE('?award', '?awardHe')}
  ${EN('?p', '?pEn')} ${HE('?p', '?pHe')}
}`);

// ---------------------------------------------------------------------------
// 2. Players: well-known footballers with a Hebrew label, plus Israeli players.
// ---------------------------------------------------------------------------
const famous = await sparql('players_famous', `
SELECT ?p ?sl ?he ?en WHERE {
  ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?sl .
  FILTER(?sl >= 20)
  ?p rdfs:label ?he FILTER(LANG(?he) = "he")
  ${EN('?p', '?en')}
}`);

const israeli = await sparql('players_israeli', `
SELECT ?p ?sl ?he ?en WHERE {
  ?p wdt:P106 wd:Q937857 ; wdt:P27 wd:Q801 ; wikibase:sitelinks ?sl .
  ?p rdfs:label ?he FILTER(LANG(?he) = "he")
  ${EN('?p', '?en')}
}`);

const playerIds = [...new Set([...famous, ...israeli].map((r) => r.p))];
console.log(`players: ${playerIds.length}`);

await batched('player_facts', playerIds, 150, (ids) => `
SELECT ?p ?birth ?bp ?bpHe ?bpCountry ?bpCountryHe ?pos ?posHe ?height WHERE {
  ${values('?p', ids)}
  OPTIONAL { ?p wdt:P569 ?birth }
  OPTIONAL { ?p wdt:P19 ?bp . ${HE('?bp', '?bpHe')}
             OPTIONAL { ?bp wdt:P17 ?bpCountry . ${HE('?bpCountry', '?bpCountryHe')} } }
  OPTIONAL { ?p wdt:P413 ?pos . ${HE('?pos', '?posHe')} }
}`);

await batched('player_teams', playerIds, 120, (ids) => `
SELECT ?p ?team ?teamHe ?teamEn ?start ?end ?isNational ?referenced WHERE {
  ${values('?p', ids)}
  ?p p:P54 ?st . ?st ps:P54 ?team .
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  BIND(EXISTS { ?team wdt:P31/wdt:P279* wd:Q6979593 } AS ?isNational)
  BIND(EXISTS { ?st prov:wasDerivedFrom ?r } AS ?referenced)
  ${HE('?team', '?teamHe')} ${EN('?team', '?teamEn')}
}`);

// ---------------------------------------------------------------------------
// 3. Clubs: Israeli clubs + every club that appears above.
// ---------------------------------------------------------------------------
const israeliClubs = await sparql('clubs_israeli', `
SELECT ?c ?he ?en ?sl WHERE {
  ?c wdt:P31/wdt:P279* wd:Q476028 ; wdt:P17 wd:Q801 ; wikibase:sitelinks ?sl .
  ?c rdfs:label ?he FILTER(LANG(?he) = "he")
  ${EN('?c', '?en')}
}`);

const clubsTop = await sparql('clubs_top', `
SELECT ?c ?he ?en ?sl WHERE {
  ?c wdt:P31 wd:Q476028 ; wikibase:sitelinks ?sl .
  FILTER(?sl >= 25)
  ?c rdfs:label ?he FILTER(LANG(?he) = "he")
  ${EN('?c', '?en')}
}`);

const clubIds = [...new Set([...israeliClubs, ...clubsTop].map((r) => r.c))];
await batched('club_facts', clubIds, 150, (ids) => `
SELECT ?c ?inception ?country ?countryHe ?city ?cityHe ?venue ?venueHe ?venueEn ?venueCity ?venueCityHe ?venueOpened ?league ?leagueHe ?nick WHERE {
  ${values('?c', ids)}
  OPTIONAL { ?c wdt:P571 ?inception }
  OPTIONAL { ?c wdt:P17 ?country . ${HE('?country', '?countryHe')} }
  OPTIONAL { ?c wdt:P159 ?city . ${HE('?city', '?cityHe')} }
  OPTIONAL { ?c wdt:P115 ?venue . ${HE('?venue', '?venueHe')} ${EN('?venue', '?venueEn')}
             OPTIONAL { ?venue wdt:P131 ?venueCity . ${HE('?venueCity', '?venueCityHe')} }
             OPTIONAL { ?venue wdt:P1619 ?venueOpened } }
  OPTIONAL { ?c wdt:P118 ?league . ${HE('?league', '?leagueHe')} }
  OPTIONAL { ?c wdt:P1449 ?nick FILTER(LANG(?nick) = "he") }
}`);

// ---------------------------------------------------------------------------
// 4. Countries / national teams: Hebrew names for openfootball team names.
// ---------------------------------------------------------------------------
await sparql('countries', `
SELECT ?c ?en ?he ?alt WHERE {
  { ?c wdt:P31 wd:Q3624078 } UNION { ?c wdt:P31 wd:Q3024240 } UNION { ?c wdt:P31 wd:Q6256 }
  UNION { VALUES ?c { wd:Q21 wd:Q22 wd:Q25 wd:Q26 wd:Q15180 wd:Q713750 wd:Q36704 wd:Q83286 wd:Q33946 } }
  ?c rdfs:label ?en FILTER(LANG(?en) = "en")
  ?c rdfs:label ?he FILTER(LANG(?he) = "he")
  OPTIONAL { ?c skos:altLabel ?alt FILTER(LANG(?alt) = "en") }
}`);

await sparql('national_teams', `
SELECT ?t ?en ?he ?country ?countryHe ?sl WHERE {
  ?t wdt:P31 wd:Q6979593 ; wikibase:sitelinks ?sl .
  FILTER(?sl >= 15)
  ?t rdfs:label ?en FILTER(LANG(?en) = "en")
  ${HE('?t', '?he')}
  OPTIONAL { ?t wdt:P17 ?country . ${HE('?country', '?countryHe')} }
}`);

writeFileSync(`${OUT}/_log.json`, JSON.stringify({ fetchedAt: new Date().toISOString(), log }, null, 2));
console.log('done');

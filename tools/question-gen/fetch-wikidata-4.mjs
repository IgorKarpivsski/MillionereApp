// Fourth Wikidata pass: map positions for picture ("where on the map") questions.
// Coordinates of each club's home city (P159 HQ, else the stadium's town), and
// of the stadium itself.
//
//   node tools/question-gen/fetch-wikidata-4.mjs  →  data/wikidata/club_coords.json
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'data/wikidata';
const UA = 'FootballMillionaireQuestionBot/0.1 (https://github.com/IgorKarpivsski/MillionereApp)';
const SPARQL = 'https://query.wikidata.org/sparql';
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
    try {
      const res = await fetch(SPARQL, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = simplify(await res.json());
      console.log(`${name}: ${rows.length}`);
      await sleep(1000);
      return rows;
    } catch (e) {
      console.warn(`${name} attempt ${attempt}: ${e.message}`);
      await sleep(5000 * attempt);
    }
  }
  throw new Error(`${name} failed`);
}

async function batched(name, ids, size, build) {
  const all = [];
  for (let i = 0; i < ids.length; i += size) all.push(...(await sparql(`${name}.${i / size}`, build(ids.slice(i, i + size)))));
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(all));
  return all;
}
const values = (v, ids) => `VALUES ${v} { ${ids.map((i) => `wd:${i}`).join(' ')} }`;

const clubs = [...new Set([...read('clubs_israeli'), ...read('clubs_top')].map((r) => r.c))];
await batched('club_coords', clubs, 150, (ids) => `
SELECT ?c ?city ?cityCoord ?venue ?venueCoord WHERE {
  ${values('?c', ids)}
  OPTIONAL { ?c wdt:P159 ?city . ?city wdt:P625 ?cityCoord }
  OPTIONAL { ?c wdt:P115 ?venue . ?venue wdt:P625 ?venueCoord }
}`);

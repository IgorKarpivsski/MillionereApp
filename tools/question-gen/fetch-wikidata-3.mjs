// Third Wikidata pass: which statements cite a source, plus gender.
// The generator keeps a single-source fact only when Wikidata records a
// reference for that exact statement.
//
//   node tools/question-gen/fetch-wikidata-3.mjs  →  data/wikidata/refs_*.json
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
// A reference counts only if it is more than "imported from Wikimedia project".
const REF = (st) => `EXISTS { ${st} prov:wasDerivedFrom ?ref . ?ref ?rp ?rv . FILTER(?rp NOT IN (pr:P143, pr:P4656, pr:P813)) }`;

const people = [...new Set([...read('players_famous'), ...read('players_israeli')].map((r) => r.p))];
await batched('refs_people', people, 200, (chunk) => `
SELECT ?p ?prop ?value ?referenced WHERE {
  ${values('?p', chunk)}
  VALUES (?prop ?pp ?ps) { ("birth" p:P569 ps:P569) ("position" p:P413 ps:P413) ("gender" p:P21 ps:P21) }
  ?p ?pp ?st . ?st ?ps ?value .
  BIND(${REF('?st')} AS ?referenced)
}`);

const clubs = [...new Set([...read('clubs_top'), ...read('clubs_israeli')].map((r) => r.c))];
await batched('refs_clubs', clubs, 200, (chunk) => `
SELECT ?c ?prop ?value ?referenced WHERE {
  ${values('?c', chunk)}
  VALUES (?prop ?pp ?ps) { ("inception" p:P571 ps:P571) ("venue" p:P115 ps:P115) ("hq" p:P159 ps:P159) }
  ?c ?pp ?st . ?st ?ps ?value .
  BIND(${REF('?st')} AS ?referenced)
}`);
console.log('done');

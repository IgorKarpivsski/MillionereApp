// Resolves the photo for every kids photo question (tools/question-gen/kids/*.img.txt).
// For each Hebrew Wikipedia title: its FREE lead image (pilicense=free), then the
// Commons author + license + a 500px thumbnail. Non-free or local files are dropped.
// Also renders contact sheets (data/kids-images/sheets/*.jpg) so every photo can be
// checked by eye against its answer before the questions go live.
//
//   node tools/question-gen/fetch-kids-images.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'HaAlufTrivia/1.0 (https://github.com/IgorKarpivsski/MillionereApp; bot@users.noreply.github.com)';
const HEWIKI = 'https://he.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const SRC = 'tools/question-gen/kids';
const OUT = 'data/kids-images';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(join(OUT, 'thumbs'), { recursive: true });

async function api(base, params) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${base}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`${base} attempt ${attempt}: ${e.message}`);
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`failed: ${base}`);
}

const titles = new Set();
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.img.txt'))) {
  for (const line of readFileSync(join(SRC, f), 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.split('|').map((p) => p.trim());
    if (parts[6]) titles.add(parts[6]);
  }
}
console.log(`titles: ${titles.size}`);

const prevPath = join(OUT, 'images.json');
const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : {};
const result = {};
const todo = [...titles].filter((t) => !prev[t] || prev[t].missing);
for (const t of titles) if (prev[t] && !prev[t].missing) result[t] = prev[t];

// 1) title -> free lead image file
const fileOf = {};
for (let i = 0; i < todo.length; i += 40) {
  const batch = todo.slice(i, i + 40);
  const j = await api(HEWIKI, { action: 'query', prop: 'pageimages', piprop: 'name', pilicense: 'free', redirects: '1', titles: batch.join('|') });
  const back = {};
  for (const n of j.query?.normalized ?? []) back[n.to] = n.from;
  for (const r of j.query?.redirects ?? []) back[r.to] = back[r.from] ?? r.from;
  for (const p of j.query?.pages ?? []) {
    const from = back[p.title] ?? p.title;
    if (p.missing) result[from] = { missing: 'no such article' };
    else if (!p.pageimage) result[from] = { missing: 'no free lead image' };
    else fileOf[from] = p.pageimage;
  }
  await sleep(300);
}

// 2) file -> Commons metadata (local/non-free files come back missing and are dropped)
const strip = (h) => (h ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const files = [...new Set(Object.values(fileOf))];
const meta = {};
for (let i = 0; i < files.length; i += 40) {
  const batch = files.slice(i, i + 40);
  const j = await api(COMMONS, {
    action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '500',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Restrictions', titles: batch.map((f) => `File:${f}`).join('|'),
  });
  const back = {};
  for (const n of j.query?.normalized ?? []) back[n.to] = n.from;
  for (const p of j.query?.pages ?? []) {
    const from = (back[p.title] ?? p.title).replace(/^File:/, '');
    const ii = p.imageinfo?.[0];
    if (!ii || p.missing) { meta[from] = null; continue; }
    const m = ii.extmetadata ?? {};
    meta[from] = {
      file: from, thumb: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, mime: ii.mime, page: ii.descriptionurl,
      artist: strip(m.Artist?.value).slice(0, 120), license: strip(m.LicenseShortName?.value), restrictions: strip(m.Restrictions?.value),
    };
  }
  await sleep(300);
}
for (const [t, f] of Object.entries(fileOf)) {
  // spaces vs underscores differ between the two APIs
  const m = meta[f] ?? meta[f.replace(/_/g, ' ')];
  result[t] = m ? m : { missing: 'not on Commons', file: f };
}

// 3) thumbnails for the contact sheets
const ok = Object.entries(result).filter(([, v]) => !v.missing).sort(([a], [b]) => a.localeCompare(b, 'he'));
let n = 0;
for (const [t, v] of ok) {
  v.idx = ++n;
  const path = join(OUT, 'thumbs', `${n}.jpg`);
  try {
    const res = await fetch(v.thumb.replace(/\/\d+px-/, '/240px-'), { headers: { 'User-Agent': UA } });
    if (res.ok) writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    else console.warn(`thumb ${t}: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`thumb ${t}: ${e.message}`);
  }
  await sleep(150);
}
writeFileSync(prevPath, JSON.stringify(result, null, 1));
const missing = Object.entries(result).filter(([, v]) => v.missing);
console.log(`ok ${ok.length}, missing ${missing.length}`);
for (const [t, v] of missing) console.log(`  - ${t}: ${v.missing}`);

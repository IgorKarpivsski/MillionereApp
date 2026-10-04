// Uploads content/questions/questions.jsonl to Supabase through the
// import_questions RPC (protected by a one-time token, see migration 0003).
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... IMPORT_TOKEN=... node tools/question-gen/import.mjs
import { readFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const token = process.env.IMPORT_TOKEN;
if (!url || !key || !token) throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and IMPORT_TOKEN are required');

const rows = readFileSync('content/questions/questions.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const BATCH = 250;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${url}/rest/v1/rpc/import_questions`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_rows: batch }),
    });
    if (res.ok) {
      done += await res.json();
      break;
    }
    const msg = await res.text();
    if (attempt >= 3 || res.status < 500) throw new Error(`batch ${i}: HTTP ${res.status} ${msg.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  console.log(`imported ${done}/${rows.length}`);
}
console.log(`done: ${done} questions`);

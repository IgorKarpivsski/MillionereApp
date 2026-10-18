// Prints the Google Play tracks of an app as JSON (no secrets in the output).
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const key = JSON.parse(readFileSync(process.env.KEY_FILE, 'utf8'));
const pkg = process.env.PKG;
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 600,
  });
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  return (await r.json()).access_token;
}

const t = await token();
const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const call = async (method, path) => {
  const r = await fetch(api + path, { method, headers: { authorization: `Bearer ${t}` } });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};

const out = { checked_at: new Date().toISOString(), package: pkg };
const edit = await call('POST', '/edits');
if (edit.status !== 200) {
  out.error = edit.body;
} else {
  const id = edit.body.id;
  out.tracks = (await call('GET', `/edits/${id}/tracks`)).body?.tracks ?? [];
  out.testers = {};
  for (const tr of ['alpha', 'beta', 'internal']) {
    const r = await call('GET', `/edits/${id}/testers/${tr}`);
    if (r.status === 200) out.testers[tr] = r.body;
  }
  out.details = (await call('GET', `/edits/${id}/details`)).body;
  await call('DELETE', `/edits/${id}`);
}
console.log(JSON.stringify(out, null, 2));

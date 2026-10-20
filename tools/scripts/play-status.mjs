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
// Monetization: what's set up in Play Console (subscriptions with base plans/offers, one-time products).
const subs = await call('GET', '/subscriptions');
out.subscriptions = subs.status === 200 ? (subs.body?.subscriptions ?? []).map((s) => ({
  productId: s.productId,
  basePlans: (s.basePlans ?? []).map((b) => ({ id: b.basePlanId, state: b.state, period: b.autoRenewingBasePlanType?.billingPeriodDuration,
    grace: b.autoRenewingBasePlanType?.gracePeriodDuration, accountHold: b.autoRenewingBasePlanType?.accountHoldDuration,
    resubscribe: b.autoRenewingBasePlanType?.resubscribeState, prices: (b.regionalConfigs ?? []).filter((r) => r.regionCode === 'IL').map((r) => r.price) })),
  listings: (s.listings ?? []).map((l) => ({ lang: l.languageCode, title: l.title, benefits: l.benefits })),
})) : { status: subs.status, body: subs.body };
if (subs.status === 200) {
  for (const s of out.subscriptions) {
    const offers = await call('GET', `/subscriptions/${s.productId}/basePlans/-/offers`);
    s.offers = offers.status === 200 ? (offers.body?.subscriptionOffers ?? []).map((o) => ({ id: o.offerId, basePlan: o.basePlanId, state: o.state,
      phases: (o.phases ?? []).map((p) => ({ duration: p.duration, recurrences: p.recurrenceCount, free: !!p.regionalConfigs?.[0]?.free })) })) : offers.status;
  }
}
const inapp = await call('GET', '/inappproducts');
out.inapp = inapp.status === 200 ? (inapp.body?.inappproduct ?? []).map((p) => ({ sku: p.sku, status: p.status, price: p.defaultPrice })) : { status: inapp.status, body: inapp.body };
const otp = await call('GET', '/oneTimeProducts');
out.oneTimeProducts = otp.status === 200 ? (otp.body?.oneTimeProducts ?? []).map((p) => ({ id: p.productId, options: (p.purchaseOptions ?? []).map((o) => o.state) })) : { status: otp.status, body: otp.body };
console.log(JSON.stringify(out, null, 2));

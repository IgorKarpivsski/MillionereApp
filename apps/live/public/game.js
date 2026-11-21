/* טריוויה - האלוף · שידור חי
   The game runs here in the page; the local server only relays TikTok LIVE chat (/events). */
'use strict';

const WORLDS = [
  { slug: 'geography', name: 'גאוגרפיה', color: '#22B07D' },
  { slug: 'history', name: 'היסטוריה', color: '#C9853A' },
  { slug: 'science', name: 'מדע', color: '#3E8EF7' },
  { slug: 'nature', name: 'טבע וחיות', color: '#6CBF3B' },
  { slug: 'space', name: 'חלל', color: '#7B5CF0' },
  { slug: 'culture', name: 'אמנות וספרות', color: '#E2557B' },
  { slug: 'screen', name: 'קולנוע', color: '#F2694B' },
  { slug: 'music', name: 'מוזיקה', color: '#D84FD0' },
  { slug: 'people', name: 'אישים', color: '#F0A020' },
  { slug: 'israel', name: 'ישראל', color: '#2F7DE1' },
  { slug: 'sport', name: 'ספורט', color: '#14A3B8' },
  { slug: 'food', name: 'אוכל', color: '#EE8A2E' },
  { slug: 'football', name: 'כדורגל', color: '#1E9E4A' },
  { slug: 'hanukkah', name: 'חנוכה', color: '#2F6FE0' },
];
const MIX = { slug: 'mix', name: 'משחק מהיר', color: '#FFB000' };
const worldBySlug = Object.fromEntries([...WORLDS, MIX].map((w) => [w.slug, w]));
const DIFF = { e: 'קל', m: 'בינוני', h: 'קשה' };
const HOST_ID = '__host__';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('haaluf.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('haaluf.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---------------- state ----------------
let BANK = [];
let seen = new Set(store.get('seen', []));
const players = new Map(Object.entries(store.get('players', {}))); // id -> {id,name,avatar,score,streak,correct}
const S = {
  phase: 'lobby', // lobby | question | reveal | roundEnd
  round: store.get('round', 0),
  roundWorld: MIX,
  qIndex: 0,
  questions: [],
  q: null, order: [], // order[i] = index in q.a shown at position i
  startAt: 0, duration: 20000, remaining: 0,
  answers: new Map(), // userId -> {pos, at}
  roundScores: new Map(),
  paused: false, pausedAt: 0,
  timer: null, nextTimer: null, countdown: null,
  worldCycle: [],
};
const opts = {
  world: store.get('opt.world', 'mix'), diff: store.get('opt.diff', 'mix'),
  time: store.get('opt.time', 20), count: store.get('opt.count', 10),
  auto: store.get('opt.auto', true), rotate: store.get('opt.rotate', true),
  sound: store.get('opt.sound', true), music: store.get('opt.music', false),
  host: store.get('opt.host', true), demo: false,
};

// ---------------- stage scaling ----------------
function fit() {
  const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  $('stage').style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

// ---------------- sound ----------------
const SND = {};
for (const n of ['answer_correct', 'answer_wrong', 'answer_lock', 'tick', 'level_up', 'rare_reveal', 'coins', 'whistle', 'combo_3']) {
  SND[n] = new Audio(`assets/sounds/${n}.wav`);
}
const music = new Audio('assets/theme.m4a');
music.loop = true; music.volume = 0.18;
let lastLock = 0;
function play(n, vol = 0.7) {
  if (!opts.sound) return;
  const a = SND[n]?.cloneNode();
  if (!a) return;
  a.volume = vol;
  a.play().catch(() => {});
}
function syncMusic() { if (opts.music) music.play().catch(() => {}); else music.pause(); }

// ---------------- helpers ----------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function avatarHtml(p, cls = 'ava') {
  if (p?.avatar) return `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer" data-c="${cls}" data-l="${esc((p.name || '?').trim()[0] || '?')}" onerror="avaFail(this)">`;
  return `<div class="${cls}">${esc((p?.name || '?').trim()[0] || '?')}</div>`;
}
window.avaFail = (img) => {
  const d = document.createElement('div');
  d.className = img.classList.contains('face') ? 'face' : img.dataset.c || 'ava';
  d.textContent = img.dataset.l || '?';
  img.replaceWith(d);
};
function normalize(t) {
  return String(t || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '').trim();
}
const KEY = { '1': 0, '2': 1, '3': 2, '4': 3, 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3, '١': 0, '٢': 1, '٣': 2, '٤': 3 };
function parseAnswer(text) {
  const n = normalize(text);
  if (!n) return -1;
  if (n.length === 1 && n in KEY) return KEY[n];
  // "3!!!" / "תשובה 3" / "3 ✅" – a single digit 1-4 in a short message
  const digits = n.match(/[1-4]/g);
  if (digits && digits.length === 1 && n.length <= 8) return KEY[digits[0]];
  // the exact answer text
  if (S.q) for (let pos = 0; pos < 4; pos++) if (normalize(S.q.a[S.order[pos]]) === n) return pos;
  return -1;
}
function saveBoard() {
  store.set('players', Object.fromEntries(players));
  store.set('round', S.round);
}

// ---------------- question bank ----------------
async function loadBank() {
  const r = await fetch('data/questions.json');
  BANK = await r.json();
  $('lobbyCount').textContent = `${BANK.length.toLocaleString('he-IL')} שאלות מחכות לכם!`;
}
function pickQuestions(world, n) {
  const ok = (q) => (world.slug === 'mix' || q.w === world.slug) && (opts.diff === 'mix' || q.d === opts.diff) && !(world.slug === 'mix' && q.w === 'hanukkah');
  let pool = BANK.filter((q) => ok(q) && !seen.has(q.i));
  if (pool.length < n) { // everything was asked: start over for this filter
    for (const q of BANK) if (ok(q)) seen.delete(q.i);
    pool = BANK.filter(ok);
  }
  // easy first, a bit harder later; text questions mostly, some with pictures
  const picked = shuffle(pool).slice(0, n);
  picked.sort((a, b) => (a.d === b.d ? 0 : a.d === 'e' ? -1 : 1));
  return picked;
}
function nextWorld() {
  if (opts.world !== 'mix') return worldBySlug[opts.world];
  if (!opts.rotate) return MIX;
  if (!S.worldCycle.length) S.worldCycle = shuffle(WORLDS.filter((w) => w.slug !== 'hanukkah').map((w) => w.slug));
  return worldBySlug[S.worldCycle.pop()];
}

// ---------------- screens ----------------
function show(id) {
  for (const s of ['lobby', 'game', 'roundEnd']) $(s).classList.toggle('hidden', s !== id);
  $('hint').classList.toggle('hidden', id === 'roundEnd');
}
function setWorld(w) {
  document.documentElement.style.setProperty('--world', w.color);
  $('worldImg').src = `assets/worlds/${w.slug}.webp`;
  $('worldName').textContent = w.name;
}

// ---------------- round flow ----------------
function startRound() {
  if (!BANK.length) return;
  clearTimers();
  S.round += 1;
  S.roundWorld = nextWorld();
  S.questions = pickQuestions(S.roundWorld, opts.count);
  S.qIndex = 0;
  S.roundScores = new Map();
  $('roundNo').textContent = S.round;
  saveBoard();
  play('whistle', 0.5);
  askQuestion();
}

function preload(url, ms = 3000) {
  return new Promise((ok) => {
    const im = new Image();
    const t = setTimeout(() => ok(false), ms);
    im.onload = () => { clearTimeout(t); ok(im.naturalWidth > 0); };
    im.onerror = () => { clearTimeout(t); ok(false); };
    im.referrerPolicy = 'no-referrer';
    im.src = url;
  });
}
let asking = 0;
async function askQuestion() {
  clearTimers();
  const token = ++asking;
  S.phase = 'loading';
  let q = S.questions[S.qIndex];
  if (!q) return endRound();
  // a picture question whose picture won't load is swapped for a text question
  if (q.m && !(await preload(q.m))) {
    if (token !== asking) return;
    seen.add(q.i);
    const alt = pickQuestions(S.roundWorld, 30).find((x) => !x.m && !S.questions.includes(x));
    if (alt) { S.questions[S.qIndex] = alt; q = alt; }
  }
  if (token !== asking) return;
  // warm up the next picture
  const nx = S.questions[S.qIndex + 1];
  if (nx?.m) preload(nx.m, 8000);
  S.q = q;
  seen.add(q.i);
  store.set('seen', [...seen].slice(-6000));
  S.order = shuffle([0, 1, 2, 3]);
  S.answers = new Map();
  S.phase = 'question';
  S.duration = opts.time * 1000;
  S.startAt = performance.now();
  S.paused = false;
  $('pausedBadge').classList.add('hidden');

  const w = worldBySlug[q.w] || MIX;
  setWorld(S.roundWorld.slug === 'mix' ? w : S.roundWorld);
  $('qNo').textContent = S.qIndex + 1;
  $('qTotal').textContent = S.questions.length;
  $('qMeta').textContent = `${w.name} · ${DIFF[q.d] || ''}`;
  $('qText').textContent = q.q;
  fitText($('qText'), q.q.length);

  const wrap = $('qImageWrap');
  if (q.m) {
    $('qImage').src = q.m;
    $('qImage').onerror = () => wrap.classList.add('hidden');
    wrap.classList.remove('hidden');
  } else wrap.classList.add('hidden');
  $('game').classList.toggle('noimg', !q.m);

  const box = $('answers');
  box.classList.remove('revealed');
  box.innerHTML = S.order.map((ai, pos) => `
    <div class="ans" data-pos="${pos}">
      <div class="bar"></div>
      <div class="num">${pos + 1}</div>
      <div class="txt">${esc(q.a[ai])}</div>
      <div class="pct"></div>
    </div>`).join('');
  box.querySelectorAll('.ans').forEach((el) => el.addEventListener('click', () => hostAnswer(Number(el.dataset.pos))));
  for (const el of box.querySelectorAll('.txt')) fitText(el, el.textContent.length, true);

  $('reveal').classList.add('hidden');
  $('answering').classList.remove('hidden');
  $('faces').innerHTML = '';
  $('answerCount').textContent = '0';
  $('hint').innerHTML = `כתבו בצ'אט <em>1</em> <em>2</em> <em>3</em> <em>4</em> כדי לענות`;
  show('game');
  S.timer = setInterval(tick, 200);
  tick();
  if (opts.demo) demoWave();
}

function fitText(el, len, answer = false) {
  const big = !S.q?.m; // no picture: more room, bigger text
  if (answer) el.style.fontSize = big ? (len > 40 ? '34px' : '44px') : (len > 34 ? '28px' : len > 22 ? '32px' : '38px');
  else el.style.fontSize = big ? (len > 110 ? '44px' : len > 75 ? '50px' : '58px') : (len > 110 ? '38px' : len > 75 ? '44px' : '50px');
}

let lastTickSec = -1;
function tick() {
  if (S.phase !== 'question' || S.paused) return;
  const left = Math.max(0, S.duration - (performance.now() - S.startAt));
  S.remaining = left;
  const sec = Math.ceil(left / 1000);
  $('timerFill').style.width = `${(left / S.duration) * 100}%`;
  $('timerNum').textContent = sec;
  $('stage').querySelector('.timer').classList.toggle('low', sec <= 5);
  if (sec !== lastTickSec && sec <= 5 && sec > 0) play('tick', 0.45);
  lastTickSec = sec;
  if (left <= 0) reveal();
}

function onAnswer(user, pos) {
  if (S.phase !== 'question' || S.paused || pos < 0 || pos > 3) return;
  if (S.answers.has(user.id)) return; // first answer counts
  S.answers.set(user.id, { pos, at: performance.now() - S.startAt });
  const p = players.get(user.id) || { id: user.id, name: user.name, avatar: user.avatar, score: 0, streak: 0, correct: 0 };
  p.name = user.name || p.name; if (user.avatar) p.avatar = user.avatar;
  players.set(user.id, p);
  $('answerCount').textContent = S.answers.size;
  const faces = $('faces');
  if (faces.children.length < 14) faces.insertAdjacentHTML('afterbegin', avatarHtml(p, 'face').replace('<img ', '<img class="face" '));
  const now = performance.now();
  if (now - lastLock > 250) { play('answer_lock', 0.35); lastLock = now; }
}

function hostAnswer(pos) {
  if (!opts.host || S.phase !== 'question') return;
  if (S.answers.has(HOST_ID)) return;
  onAnswer({ id: HOST_ID, name: '🎤 ' + (store.get('hostName', '') || 'המארח'), avatar: 'assets/sloth_head.webp' }, pos);
  document.querySelector(`.ans[data-pos="${pos}"]`)?.classList.add('host');
}

function reveal() {
  if (S.phase !== 'question') return;
  clearTimers();
  S.phase = 'reveal';
  const q = S.q;
  const rightPos = S.order.indexOf(0); // answers[0] is the correct one
  const counts = [0, 0, 0, 0];
  for (const a of S.answers.values()) counts[a.pos]++;
  const total = S.answers.size;

  const box = $('answers');
  box.classList.add('revealed');
  box.querySelectorAll('.ans').forEach((el, pos) => {
    el.classList.add(pos === rightPos ? 'right' : 'wrong');
    const pct = total ? Math.round((counts[pos] / total) * 100) : 0;
    el.querySelector('.bar').style.width = `${pct}%`;
    el.querySelector('.pct').textContent = total ? `${pct}%` : '';
    if (pos === rightPos) el.querySelector('.num').textContent = '✓';
  });

  // scoring: 100 for a right answer + up to 100 for speed + a streak bonus
  const winners = [];
  for (const [id, a] of S.answers) {
    const p = players.get(id);
    if (!p) continue;
    if (a.pos === rightPos) {
      const speed = Math.round(100 * Math.max(0, 1 - a.at / S.duration));
      p.streak += 1;
      const bonus = p.streak >= 3 ? 50 : 0;
      const pts = 100 + speed + bonus;
      p.score += pts; p.correct += 1;
      S.roundScores.set(id, (S.roundScores.get(id) || 0) + pts);
      winners.push({ p, at: a.at, pts });
    } else p.streak = 0;
  }
  // players who did not answer lose their streak
  for (const p of players.values()) if (!S.answers.has(p.id)) p.streak = 0;
  winners.sort((a, b) => a.at - b.at);

  const right = winners.length;
  let line;
  if (!total) line = 'אף אחד לא ענה הפעם… כתבו 1, 2, 3 או 4!';
  else if (!right) line = 'אוי! אף אחד לא צדק 😮';
  else if (right === total) line = `כולם צדקו! 🔥 ${right} מתוך ${total}`;
  else line = `${right} מתוך ${total} צדקו!`;
  $('revealLine').textContent = line;
  $('explain').textContent = q.e && !q.e.startsWith('התשובה הנכונה') ? q.e : `התשובה הנכונה: ${q.a[0]}`;
  $('fastest').innerHTML = winners.slice(0, 3).map((w, i) =>
    `<div class="fast">${avatarHtml(w.p)}<span>${['🥇', '🥈', '🥉'][i]} ${esc(w.p.name)}</span><b>+${w.pts}</b></div>`).join('');
  $('reveal').classList.remove('hidden');
  $('answering').classList.add('hidden');
  $('hint').textContent = S.qIndex + 1 < S.questions.length ? 'השאלה הבאה מגיעה…' : 'עוד רגע – התוצאות של הסבב!';
  play(right ? 'answer_correct' : 'answer_wrong', 0.6);
  if (winners.some((w) => w.p.streak === 3)) setTimeout(() => play('combo_3', 0.5), 500);

  renderBoard(new Set(winners.map((w) => w.p.id)));
  saveBoard();
  if (opts.auto) S.nextTimer = setTimeout(nextQuestion, 7500);
}

function nextQuestion() {
  if (S.phase === 'loading') return;
  clearTimers();
  if (S.phase === 'question') return reveal();
  if (S.phase === 'roundEnd' || S.phase === 'lobby') return startRound();
  S.qIndex += 1;
  if (S.qIndex >= S.questions.length) endRound(); else askQuestion();
}

function endRound() {
  clearTimers();
  S.phase = 'roundEnd';
  const top = [...S.roundScores.entries()].map(([id, sc]) => ({ p: players.get(id), sc })).filter((x) => x.p).sort((a, b) => b.sc - a.sc);
  const pod = [top[1], top[0], top[2]];
  $('podium').innerHTML = pod.map((x, i) => {
    if (!x) return '<div class="pod"></div>';
    const place = [2, 1, 3][i];
    return `<div class="pod p${place}">${place === 1 ? '<div class="crown">👑</div>' : ''}${avatarHtml(x.p)}
      <div class="nm">${esc(x.p.name)}</div><div class="pts">${x.sc} נק'</div><div class="block">${place}</div></div>`;
  }).join('');
  $('reList').innerHTML = top.length
    ? top.slice(3, 8).map((x, i) => `<div class="row-p"><span class="rk">${i + 4}</span>${avatarHtml(x.p)}<span class="nm">${esc(x.p.name)}</span><span class="sc">${x.sc}</span></div>`).join('')
    : '<div class="board-empty" style="text-align:center;font-size:36px">הסבב הבא שלכם – כתבו 1–4 בצ\'אט!</div>';
  show('roundEnd');
  play('level_up', 0.6);
  saveBoard();
  renderBoard();
  if (opts.auto) {
    let s = 15;
    const upd = () => { $('reNext').textContent = `סבב חדש מתחיל בעוד ${s} שניות…`; };
    upd();
    S.countdown = setInterval(() => { s -= 1; upd(); if (s <= 0) { clearInterval(S.countdown); startRound(); } }, 1000);
  } else $('reNext').textContent = 'הסבב הבא מתחיל עוד רגע…';
}

function clearTimers() {
  clearInterval(S.timer); clearTimeout(S.nextTimer); clearInterval(S.countdown);
  S.timer = S.nextTimer = S.countdown = null;
  clearTimeout(demoT);
}

function togglePause() {
  if (S.phase === 'question') {
    if (!S.paused) { S.paused = true; S.pausedAt = performance.now(); }
    else { S.paused = false; S.startAt += performance.now() - S.pausedAt; }
  } else if (S.phase === 'reveal' || S.phase === 'roundEnd') {
    S.paused = !S.paused;
    if (S.paused) { clearTimeout(S.nextTimer); clearInterval(S.countdown); }
    else if (opts.auto) S.nextTimer = setTimeout(nextQuestion, 3000);
  }
  $('pausedBadge').classList.toggle('hidden', !S.paused);
}

// ---------------- leaderboard ----------------
function renderBoard(bumped = new Set()) {
  const list = [...players.values()].filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  $('board').innerHTML = list.length
    ? list.map((p, i) => `<li class="row-p ${bumped.has(p.id) ? 'bump' : ''}"><span class="rk">${i === 0 ? '👑' : i + 1}</span>${avatarHtml(p)}
        <span class="nm">${esc(p.name)}</span>${p.streak >= 3 ? `<span class="st">🔥${p.streak}</span>` : ''}<span class="sc">${p.score.toLocaleString('he-IL')}</span></li>`).join('')
    : '<li class="board-empty">עוד אין נקודות – מי יהיה הראשון?</li>';
  setTimeout(() => document.querySelectorAll('.row-p.bump').forEach((e) => e.classList.remove('bump')), 1500);
}

// ---------------- toasts (gifts / follows) ----------------
const recentToasts = new Map();
function toast(html, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.innerHTML = html;
  $('toasts').appendChild(t);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => t.remove(), 4300);
}

// ---------------- TikTok events ----------------
function setLive(state, msg, user) {
  const on = state === 'live';
  $('livePill').classList.toggle('on', on || opts.demo);
  $('liveText').textContent = opts.demo ? 'מצב בדיקה' : on ? 'LIVE' : state === 'connecting' ? 'מתחבר…' : 'לא מחובר';
  const line = $('statusLine');
  line.className = 'status ' + (on ? 'ok' : state === 'error' || state === 'ended' ? 'err' : state === 'idle' ? '' : 'wait');
  line.textContent = on ? `מחובר ללייב של @${user} ✔ הצ'אט נקלט` :
    state === 'connecting' ? `מתחבר ל־@${user}…` :
    state === 'retry' ? msg : state === 'error' ? msg : state === 'ended' ? 'הלייב הסתיים' : 'לא מחובר לטיקטוק';
  $('connectBtn').textContent = on || state === 'connecting' || state === 'retry' ? 'נתק' : 'התחבר';
}

function connectEvents() {
  const es = new EventSource('/events');
  es.onmessage = (ev) => {
    let e; try { e = JSON.parse(ev.data); } catch { return; }
    if (e.type === 'status') setLive(e.state, e.msg, e.user);
    else if (e.type === 'chat') onAnswer({ id: 'tt:' + (e.id || e.name), name: e.name, avatar: e.avatar }, parseAnswer(e.text));
    else if (e.type === 'gift') {
      const k = e.id + e.gift;
      if (Date.now() - (recentToasts.get(k) || 0) < 3000) return;
      recentToasts.set(k, Date.now());
      toast(`${avatarHtml(e)}<span>תודה ${esc(e.name)} על ה${esc(e.gift)}${e.count > 1 ? ' ×' + e.count : ''}! 💛</span>`);
      play('coins', 0.5);
    } else if (e.type === 'follow') {
      toast(`${avatarHtml(e)}<span>${esc(e.name)} עוקב/ת עכשיו! 🎉</span>`, 'follow');
    }
  };
  es.onerror = () => { $('statusLine').textContent = 'אין קשר לשרת המקומי – החלון השחור נסגר?'; $('statusLine').className = 'status err'; };
}

// ---------------- demo viewers ----------------
const DEMO = ['נועה', 'איתי', 'מאיה', 'יונתן', 'תמר', 'אורי', 'שירה', 'עידו', 'הילה', 'רועי', 'ליה', 'דניאל', 'אביגיל', 'עומר'];
let demoT = null;
function demoWave() {
  const n = 4 + Math.floor(Math.random() * 9);
  const rightPos = S.order.indexOf(0);
  shuffle([...DEMO]).slice(0, n).forEach((name) => {
    const delay = 1200 + Math.random() * (S.duration - 3000);
    setTimeout(() => {
      if (!opts.demo || S.phase !== 'question') return;
      const pos = Math.random() < 0.62 ? rightPos : Math.floor(Math.random() * 4);
      const text = Math.random() < 0.75 ? String(pos + 1) : ['א', 'ב', 'ג', 'ד'][pos];
      onAnswer({ id: 'demo:' + name, name, avatar: '' }, parseAnswer(text));
    }, delay);
  });
  if (Math.random() < 0.25) demoT = setTimeout(() => opts.demo && toast(`<span>תודה ${shuffle([...DEMO])[0]} על הורד! 💛</span>`), 4000);
}

// ---------------- panel ----------------
function bindPanel() {
  const sel = $('optWorld');
  sel.innerHTML = `<option value="mix">הכל (מעורב)</option>` + WORLDS.map((w) => `<option value="${w.slug}">${w.name}</option>`).join('');
  sel.value = opts.world;
  $('optDiff').value = opts.diff;
  $('optTime').value = String(opts.time);
  $('optCount').value = String(opts.count);
  for (const k of ['auto', 'rotate', 'sound', 'music', 'host']) $('opt' + k[0].toUpperCase() + k.slice(1)).checked = opts[k];

  const save = () => {
    opts.world = sel.value; opts.diff = $('optDiff').value;
    opts.time = Number($('optTime').value); opts.count = Number($('optCount').value);
    for (const k of ['auto', 'rotate', 'sound', 'music', 'host']) opts[k] = $('opt' + k[0].toUpperCase() + k.slice(1)).checked;
    opts.demo = $('optDemo').checked;
    for (const k of ['world', 'diff', 'time', 'count', 'auto', 'rotate', 'sound', 'music', 'host']) store.set('opt.' + k, opts[k]);
    syncMusic();
    setLive(opts.demo ? 'live' : lastStatus.state, lastStatus.msg, lastStatus.user);
  };
  $('panel').querySelectorAll('select, input[type=checkbox]').forEach((el) => el.addEventListener('change', save));

  $('connectBtn').onclick = async () => {
    const connected = $('connectBtn').textContent === 'נתק';
    if (connected) return fetch('/api/disconnect', { method: 'POST' });
    const u = $('ttUser').value.trim().replace(/^@/, '');
    if (!u) return $('ttUser').focus();
    store.set('hostName', u);
    await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u }) });
  };
  $('ttUser').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('connectBtn').click(); });
  $('startBtn').onclick = (e) => { e.currentTarget.blur(); startRound(); $('panel').classList.remove('open'); syncMusic(); };
  $('nextBtn').onclick = nextQuestion;
  $('pauseBtn').onclick = togglePause;
  $('resetBtn').onclick = () => {
    if (!window.confirm('לאפס את טבלת האלופים של הלייב?')) return;
    players.clear(); S.round = 0; $('roundNo').textContent = '1'; saveBoard(); renderBoard();
  };
  $('fullBtn').onclick = toggleFull;
  $('panelBtn').onclick = () => $('panel').classList.toggle('open');
  $('panelClose').onclick = () => $('panel').classList.remove('open');

  fetch('/api/settings').then((r) => r.json()).then((s) => { if (s.username && !$('ttUser').value) $('ttUser').value = s.username; }).catch(() => {});
}
let lastStatus = { state: 'idle', msg: '', user: '' };
const _setLive = setLive;
setLive = (state, msg, user) => { lastStatus = { state, msg, user }; _setLive(state, msg, user); }; // eslint-disable-line no-func-assign

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.target.matches('button')) { e.target.blur(); if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); }
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { e.preventDefault(); if (S.phase === 'lobby' || S.phase === 'roundEnd') startRound(); else nextQuestion(); }
  else if (k === 'p' || k === 'פ') togglePause();
  else if (k === 'h' || k === 'י') $('panel').classList.toggle('open');
  else if (k === 'f' || k === 'כ') toggleFull();
  else if (['1', '2', '3', '4'].includes(k)) hostAnswer(Number(k) - 1);
});

// ---------------- boot ----------------
bindPanel();
renderBoard();
$('roundNo').textContent = Math.max(1, S.round);
setWorld(MIX);
connectEvents();
loadBank().catch(() => { $('lobbyCount').textContent = 'שגיאה בטעינת השאלות'; });

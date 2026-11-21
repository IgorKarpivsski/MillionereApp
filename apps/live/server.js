// טריוויה - האלוף · שידור חי
// A tiny local server: serves the game page and relays the TikTok LIVE chat to it.
// Run: node server.js   →   open http://localhost:5177
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 5177);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const SETTINGS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'settings.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ico': 'image/x-icon',
};

// ---------- live events to the page (Server-Sent Events) ----------
const clients = new Set();
let status = { state: 'idle', user: '', msg: '' };
function send(evt) {
  const line = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of clients) res.write(line);
}
function setStatus(state, msg = '', user = status.user) {
  status = { state, user, msg };
  send({ type: 'status', ...status });
  console.log(`[טיקטוק] ${state}${user ? ' @' + user : ''}${msg ? ' – ' + msg : ''}`);
}

// ---------- TikTok LIVE ----------
let conn = null;
let lib = null;
let retryTimer = null;
let wantUser = '';

function pickUser(u = {}) {
  const id = u.uniqueId || u.displayId || u.userId || '';
  const avatar = u.avatarThumb?.urlList?.[0] || u.profilePicture?.url?.[0] || u.profilePictureUrl || '';
  return { id: String(id), name: u.nickname || String(id) || 'צופה', avatar };
}

async function connect(username) {
  username = String(username || '').trim().replace(/^@/, '');
  if (!username) return;
  wantUser = username;
  clearTimeout(retryTimer);
  await disconnect(false);
  try {
    lib = lib || (await import('tiktok-live-connector'));
  } catch (e) {
    setStatus('error', 'הספרייה של טיקטוק לא מותקנת. הפעל את start.bat מחדש.', username);
    return;
  }
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
  const c = new TikTokLiveConnection(username, { processInitialData: false, enableExtendedGiftInfo: false });
  conn = c;
  setStatus('connecting', '', username);

  c.on(WebcastEvent.CHAT, (m) => {
    const u = pickUser(m.user);
    send({ type: 'chat', ...u, text: String(m.content ?? m.comment ?? '') });
  });
  c.on(WebcastEvent.GIFT, (m) => {
    // streakable gifts arrive many times; only the last one of a streak counts
    const streak = m.gift?.type === 1 || m.giftDetails?.giftType === 1;
    if (streak && !m.repeatEnd) return;
    const u = pickUser(m.user);
    const gift = m.gift?.name || m.giftDetails?.giftName || 'מתנה';
    send({ type: 'gift', ...u, gift, count: m.repeatCount || 1 });
  });
  c.on(WebcastEvent.MEMBER, (m) => send({ type: 'join', ...pickUser(m.user) }));
  c.on(WebcastEvent.FOLLOW, (m) => send({ type: 'follow', ...pickUser(m.user) }));
  c.on(WebcastEvent.STREAM_END, () => setStatus('ended', 'השידור הסתיים'));
  c.on(ControlEvent?.DISCONNECTED || 'disconnected', () => {
    if (conn !== c) return;
    setStatus('retry', 'החיבור נפל, מתחבר מחדש…');
    retryTimer = setTimeout(() => connect(wantUser), 8000);
  });
  c.on(ControlEvent?.ERROR || 'error', (e) => console.log('[טיקטוק] שגיאה:', e?.message || e));

  try {
    await c.connect();
    if (conn === c) setStatus('live', '', username);
  } catch (e) {
    if (conn !== c) return;
    const raw = String(e?.message || e);
    const offline = /offline|not.*live|UserOffline|Room ID/i.test(raw) || e?.name === 'UserOfflineError';
    setStatus('error', offline ? `לא מצאתי לייב פעיל של @${username}. ודא שאתה כבר בשידור חי ושהשם נכון, ונסה שוב.` : `לא הצלחתי להתחבר: ${raw.slice(0, 140)}`);
    conn = null;
  }
}

async function disconnect(announce = true) {
  clearTimeout(retryTimer);
  const c = conn;
  conn = null;
  if (c) {
    try { c.removeAllListeners?.(); await c.disconnect(); } catch { /* ignore */ }
  }
  if (announce) setStatus('idle', '', '');
}

// ---------- settings (remember the username) ----------
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { return {}; }
}
function writeSettings(s) {
  try { fs.writeFileSync(SETTINGS, JSON.stringify({ ...readSettings(), ...s }, null, 2)); } catch { /* ignore */ }
}

// ---------- http ----------
function body(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'status', ...status })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (url.pathname === '/api/connect' && req.method === 'POST') {
    const { username } = await body(req);
    writeSettings({ username: String(username || '').replace(/^@/, '') });
    connect(username);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (url.pathname === '/api/disconnect' && req.method === 'POST') {
    await disconnect();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (url.pathname === '/api/settings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(readSettings()));
  }
  // static files
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  טריוויה - האלוף · שידור חי');
  console.log(`  פתח בדפדפן:  http://localhost:${PORT}`);
  console.log('  (לסגירה: סגור את החלון הזה)');
  console.log('');
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.log(`הפורט ${PORT} כבר תפוס – כנראה המשחק כבר פתוח בחלון אחר. פתח http://localhost:${PORT}`);
  else console.log(e);
});

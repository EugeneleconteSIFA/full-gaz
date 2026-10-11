// Classement entre amis de Correspondance (aucune dépendance), derrière nginx.
//   GET  /api/health                     → { ok, version }
//   POST /api/groups                     → crée un groupe { name, player, pseudo } → { code, name }
//   POST /api/groups/:code/join          → rejoint { player, pseudo } → { code, name }
//   POST /api/groups/:code/scores        → envoie le résultat du jour { player, day, path, via, elapsed }
//   GET  /api/groups/:code/board?day=    → classement du jour et de la semaine
// « player » est un identifiant aléatoire gardé sur le téléphone : il n'est jamais renvoyé aux autres joueurs.
// Le score n'est pas cru sur parole : le serveur régénère la grille avec le code de la page et recalcule le trajet.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 8160);
const SITE = process.env.SITE || path.join(HERE, '..');
const STATE = process.env.STATE_DIRECTORY || path.join(SITE, '.state');
const DB = path.join(STATE, 'groups.json');
const MISSED = 50; // écart compté pour un jour non joué dans le classement de la semaine

// --- Générateur : le bloc GEN de la page, évalué tel quel.
function loadGen() {
  const html = fs.readFileSync(path.join(SITE, 'correspondance.html'), 'utf8');
  const a = html.indexOf('/*GEN-START*/'), b = html.indexOf('/*GEN-END*/');
  return new Function(html.slice(a, b) + ';return { generate, NET_VERSION, NONE };')();
}
const G = loadGen();
const cache = new Map();
function puzzle(day) {
  if (!cache.has(day)) { cache.set(day, G.generate(day)); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return cache.get(day);
}
export { handle };
export function scoreOf(day, p, via) {
  const P = puzzle(day);
  if (!Array.isArray(p) || !Array.isArray(via) || p.length < 2 || p.length > 40 || via.length !== p.length - 1) return null;
  if (p[0] !== P.s || p[p.length - 1] !== P.t || new Set(p).size !== p.length) return null;
  let cost = 0, li = G.NONE;
  for (let k = 1; k < p.length; k++) {
    const a = P.adj[p[k - 1]]?.find((x) => x.e === via[k - 1]);
    if (!a || a.to !== p[k]) return null;
    cost += a.w + (a.li !== li ? P.board[a.mode] : 0); li = a.li;
  }
  return { cost, opt: P.opt, pct: Math.round((cost - P.opt) / P.opt * 100) };
}

// --- Stockage : un fichier JSON, réécrit de façon atomique.
let db = { groups: {} };
fs.mkdirSync(STATE, { recursive: true });
if (fs.existsSync(DB)) db = JSON.parse(fs.readFileSync(DB, 'utf8'));
function persist() { fs.writeFileSync(DB + '.tmp', JSON.stringify(db)); fs.renameSync(DB + '.tmp', DB); }

// --- Dates : le jour du puzzle est la date de Paris ; on accepte la veille et le lendemain (fuseaux, minuit).
const fmtDay = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
function dayOk(day) {
  if (!/^\d{4}-\d\d-\d\d$/.test(day)) return false;
  const now = Date.now();
  return [-864e5, 0, 864e5].some((o) => fmtDay(new Date(now + o)) === day);
}
function weekDays(day) {
  const d = new Date(day + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7, out = [];
  for (let i = 0; i <= dow; i++) out.push(new Date(d.getTime() - (dow - i) * 864e5).toISOString().slice(0, 10));
  return out;
}

// --- Validation des entrées.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans I, L, O, 0, 1
function newCode() {
  for (;;) {
    const c = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!db.groups[c]) return c;
  }
}
const cleanText = (s, max) => (typeof s === 'string' ? s.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const playerOk = (p) => typeof p === 'string' && /^[a-f0-9]{32}$/.test(p);
const hashPlayer = (p) => crypto.createHash('sha256').update(p).digest('hex').slice(0, 24);

// --- Limite de débit très simple, par adresse IP.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), h = (hits.get(ip) || []).filter((t) => now - t < 60e3);
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > 60;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 8192) { reject(new Error('trop gros')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}

function join(g, player, pseudo) {
  const id = hashPlayer(player);
  const taken = Object.entries(g.members).find(([k, m]) => k !== id && m.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (taken) return 'Ce pseudo est déjà pris dans ce groupe.';
  g.members[id] = { pseudo, joined: g.members[id]?.joined || fmtDay(new Date()) };
  return null;
}

function board(g, day) {
  const today = Object.entries(g.members)
    .filter(([id]) => g.scores[day]?.[id])
    .map(([id, m]) => ({ pseudo: m.pseudo, ...g.scores[day][id] }))
    .sort((a, b) => a.pct - b.pct || a.elapsed - b.elapsed)
    .map(({ pseudo, pct, cost, elapsed }) => ({ pseudo, pct, cost, elapsed }));
  const days = weekDays(day);
  const week = Object.entries(g.members).map(([id, m]) => {
    let total = 0, played = 0, time = 0;
    for (const d of days) {
      const s = g.scores[d]?.[id];
      if (s) { total += s.pct; played++; time += s.elapsed; } else if (d >= m.joined && d < day) total += MISSED;
    }
    return { pseudo: m.pseudo, total, played, time };
  }).filter((r) => r.played > 0).sort((a, b) => a.total - b.total || b.played - a.played || a.time - b.time)
    .map(({ pseudo, total, played }) => ({ pseudo, total, played }));
  return { name: g.name, day, members: Object.keys(g.members).length, today, week, weekFrom: days[0], missed: MISSED };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  // En local (DEV=1), le serveur sert aussi la page ; en production c'est nginx.
  if (process.env.DEV && !url.pathname.startsWith('/api/')) {
    const f = url.pathname === '/' ? 'correspondance.html' : url.pathname.slice(1);
    if (f !== 'correspondance.html') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(SITE, f)));
  }
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, version: G.NET_VERSION });
  if (limited(ip)) return send(res, 429, { error: 'Trop de requêtes, réessaie dans une minute.' });

  if (req.method === 'POST' && url.pathname === '/api/groups') {
    const b = await readBody(req), name = cleanText(b.name, 40), pseudo = cleanText(b.pseudo, 20);
    if (!name || !pseudo || !playerOk(b.player)) return send(res, 400, { error: 'Nom de groupe et pseudo requis.' });
    const code = newCode();
    db.groups[code] = { name, created: new Date().toISOString(), members: {}, scores: {} };
    join(db.groups[code], b.player, pseudo);
    persist();
    return send(res, 201, { code, name });
  }

  const m = url.pathname.match(/^\/api\/groups\/([A-Z0-9]{6})\/(join|scores|board)$/);
  if (!m) return send(res, 404, { error: 'Introuvable.' });
  const g = db.groups[m[1]];
  if (!g) return send(res, 404, { error: 'Aucun groupe avec ce code.' });

  if (req.method === 'POST' && m[2] === 'join') {
    const b = await readBody(req), pseudo = cleanText(b.pseudo, 20);
    if (!pseudo || !playerOk(b.player)) return send(res, 400, { error: 'Pseudo requis.' });
    if (Object.keys(g.members).length >= 100 && !g.members[hashPlayer(b.player)]) return send(res, 403, { error: 'Groupe complet.' });
    const err = join(g, b.player, pseudo);
    if (err) return send(res, 409, { error: err });
    persist();
    return send(res, 200, { code: m[1], name: g.name });
  }

  if (req.method === 'POST' && m[2] === 'scores') {
    const b = await readBody(req);
    if (!playerOk(b.player) || !dayOk(b.day)) return send(res, 400, { error: 'Résultat refusé.' });
    const id = hashPlayer(b.player);
    if (!g.members[id]) return send(res, 403, { error: 'Rejoins le groupe avant d’envoyer un résultat.' });
    const sc = scoreOf(b.day, b.path, b.via);
    if (!sc) return send(res, 400, { error: 'Trajet invalide.' });
    const elapsed = Math.max(0, Math.min(Math.round(+b.elapsed || 0), 24 * 3600e3));
    g.scores[b.day] = g.scores[b.day] || {};
    if (!g.scores[b.day][id]) { g.scores[b.day][id] = { pct: sc.pct, cost: sc.cost, elapsed }; persist(); }
    return send(res, 200, board(g, b.day));
  }

  if (req.method === 'GET' && m[2] === 'board') {
    const day = url.searchParams.get('day') || fmtDay(new Date());
    if (!/^\d{4}-\d\d-\d\d$/.test(day)) return send(res, 400, { error: 'Date invalide.' });
    return send(res, 200, board(g, day));
  }
  return send(res, 405, { error: 'Méthode non permise.' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  http.createServer((req, res) => handle(req, res).catch(() => send(res, 400, { error: 'Requête invalide.' })))
    .listen(PORT, '127.0.0.1', () => console.log('correspondance-api sur 127.0.0.1:' + PORT));
}

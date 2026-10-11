/* Tests de l'API du classement : serveur lancé en mémoire, état dans un dossier temporaire. */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.STATE_DIRECTORY = fs.mkdtempSync(path.join(os.tmpdir(), 'corr-'));
const { handle } = await import('../server/server.mjs');
const vm = new Function(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .split('/*GEN-START*/')[1].split('/*GEN-END*/')[0] + ';return { generate };')();

const srv = http.createServer((q, r) => handle(q, r)).listen(0);
const base = 'http://127.0.0.1:' + srv.address().port;
const call = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};
const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const P = vm.generate(day);
const A = 'a1'.repeat(16), B = 'b2'.repeat(16), C = 'c3'.repeat(16);
let n = 0;
async function check(name, fn) { await fn(); n++; console.log('ok   ' + name); }

try {
  let code;
  await check('création de groupe', async () => {
    const r = await call('POST', '/api/groups', { player: A, pseudo: 'Léa', name: 'Amphi <B>' });
    assert.strictEqual(r.status, 201); assert.match(r.json.code, /^[A-Z0-9]{6}$/); assert.strictEqual(r.json.name, 'Amphi B');
    code = r.json.code;
  });
  await check('pseudo déjà pris refusé, autre pseudo accepté', async () => {
    assert.strictEqual((await call('POST', `/api/groups/${code}/join`, { player: B, pseudo: 'léa' })).status, 409);
    assert.strictEqual((await call('POST', `/api/groups/${code}/join`, { player: B, pseudo: 'Max' })).status, 200);
  });
  await check('code inconnu', async () => {
    assert.strictEqual((await call('POST', '/api/groups/ZZZZZZ/join', { player: C, pseudo: 'X' })).status, 404);
  });
  await check('non-membre ne peut pas envoyer de score', async () => {
    assert.strictEqual((await call('POST', `/api/groups/${code}/scores`, { player: C, day, path: P.optNodes, via: P.optEdges, elapsed: 1 })).status, 403);
  });
  await check('trajet inventé refusé', async () => {
    assert.strictEqual((await call('POST', `/api/groups/${code}/scores`, { player: A, day, path: [P.s, P.t], via: [0], elapsed: 1 })).status, 400);
    assert.strictEqual((await call('POST', `/api/groups/${code}/scores`, { player: A, day: '2020-01-01', path: P.optNodes, via: P.optEdges })).status, 400);
  });
  await check('score recalculé par le serveur, premier envoi gardé', async () => {
    const r = await call('POST', `/api/groups/${code}/scores`, { player: A, day, path: P.optNodes, via: P.optEdges, elapsed: 5000 });
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.json.today[0], { pseudo: 'Léa', pct: 0, cost: P.opt, elapsed: 5000 });
    const again = await call('POST', `/api/groups/${code}/scores`, { player: A, day, path: P.optNodes, via: P.optEdges, elapsed: 1 });
    assert.strictEqual(again.json.today[0].elapsed, 5000);
  });
  await check('classement : chrono départage, identifiants jamais renvoyés', async () => {
    await call('POST', `/api/groups/${code}/scores`, { player: B, day, path: P.optNodes, via: P.optEdges, elapsed: 2000 });
    const r = await call('GET', `/api/groups/${code}/board?day=${day}`);
    assert.deepStrictEqual(r.json.today.map((x) => x.pseudo), ['Max', 'Léa']);
    assert.strictEqual(r.json.week.length, 2);
    assert(!JSON.stringify(r.json).includes(A) && !JSON.stringify(r.json).includes(B));
  });
  console.log('\nTous les tests passent (' + n + ').');
} finally {
  srv.close();
  fs.rmSync(process.env.STATE_DIRECTORY, { recursive: true, force: true });
}

/* Tests du générateur : extrait le bloc GEN de la page et l'évalue sans DOM.
   Usage : node tests/generator.test.js [nombre_de_jours]  (défaut 365) */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'correspondance.html'), 'utf8');
const a = html.indexOf('/*GEN-START*/'), b = html.indexOf('/*GEN-END*/');
assert(a >= 0 && b > a, 'bloc GEN introuvable');
const G = new Function(html.slice(a, b) +
  ';return { generate, baseNet, instantiate, analyse, EVENTS, LK, LMODE, NODE_DEF, EDGE_DEF, NET_VERSION, NONE, NL };')();

const DAYS = +process.argv[2] || 365;
const MIN_VALID = 0.95;
let failures = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('ÉCHEC ' + name + '\n     ' + e.message); }
}
function day(i) { return new Date(Date.UTC(2026, 9, 11 + i)).toISOString().slice(0, 10); }
function fingerprint(P) {
  return [P.s, P.t, G.EVENTS.indexOf(P.event), P.opt, P.optEdges.join('.'), P.ok].join('|');
}

check('données du réseau cohérentes', () => {
  const keys = new Set(G.NODE_DEF.map(d => d[0]));
  assert.strictEqual(keys.size, G.NODE_DEF.length, 'clé de lieu en double');
  const cells = new Set(G.NODE_DEF.map(d => d[2] + ',' + d[3]));
  assert.strictEqual(cells.size, G.NODE_DEF.length, 'deux lieux sur la même case');
  G.EDGE_DEF.forEach(e => {
    assert(keys.has(e[0]) && keys.has(e[1]), 'liaison vers un lieu inconnu : ' + e.join(','));
    assert(G.LK.includes(e[2]) && G.LMODE[e[2]], 'ligne inconnue : ' + e[2]);
    assert(Number.isInteger(e[3]) && e[3] > 0, 'durée invalide : ' + e.join(','));
  });
  assert.strictEqual(G.NONE, G.LK.length);
  assert.strictEqual(G.NL, G.LK.length + 1);
});

check('perturbations : chaque liaison fermée existe', () => {
  const net = G.baseNet();
  G.EVENTS.forEach(ev => {
    if (ev && ev.addAt) assert(ev.addAt.node in net.idx, 'lieu inconnu : ' + ev.addAt.node);
    (ev && ev.close || []).forEach(p => {
      const inst = G.instantiate(net, { close: [p] });
      assert(inst.edges.some(e => e.closed), 'fermeture sans effet : ' + p.join(','));
    });
  });
});

check('réseau connexe chaque jour de perturbation', () => {
  const net = G.baseNet();
  G.EVENTS.forEach(ev => {
    const inst = G.instantiate(net, ev), seen = new Set([0]), stack = [0];
    while (stack.length) inst.adj[stack.pop()].forEach(x => { if (!seen.has(x.to)) { seen.add(x.to); stack.push(x.to); } });
    assert.strictEqual(seen.size, net.nodes.length, 'réseau coupé : ' + (ev ? ev.label : 'trafic normal'));
  });
});

check('adj porte li (indice de ligne), pas line', () => {
  const inst = G.instantiate(G.baseNet(), null);
  inst.adj.forEach(list => list.forEach(x => {
    assert(Number.isInteger(x.li) && x.li >= 0 && x.li < G.NONE, 'li invalide');
    assert(!('line' in x), 'adj contient line');
  }));
});

const results = [];
check('taux de grilles valides sur ' + DAYS + ' jours >= ' + MIN_VALID * 100 + ' %', () => {
  for (let i = 0; i < DAYS; i++) results.push(G.generate(day(i)));
  const ok = results.filter(P => P.ok).length;
  console.log('     ' + ok + '/' + DAYS + ' valides, ' + new Set(results.map(P => P.s + '>' + P.t)).size + ' couples départ/arrivée');
  assert(ok / DAYS >= MIN_VALID, ok + '/' + DAYS);
});

check('déterminisme sur 60 jours', () => {
  for (let i = 0; i < 60; i++) assert.strictEqual(fingerprint(G.generate(day(i))), fingerprint(results[i]), 'jour ' + day(i));
});

check('pas deux jours consécutifs identiques (60 jours)', () => {
  for (let i = 1; i < 60; i++) {
    const p = results[i - 1], q = results[i];
    assert(!(p.s === q.s && p.t === q.t && p.event === q.event), day(i));
  }
});

check('la grille optimale respecte les critères quand ok', () => {
  results.filter(P => P.ok).forEach(P => {
    assert(P.optEdges.length >= 4 && P.opt >= 14);
    assert(P.trap >= P.opt * 1.12);
    assert(P.near >= 3 && P.near <= 40);
    assert(new Set(P.optEdges.map(e => P.edges[e].line)).size >= 2);
  });
});

check('la version entre dans la graine', () => {
  assert(/^v\d+$/.test(G.NET_VERSION));
  const src = html.slice(a, b);
  assert(/strSeed\('correspondance-lille\|' \+ NET_VERSION \+ '\|' \+ key\)/.test(src));
});

console.log(failures ? '\n' + failures + ' échec(s)' : '\nTous les tests passent.');
process.exit(failures ? 1 : 0);

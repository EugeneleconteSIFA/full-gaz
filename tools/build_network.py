"""Construit NODE_DEF / EDGE_DEF à partir du GTFS Ilévia (transport.data.gouv.fr, jeu « Réseau urbain ilévia »).

Usage : python3 tools/build_network.py <dossier_gtfs_dézippé> [--write correspondance.html]

- Les lieux du jeu sont des stations réelles choisies à la main (NODES) ; les stations intermédiaires
  sont regroupées dans le temps de trajet, lu dans les horaires GTFS (voyage le plus fréquent, sens 0).
- Les temps à pied sont estimés : distance à vol d'oiseau x 1,3 (détour), à 75 m/min.
- Le plan reste schématique : la position (colonne, rangée) est choisie à la main, pas projetée.
"""
import csv, collections, math, re, sys, json

# clé, nom affiché, colonne, rangée, (ligne GTFS, nom d'arrêt GTFS) servant de référence pour les coordonnées
NODES = [
    ('saint_philibert', 'Saint-Philibert', 0, 2, ('M2', 'Saint Philibert')),
    ('canteleu', 'Euratechnologies', 1, 1, ('M2', 'Canteleu Euratechnologies')),
    ('port', 'Port de Lille', 2, 2, ('M2', 'Port De Lille')),
    ('esplanade', 'Esplanade', 3, 0, ('L1', 'Esplanade')),
    ('univ_catho', 'Université Catholique', 3, 2, ('L5', 'Universite Catholique')),
    ('cormontaigne', 'Cormontaigne', 2, 3, ('M2', 'Cormontaigne')),
    ('champ_mars', 'Champ de Mars', 4, 1, ('L1', 'Champ De Mars')),
    ('lycee_pasteur', 'Lycée Pasteur', 6, 0, ('L90', 'Lycee Pasteur')),
    ('postes', 'Porte des Postes', 3, 4, ('M1', 'Porte Des Postes')),
    ('lille_sud', 'Lille-Sud', 4, 5, ('L7', 'Place Garonne')),
    ('cimetiere_sud', 'Cimetière du Sud', 2, 5, ('L92', 'Cimetiere Du Sud')),
    ('chu', 'CHU Oscar-Lambret', 1, 4, ('M1', 'Chu - Centre O. Lambret')),
    ('eurasante', 'CHU Eurasanté', 0, 5, ('M1', 'Chu - Eurasanté')),
    ('wazemmes', 'Wazemmes', 4, 3, ('M1', 'Wazemmes')),
    ('gambetta', 'Gambetta', 4, 2, ('M1', 'Gambetta')),
    ('republique', 'République', 5, 2, ('M1', 'République Beaux-Arts')),
    ('rihour', 'Rihour', 5, 1, ('M1', 'Rihour')),
    ('flandres', 'Gare Lille-Flandres', 7, 1, ('M1', 'Gare Lille Flandres')),
    ('europe', 'Gare Lille-Europe', 8, 0, ('M2', 'Gare Lille Europe')),
    ('grand_palais', 'Grand Palais', 7, 2, ('M2', 'Lille Grand Palais')),
    ('valenciennes', 'Porte de Valenciennes', 6, 3, ('M2', 'Porte De Valenciennes')),
    ('douai', 'Porte de Douai', 5, 4, ('M2', 'Porte De Douai')),
    ('fives', 'Fives', 8, 2, ('M1', 'Fives')),
    ('hellemmes', 'Hellemmes', 9, 3, ('M1', "Mairie D'Hellemmes")),
    ('st_maurice', 'Saint-Maurice Pellevoisin', 9, 1, ('M2', 'Saint Maurice Pellevoisin')),
]

# Lignes : suite de (clé de lieu, nom d'arrêt GTFS), dans l'ordre réel des arrêts.
LINES = {
    'M1': [('eurasante', 'Chu - Eurasanté'), ('chu', 'Chu - Centre O. Lambret'), ('postes', 'Porte Des Postes'),
           ('wazemmes', 'Wazemmes'), ('gambetta', 'Gambetta'), ('republique', 'République Beaux-Arts'),
           ('rihour', 'Rihour'), ('flandres', 'Gare Lille Flandres'), ('fives', 'Fives'),
           ('hellemmes', "Mairie D'Hellemmes")],
    'M2': [('saint_philibert', 'Saint Philibert'), ('canteleu', 'Canteleu Euratechnologies'), ('port', 'Port De Lille'),
           ('cormontaigne', 'Cormontaigne'), ('postes', 'Porte Des Postes'), ('douai', 'Porte De Douai'),
           ('valenciennes', 'Porte De Valenciennes'), ('grand_palais', 'Lille Grand Palais'),
           ('flandres', 'Gare Lille Flandres'), ('europe', 'Gare Lille Europe'),
           ('st_maurice', 'Saint Maurice Pellevoisin')],
    # L1 : l'arrêt « Rue de Valenciennes » est rattaché au lieu Porte de Valenciennes (environ 300 m).
    'L1': [('esplanade', 'Esplanade'), ('champ_mars', 'Champ De Mars'), ('republique', 'République Beaux-Arts'),
           ('valenciennes', 'Rue De Valenciennes'), ('douai', 'Porte De Douai')],
    'L5': [('europe', 'Gare Lille Europe'), ('flandres', 'Gare Lille Flandres'), ('republique', 'République Beaux-Arts'),
           ('champ_mars', 'Champ De Mars'), ('univ_catho', 'Universite Catholique'), ('cormontaigne', 'Cormontaigne'),
           ('postes', 'Porte Des Postes')],
    'L7': [('postes', 'Porte Des Postes'), ('lille_sud', 'Place Garonne')],
    'L92': [('postes', 'Porte Des Postes'), ('cimetiere_sud', 'Cimetiere Du Sud'), ('eurasante', 'Chu - Eurasanté')],
    # L90 et L91 font le même trajet dans Lille ; on garde L90.
    'L90': [('lycee_pasteur', 'Lycee Pasteur'), ('flandres', 'Gare Lille Flandres'), ('europe', 'Gare Lille Europe')],
}

# Liaisons à pied retenues. Un nom n'est donné que si l'itinéraire piéton OpenStreetMap (routing.openstreetmap.de)
# suit majoritairement cette rue ; sinon la liaison reste sans nom.
WALKS = [
    ('esplanade', 'lycee_pasteur', 'Rue Saint-André'), ('champ_mars', 'rihour'), ('rihour', 'lycee_pasteur'),
    ('univ_catho', 'rihour', 'Rue Nationale'), ('port', 'univ_catho', 'Rue Philippe-Laurent Roland'),
    ('univ_catho', 'gambetta'), ('cormontaigne', 'wazemmes'), ('republique', 'grand_palais'),
    ('douai', 'lille_sud', "Boulevard d'Alsace"), ('chu', 'cimetiere_sud'), ('cimetiere_sud', 'lille_sud', 'Rue de la Prévoyance'),
    ('europe', 'fives'), ('st_maurice', 'fives'), ('grand_palais', 'fives'),
]

def load(gtfs):
    rd = lambda f: csv.DictReader(open(gtfs + '/' + f, encoding='utf-8-sig'))
    stops = {r['stop_id']: r for r in rd('stops.txt')}
    routes = {r['route_id']: r['route_short_name'] for r in rd('routes.txt')}
    want = {rid for rid, n in routes.items() if n in LINES}
    trips = {r['trip_id']: r for r in rd('trips.txt') if r['route_id'] in want}
    seq = collections.defaultdict(list)
    for r in rd('stop_times.txt'):
        if r['trip_id'] in trips:
            seq[r['trip_id']].append((int(r['stop_sequence']), r['stop_id'], r['departure_time']))
    sec = lambda t: sum(int(x) * m for x, m in zip(t.split(':'), (3600, 60, 1)))
    lines = {}
    for rid in want:
        pats = collections.Counter(); ex = {}
        for tid, t in trips.items():
            if t['route_id'] != rid or t['direction_id'] != '0': continue
            s = sorted(seq[tid]); k = tuple(x[1] for x in s); pats[k] += 1; ex.setdefault(k, s)
        top = pats.most_common(1)[0][1]
        k = max(pats, key=lambda k: (pats[k] >= top * 0.3, len(k)))
        out = []
        for _, sid, dep in ex[k]:
            st = stops[sid]; par = stops.get(st['parent_station'], st)
            out.append({'name': par['stop_name'], 'lat': float(st['stop_lat']), 'lon': float(st['stop_lon']), 'sec': sec(dep)})
        lines[routes[rid]] = out
    return lines

def dist_m(a, b):
    la = math.radians((a['lat'] + b['lat']) / 2)
    return math.hypot((a['lat'] - b['lat']) * 111320, (a['lon'] - b['lon']) * 111320 * math.cos(la))

def main():
    gtfs = sys.argv[1]
    lines = load(gtfs)
    def find(line, name):
        hits = [s for s in lines[line] if s['name'] == name]
        if not hits: sys.exit('Arrêt introuvable : %s / %s' % (line, name))
        return hits[0]
    pos = {k: find(*ref) for k, _, _, _, ref in NODES}
    cells = collections.Counter((c, r) for _, _, c, r, _ in NODES)
    assert max(cells.values()) == 1, 'deux lieux sur la même case'
    edges = []
    for ln, stops in LINES.items():
        seq = [(k, find(ln, nm)) for k, nm in stops]
        for (ka, sa), (kb, sb) in zip(seq, seq[1:]):
            mins = max(1, round(abs(sb['sec'] - sa['sec']) / 60))
            edges.append((ka, kb, ln, mins, None))
    for w in WALKS:
        d = dist_m(pos[w[0]], pos[w[1]])
        edges.append((w[0], w[1], 'RUE', max(2, round(d * 1.3 / 75)), w[2] if len(w) > 2 else None))
    seen = set()
    for a, b, ln, *_ in edges:
        key = (min(a, b), max(a, b), ln)
        assert key not in seen, key; seen.add(key)
    js = lambda s: "'" + s.replace("'", "\\'") + "'"
    nd = ',\n'.join('  [%s, %s, %d, %d]' % (js(k), js(n), c, r) for k, n, c, r, _ in NODES)
    ed = ',\n'.join('  [%s, %s, %s, %d%s]' % (js(a), js(b), js(l), m, ', ' + js(nm) if nm else '') for a, b, l, m, nm in edges)
    block = ('/* Généré par tools/build_network.py à partir du GTFS Ilévia. Ne pas modifier à la main. */\n'
             '/* Lieux : [clé, nom affiché, colonne, rangée]. Plan schématique, pas à l\'échelle. */\n'
             'var NODE_DEF = [\n' + nd + '\n];\n\n'
             '/* Liaisons : [lieu A, lieu B, ligne, minutes, nom de rue]. Métro et bus : ordre réel des arrêts, temps lus dans les horaires,\n'
             '   arrêts intermédiaires regroupés. À pied : distance x 1,3 à 75 m/min. */\n'
             'var EDGE_DEF = [\n' + ed + '\n];\n')
    if '--write' in sys.argv:
        p = sys.argv[sys.argv.index('--write') + 1]
        s = open(p, encoding='utf-8').read()
        a = s.index('/*NET-START*/') + len('/*NET-START*/\n'); b = s.index('/*NET-END*/')
        open(p, 'w', encoding='utf-8').write(s[:a] + block + s[b:])
    print(block)

main()

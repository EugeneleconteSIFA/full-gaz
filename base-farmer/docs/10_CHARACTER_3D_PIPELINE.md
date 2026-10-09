# Personnages 3D — méthode, pipeline et bible du roster

Synthèse du travail des 6–7 octobre 2026 (Gaston, puis Patatras, Pépin, Lorgnon). La version opérationnelle, pas à pas, est le skill [`character-3d`](../.claude/skills/character-3d/SKILL.md) ; ce document explique **pourquoi** et sert de référence de direction artistique.

## 1. Décisions

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Direction | Clash Royale / Brawl Stars (Supercell), touches Pixar | demandé ; lisible sur mobile |
| Proportions | tête ≈ 50 % de la hauteur (chibi) | Clash Royale |
| Rendu | lisse : rampe douce, ombre teintée froide, liseré (rim), occlusion, contour fin teinté | Supercell n'est pas en aplats durs |
| Outil | Blender 4.5 LTS **piloté par script** (`blender -b -P`), export `.glb`, rendu et animation dans three.js | qualité d'outil de studio, reproductible, tout dans le dépôt |
| Source de vérité | le script Python du perso | jamais de `.blend` retouché à la main |
| Chargement | 5–6 s acceptés ; en match, sprites photographiés au chargement | budget de triangles large pour la loupe |

## 2. Recherches (ce qui a été lu et retenu)

| Thème | Sources lues | Règles retenues |
| --- | --- | --- |
| Pipeline perso 3D | CoderNunk « Complete 3D character guide » | ordre corps → tête → mains → vêtements → accessoires ; normales de visage propres ; contour à épaisseur variable, nul sur le visage ; ombre peinte |
| Game-ready | 9 tutoriels game-dev Meshy | planche face/profil/dos ; budgets ; ≤ 4 os par sommet ; pièces séparées pour ce qui bouge seul ; pas de lumière peinte |
| Supercell | PocketGamer.biz (5 piliers Brawl Stars), Adobe Substance Magazine (pipeline Clash) | une phrase + un twist ; **un seul trait marquant** ; albédo simple ; dégradés doux ; le regard guidé vers le visage |
| Expressions | AnimSchool (eye mask), Bloop (clignements, saccades), CG Channel, FACS/ARKit | sourcils + paupières = un seul bloc ; la paupière basse monte avec le sourire ; les yeux sautent ; asymétrie |
| Yeux | Wikibooks « Pixar eyes », Blender Artists | globe sphérique, iris en coupelle, anneau limbal, pupille ≈ 45 % de l'iris, reflets du même côté, paupières en coque fine |
| Bouche, crocs | pratique courante (sources faibles) ; drawingforall, Blender Artists (orc) | bouches dessinées et interchangeables ; crocs **dans** la dentition, jamais posés sur la lèvre |
| Membres | Proko (mains cartoon), posemy.art (prise d'objet) | épaule enfoncée, avant-bras « Popeye », poignet pincé, mitaine à 3 doigts « boulettes » + pouce verrouillé, semelle plate, orteils creusés |
| Accessoire | 80.lv (props stylisés), Innovecs | silhouette d'abord ; contraste épais/fin ; tête exagérée ; métal plus clair et froid, bois chaud ; une usure franche |

Les chiffres issus de simples extraits de recherche (non lus en entier) sont des **cibles de départ**, pas des vérités.

## 3. Pipeline

```
art/characters/lib/sdfkit.py     formes SDF (numpy), mélanges, maillage OpenVDB, poids, couleurs, occlusion
art/characters/lib/blendkit.py   objets Blender, squelette, pièces rigides, planche de contrôle, export glTF
art/characters/lib/charkit.py    le kit « chibi » : squelette commun, peau, yeux, paupières, sourcils,
                                 poings, pieds, bouches interchangeables ou bec, vêtements, accessoires
art/characters/<id>/build.py     la fiche du perso (personnalité, canon, palette, volumes, accessoires)
public/models/<id>.glb           généré
src/rendering/three/             chargement, matériau Supercell, contour, animation, expressions
```

```bash
~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/tank/build.py
```

Une construction à la fois (deux en parallèle se partagent la machine). Chaque script échoue si les contrôles ne passent pas (hauteur, proportion de tête, budget de triangles) et écrit une planche face/profil/dos/caméra de jeu dans `art/characters/<id>/sheet/`.

### Ce qui marche (et ce qu'on a abandonné)

| Problème | Essayé et abandonné | Solution retenue |
| --- | --- | --- |
| Tourner autour du perso | planches 2D basculées | un vrai modèle 3D |
| Jonctions | pièces séparées qui se traversent | volumes SDF fusionnés, arrondi réglé **par jonction** |
| Lissage | décimation (lamelles), QuadriFlow (refuse les pièces complexes) | remaillage voxel calé sur l'aire + recollage des sommets sur la surface |
| Couleurs nettes | peinture par sommet (bords flous) | pièces séparées ou **décalques** (coque fine qui épouse la peau) |
| Contour | coque gonflée (traits fantômes dans les creux) | contour en espace écran, sur les sauts de profondeur |
| Bouche | charnière, puis formes clés recalculées (« O » mou) | **bouches dessinées interchangeables** (grin, smile, smirk, frown, o, shout) ; bec en deux pièces pour les oiseaux |
| Yeux | disque plat, ellipsoïde enfoncé | œil Pixar (cf. §2) |

## 4. Bible du roster

Chaque perso a **une phrase**, **un trait marquant** lisible de la caméra du jeu, **une forme dominante** liée à son rôle, **une expression signature** (celle de la loupe par défaut) et **un accessoire**.

| | Patatras (tank) | Pépin (scout) | Lorgnon (shooter) | Gaston (fighter) |
| --- | --- | --- | --- | --- |
| Phrase | cochon cuistot placide et têtu qui encaisse tout sous sa marmite | petit coq blanc pilote, insolent et pressé | hibou érudit à monocle, tireur pédant | bouledogue de ferme teigneux qui charge à la fourche |
| Personnalité | placide, bon vivant, imperturbable | insolent, hyperactif, frimeur | hautain, posé, précis | teigneux, bagarreur, au fond joyeux |
| Trait marquant | marmite en cuivre sur la tête | crête rouge + lunettes d'aviateur | aigrettes + monocle doré | grand chapeau de paille |
| Forme | **rond** partout, le corps le plus large | **triangle / goutte**, la plus grosse tête (≈ 56 %) | **rectangle arrondi**, le plus droit | rond trapu, mâchoire carrée |
| Expression signature | `placide` (paupières mi-closes, sourire fermé) | `insolent` (sourcil levé, bec entrouvert) | `hautain` (sourcils levés, œil plissé) | `teigneux` (sourcils froncés, rictus, crocs) |
| Accessoire | poêle en fonte (« patatras ! ») | petit râteau | lance d'arrosage en cuivre | fourche |
| Palette | rose, crème rosé, cuivre, tablier crème à liseré rouge | blanc, orange (bec, pattes), rouge (crête), foulard moutarde | brun, disque facial crème, ventre à chevrons, or, nœud rouge | orange, crème, tache brune, jean désaturé, paille |
| Yeux | bleu doux | orange vif | orange hibou, les plus grands | ambre |

Règles communes : les quatre partagent le même squelette (mêmes noms d'os : une seule animation pour tous), le même œil, la même main, le même pied, le même matériau. Aucun grand aplat bleu ou rouge vif (couleurs d'équipe).

### Hypothèses (pas encore dans le jeu)

Aperçu dans la loupe avec `?model=<id>` (ex. `http://localhost:5173/?model=cow`, puis n'importe quelle loupe).

| | Marguerite (`cow`, artillerie) | Bernadette (brebis, soutien) | Ernest (taupe, fouisseur) |
| --- | --- | --- | --- |
| Phrase | fermière placide et costaude qui bombarde à coups de bidons de lait | mamie tricoteuse, redoutable avec ses pelotes | taupe myope et grincheuse, chef de chantier, qui surgit de sous terre |
| Trait marquant | cornes crème + mèche brune bouclée + cloche en laiton | toison en nuage + pelote-chignon | casque de mineur à lampe + mains-pelles |
| Forme | **cloche** (lourde en bas) | **nuage** bosselé | **poire** basse et large |
| Expression signature | `placide` (une marguerite au coin de la bouche) | `malicieux` | `grincheux` |
| Accessoire | bidon de lait en fer-blanc | aiguilles à tricoter | pelle à la ceinture |
| Palette | blanc cassé + taches noires, mufle rose, laiton | crème, face gris-brun, rose framboise | anthracite, rose, gilet orange, casque jaune |
| Combat | tir en cloche portée 10, zone, lent ; « Ruade » (repousse + bond) | pelote ralentissante portée 6,5 ; « Cocon de laine » (zone de soin) | griffes rapides ; « Galerie » (2 s sous terre, recharge 10 s comptée à la sortie, ne capture pas sous terre) |
| État | modèle v1 construit | modèle v1 construit (`sheep`) | modèle v1 construit (`mole`) |

## 5. Passe « héros Supercell » (9 octobre 2026, D063)

Constat : persos trop pastel, trop mats, « figurines ». Causes trouvées, dans l'ordre d'impact :

1. **Lumière principale derrière les persos** (`z = -4`) : les visages, tournés vers la caméra, étaient côté ombre. Elle vient maintenant d'en haut à gauche **et un peu de devant** (`lighting.ts`).
2. **Couleurs qui saturaient vers le blanc** côté éclairé (remplissage trop fort, pas de compression) : d'où l'aspect pastel.
3. **Palettes pastel** aux luminosités trop proches.
4. **Formes molles** : tout en ellipsoïdes, tête fondue dans le corps, mains de même taille pour tous, pose droite et symétrique.
5. **Aucune surface ne brillait**, puis, après un premier essai, des **yeux vitreux** (iris en coupelle, deux reflets peints plus un reflet du matériau).

Corrections, toutes dans les scripts et le matériau partagé :

| Domaine | Règle |
| --- | --- |
| Matériau | mode `character` de `supercellMaterial` : moins de remplissage (0,45), rampe à transition nette et ombre violette saturée, occlusion colorée, liseré chaud ; le décor garde le mode `world` |
| Brillance | chaque pièce porte une valeur 0..1 (carte UV « Gloss » → attribut `aGloss`) : peau et tissu mats, museaux et becs un peu brillants, métal brillant et **teinté de sa couleur** ; yeux : **aucun** reflet de matériau |
| Yeux | iris presque à plat, anneau sombre épais, grande pupille, petit croissant, **un seul** reflet ; paupières supérieures épaisses avec un trait de cils |
| Formes (`charkit.Spec`) | `head_blend` (tête enfoncée), `body_box` / `head_box` (surfaces tendues), `hand_scale`, `brow_r`, `brow_lift` (asymétrie) ; valeurs par défaut = ancien rendu |
| Attitude | `ATTITUDE` dans `gltfCharacter.ts` : penché, menton, inclinaison de tête, bras écartés, appui ; décalages de l'animation existante (même squelette) |
| Gaston | migré sur `charkit` (son script v2 n'utilisait pas le kit) |

| Perso | Forme | Signature renforcée |
| --- | --- | --- |
| Patatras | bloc massif, tête carrée enfoncée, grosses mains, pieds larges | marmite plus large que la tête, posée bas et de travers ; museau en disque net ; sourcil relevé |
| Pépin | goutte, torse bombé | crête et lunettes agrandies, sourcil relevé insolent |
| Lorgnon | rectangle franc | aigrettes longues, monocle agrandi, sourcils asymétriques |
| Gaston | trapu, penché pour charger | museau massif prognathe avec crocs, chapeau large détaché, sourcils froncés |

Vérification : page `lab.html` (dev seulement) avec le vrai matériau, la vraie lumière et le vrai contour, en face, trois quarts, profil, dos, caméra du match et taille téléphone ; `?compare` (avant/après), `?mode=black` (silhouettes), `?face` (gros plan).

## 6. Ce qui reste à faire

- Vérifier en mouvement à vitesse réelle et sur iPhone.
- Dos de Patatras encore peu animé (seule la queue) ; tablier sans relief.
- Intégration en match : photographier chaque modèle sous plusieurs angles au chargement (sprites), puis remplacer les marionnettes 2D.

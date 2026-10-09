---
name: character-3d
description: Méthode pas à pas pour créer de zéro un personnage 3D de Base Farmer au niveau Brawl Stars / Clash Royale (brief, planche de proportions, modélisation scriptée dans Blender, rig, visage, rendu Supercell, animation, export glTF, contrôle). À utiliser dès qu'on crée, refait ou juge un personnage 3D.
---

# Personnages 3D façon Supercell — méthode Base Farmer

Synthèse, décisions et **bible du roster** (personnalités, traits marquants, palettes) : [`docs/10_CHARACTER_3D_PIPELINE.md`](../../../docs/10_CHARACTER_3D_PIPELINE.md). Un nouveau perso = une fiche `art/characters/<id>/build.py` qui remplit un `Spec` de `art/characters/lib/charkit.py` (voir `tank`, `scout`, `shooter`).

Sources : guide CoderNunk « Complete 3D character guide » (pipeline Blender → moteur, rendu toon), tutoriels game-dev Meshy (budgets, contrôles « game-ready »), Supercell (5 piliers Brawl Stars, PocketGamer.biz ; pipeline Clash, Adobe Substance Magazine), et nos propres erreurs sur Gaston (journal §12).

**Règle d'or** : on corrige l'**entrée** (brief, planche, mesures) avant de toucher au modèle ; on juge **à la taille du jeu** avant de juger en gros plan.

## 0. Décisions de cadrage (validées par l'utilisateur, 2026-10-07)

| Sujet | Décision |
| --- | --- |
| Proportions | Clash Royale : tête ≈ 50 % de la hauteur totale (chibi) |
| Rendu | lisse façon Supercell : dégradé doux + liseré (rim) + occlusion, contour fin teinté ou absent |
| Outils | modèle **scripté dans Blender 4.5 LTS** (headless, `blender -b -P`), exporté en `.glb`, rendu et animé dans three.js |
| Source de vérité | le script Python du perso (versionné), jamais un `.blend` modifié à la main sans être reporté dans le script |

## 1. Brief (10 min) — une phrase et un crochet

1. **Archétype + twist** en une phrase (pilier « humour » de Supercell) : « Gaston, chien de ferme teigneux qui charge à la fourche comme un taureau ».
2. **Un seul crochet de silhouette** (hook) : chapeau, oreilles OU arme. Les autres éléments sont simplifiés.
3. **Rôle → forme dominante** : rond = tank/sympa, carré = solide, triangle = rapide/agressif.
4. **Deux références nommées** et ce qu'on prend à chacune (ex. Bull de Brawl Stars : masse et attitude ; Chevalier de Clash Royale : visage et sourire).
5. **Palette** : 2–3 teintes + 1 accent ; le visage/museau est la grande zone la plus claire ; l'accent est la plus saturée ; **pas de grand aplat bleu/rouge d'équipe sur le modèle** (l'équipe est portée par l'anneau au sol + un petit écusson).

## 2. Canon de proportions (unités : H = hauteur totale, h = hauteur de tête)

| Mesure | Cible Clash Royale | Contrôle |
| --- | --- | --- |
| Tête / hauteur | h ≈ 0,48–0,52 H | planche face |
| Largeur tête / largeur torse | 1,1–1,3 | planche face |
| Hiérarchie des masses | tête : corps : membres ≈ 1 : 0,6 : 0,35 | jamais deux masses égales |
| Yeux | au **milieu ou sous** le milieu de la tête ; largeur d'un œil 0,18–0,25 × largeur tête ; écart ≈ 1 œil | |
| Sourcil en colère | 15–25° vers le nez, couvre 20–30 % du haut de l'œil | |
| Bouche | 0,4–0,6 × largeur tête, **asymétrique** (rictus, coin levé) | jamais neutre plate |
| Mains | 0,35–0,45 × largeur tête, moufle ou 3 doigts + pouce, épaisses (×1,5) | |
| Pieds | ≈ 0,5 × largeur tête, posés larges | |
| Jambes | 0,4–0,6 h | |
| Arme | 0,8–1,2 × hauteur du corps, manche épais ≈ un doigt | |

Ces chiffres sont des **cibles de départ** (observation des jeux) : on les écrit dans le script du perso sous forme de constantes nommées, puis on les règle avec la planche.

## 3. Planche de référence (turnaround) — avant toute modélisation

- Vues **face / profil / dos / dessus** orthographiques, perso en **A-pose** (bras à 45°, coudes et genoux très légèrement pliés pour l'IK), fond gris neutre, lumière plate.
- **Lignes guides** horizontales communes à tout le roster : sol, genou, bassin, épaules, menton, yeux, sommet du crâne, sommet du chapeau.
- Hauteur commune par classe de perso (calibrée par un cube de hauteur connue dans Blender).
- Générée par le script lui-même (`render_sheet`) : on compare la planche **aux mesures du §2** avant de passer à la suite.

## 4. Modélisation scriptée dans Blender

Outillage (installé le 2026-10-07) : Blender **4.5 LTS** dans `~/Applications/Blender.app` (la 5.x ne tourne plus sur Mac Intel), avec OpenVDB et numpy embarqués. Bibliothèques du projet : `art/characters/lib/sdfkit.py` (formes, mélanges, maillage, poids, couleurs, occlusion) et `art/characters/lib/blendkit.py` (objets, squelette, pièces rigides, planche, export). Un perso = `art/characters/<id>/build.py`.

```bash
~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/gaston/build.py
```

Le script écrit `public/models/<id>.glb` et la planche `art/characters/<id>/sheet/{front,side,back,game}.png` (à lire avant de juger dans le jeu).

Ordre (du guide CoderNunk) : **corps nu → tête et visage → mains → vêtements → accessoires → nettoyage**.

1. **Blocage** : primitives (sphères, capsules, boîtes arrondies) aux cotes du canon. Chaque jonction a sa propre **netteté** : arrondi large pour la chair (cou, aisselle), arrondi faible ou angle franc pour semelle, ourlet, col, bord de chapeau. Un arrondi unique partout = « pâte à modeler » (défaut n° 1 de nos premiers essais).
2. **Fusion en un volume** : remaillage voxel (`Remesh` voxel 0,01–0,02 H) puis lissage préservant le volume.
3. **Topologie de jeu** : remaillage en quads (`QuadriFlow`) ou décimation, **3–8 k triangles** pour un perso mobile. Densité plus forte au visage, aux mains, aux articulations.
4. **Surfaces franches contre courbes** : chaque grande forme a un côté plus plat face à un côté plein (Supercell : « doux mais pas ballon »).
5. **Plis** : 2–4 grands plis de vêtement au total, jamais de bruit.
6. **Supprimer la géométrie cachée** sous les vêtements (sauf tête et mains).

## 5. Visage (là où se joue l'attrait)

- **Yeux** : pièces séparées (blanc + pupille + reflet) logées dans des **orbites creusées**, inclinées ≈ 15° pour suivre la courbure. Variante « yeux haricots » noirs sans blanc pour certains animaux.
- **Museau** : forme claire distincte, fondue dans la tête par un dégradé de peinture (pas un trait), **contraste de valeur fort** avec la face.
- **Bouche** : cavité modélisée, dents (canines) et langue dedans ; formes clés (shape keys) : `smile_L/R`, `sulk`, `open`, `shout`.
- **Paupières et sourcils** : formes clés ou os dédiés ; le sourcil coupe l'œil pour l'attitude.
- **Normales du visage** remplacées par celles d'un ellipsoïde englobant (transfert de normales) : plus de taches d'ombre du nez et des joues ; ombrage net et lisible.
- **Expression par défaut** : assurance ou rictus, jamais neutre.

### 5 bis. Museau et bouche (chien ; sources faibles : pratique courante de la stylisation)

- Museau = **deux coussinets** séparés par un sillon (philtrum), pas un œuf ; **babines** qui retombent sur la mâchoire aux coins (les coins de bouche se cachent dessous).
- Truffe = trapèze biseauté, plus large en haut, encoche centrale, **narines en virgule**, reflet froid sur le dessus ; pièce séparée.
- Mâchoire en **U** ; bouledogue : prognathe (devant la lèvre du haut), relevée de ~10°, menton distinct.
- Bouche **fermée au repos** : une fente fine entre babines et mâchoire ; c'est la mâchoire qui l'ouvre. La poche (« mouth bag ») reste **à l'intérieur** du museau.
- Intérieur brun-rouge chaud (`#5A1E1E` → `#2A0D10` au fond), jamais noir ; **ligne de lèvre sombre** (`#2B2224`).
- **Gencive** (`#C2545E`) en bourrelet : chaque dent y est plantée (25 % de sa hauteur). Dents blanc cassé (`#F4EEDC`), ombrées à la racine ; on montre 2 crocs + 4 petites incisives, jamais une dentition complète ; une légère asymétrie.
- **Langue en volume** : deux lobes et un sillon central, posée bas dans la mâchoire, sur l'os de la mâchoire.

**Bouches interchangeables (décision du 2026-10-07)** : la bouche ne s'ouvre pas par une charnière ni par des formes clés recalculées (essayé : « O » mou, bords dentelés). Chaque forme de bouche est **dessinée** : des décalques à fleur du visage, découpés par un contour 2D exact (ligne de lèvre sombre, intérieur, dents du haut, langue), un jeu par forme (`grin`, `smirk`, `frown`, `o`, `shout`), et l'expression choisit lequel afficher. Visage **humanisé** : museau très court, bouche sur la face juste sous la truffe (références : chiens 3D façon Pixar, bouledogues stylisés).

### 5 ter. Expressions (AnimSchool, Bloop, FACS/ARKit, Osipa)

Contrôles normalisés (`src/rendering/three/face.ts`) : `browIn`, `browOut`, `squeeze` (le nœud de la colère), `lidUp`, `lidLow` (poussée de la joue), `pupil`, `jaw`, `cornerL/R`, `width`, `sneerL/R` (babine qui se retrousse), `nose` (plis).

Règles de couplage (le haut du visage est **un seul bloc**) :
- la paupière haute suit le sourcil qui descend (×0,25–0,5) et le regard qui baisse ;
- la paupière basse **monte avec le sourire** (sourire sincère) et un peu dans la colère (regard noir) ;
- le froncement accompagne à la fois la colère (intérieur bas) et l'inquiétude (intérieur haut) ;
- les sourcils mènent, les paupières suivent, la bouche arrive en dernier ;
- les yeux **sautent**, ils ne glissent jamais (une saccade toutes les 0,6–2 s) ; clignement 2/1/3 images à 30 i/s, toutes les 2–5 s, irrégulier ;
- jamais de symétrie parfaite (rictus d'un côté).

Les valeurs des 7 expressions et du cri de guerre sont dans `face.ts` (tirées du rapport de recherche).

### 5 quater. Yeux, crocs, membres, accessoire (recherches du 2026-10-07)

- **Œil** (Wikibooks « Pixar eyes », Blender Artists, CG Channel) : globe **sphérique** (pas d'ellipsoïde), tourné de 10–15° vers l'extérieur, iris **creusé** en coupelle et orienté légèrement vers l'intérieur (convergence), blanc cassé avec bande d'ombre sous la paupière, anneau limbal sombre, croissant clair à l'opposé de la lumière, pupille ≈ 45 % de l'iris, reflets **du même côté** pour les deux yeux et fixés à la tête ; paupières en coque fine (1,05 × le globe) avec ligne de cils.
- **Crocs** : ils font partie de la dentition (sortent de la rangée du bas / de la lèvre du bas), écartés à ~73 % de la demi-bouche, inclinés vers l'extérieur, pointe arrondie, asymétriques ; jamais posés sur la lèvre du haut.
- **Membres** (Proko, posemy.art) : jamais de tubes réguliers ; épaule = boule enfoncée dans le corps ; avant-bras « Popeye » puis **poignet pincé** ; main = grosse paume + 3 doigts « boulettes » enroulés autour du manche (pas identiques) + pouce fin à la base, gros au bout, verrouillé dessus ; pied à **semelle plate**, talon plus étroit, 3 orteils en relief assez creusés pour la caméra du jeu ; cheville marquée.
- **Accessoire / arme** (80.lv, Innovecs) : silhouette d'abord (test en gris à petite taille), contraste épais/fin (manche fin → virole épaisse → tête massive), tête exagérée ≈ largeur de la tête du perso, bandes de prise là où se tient la main, matière : bois chaud avec veines, métal froid plus clair avec liseré clair **là où la surface regarde vers le haut**, une usure franche (éclat, dent plus courte).
- **Décalques** : toujours une coque fine qui épouse la peau (jamais un bloc profond : le remaillage efface les détails fins) ; champ de la peau échantillonné une fois et partagé.
- **Builds Blender** : jamais deux en parallèle (ils se partagent la machine) ; ~4 min aujourd'hui.

## 6. Matériaux et rendu Supercell (three.js)

- Couleurs : **palette de cases plates** (texture 32×32 ou couleur par sommet), aucune lumière peinte dedans.
- Ombrage : rampe douce (2 tons + transition lissée de 0,1–0,2) ; **ombre teintée** (base × teinte froide saturée), jamais du gris.
- **Rim light** (Fresnel) 0,3–0,5, teinte ciel.
- **Occlusion** cuite dans les creux (aisselles, sous le chapeau, sous le menton, jonctions vêtement/corps).
- Léger dégradé vertical : pieds 10–15 % plus sombres que la tête.
- Contour : fin (1–1,5 px à l'échelle mobile), **teinte locale assombrie**, nul sur yeux/bouche/sourcils ; ou pas de contour du tout (Brawl Stars en jeu).
- Un seul matériau maître partagé par tout le roster (teinte/contraste en paramètres).

## 7. Rig

- **Une seule racine** à l'origine ; échelle appliquée (1) avant le rig ; noms en `.L/.R` (miroir).
- Squelette : bassin, colonne, cou, tête, mâchoire, épaules/bras/avant-bras/mains, 3 doigts + pouce, jambes/pieds, queue, oreilles ; os **secondaires** (oreilles, queue, bretelles, bord de chapeau) animés par ressorts.
- Poids : automatiques, mais **restreints aux os pertinents par pièce** (vêtement ← tronc et bassin ; chapeau ← tête) ; ≤ 4 influences par sommet, normalisées.
- Coudes et genoux pré-pliés ; tester des poses extrêmes (bras levé, course, coup) avant de valider.

## 8. Animation

- Clips : `idle` (respiration + tic de personnalité toutes les 3–5 s), `run` (rebond, tête qui balance, penché 10–15°), `attack` (anticipation 3–6 images à 30 i/s, frappe rapide, dépassement tenu), `hit`, `victory` (pose signature qui raconte la blague), `defeat`.
- Écrasement-étirement 10–20 % en conservant le volume ; mouvement secondaire sur oreilles, queue, chapeau, bretelles.
- Poses avec **ligne d'action** et contrapposto ; jamais raide.

## 9. Export et intégration

- `.glb` unique : maillage, os de déformation seulement, formes clés, clips nommés ; pas de matériau (reconstruit dans three.js).
- Fichiers : `art/characters/<id>/build.py` (source), `public/models/<id>.glb` (généré). Commande de build : `blender -b -P art/characters/<id>/build.py`.
- En jeu : le modèle est photographié sous N angles au chargement (sprites) pour garder le coût par image d'une Image Phaser ; la loupe affiche le modèle 3D en direct.

## 10. Contrôles automatiques (le script échoue s'ils ne passent pas)

Triangles ≤ budget ; aucun morceau flottant ; maillage étanche ; poids ≤ 4 et normalisés ; racine unique ; échelle 1 ; hauteur = hauteur de classe ; proportions du §2 dans la tolérance.

## 11. Grille de critique « est-ce du Brawl Stars ? » (0/1/2, seuil 18/24, aucun 0)

| # | Critère | Comment |
| --- | --- | --- |
| 1 | Concept en une phrase avec twist | lire le brief |
| 2 | Un seul crochet de silhouette, reconnaissable en aplat noir à 64 px vu de la caméra du jeu | rendu silhouette |
| 3 | Proportions du canon (tête ≈ 50 %, hiérarchie 1 : 0,6 : 0,35) | mesures du script |
| 4 | Arme surdimensionnée et épaisse, côté lisible | rendu jeu |
| 5 | Mains moufles épaisses, pieds larges | gros plan |
| 6 | Plat contre courbe, coutures nettes, pas « ballon » | gros plan |
| 7 | Yeux grands et bas, sourcil qui coupe l'œil, bouche large asymétrique | gros plan visage |
| 8 | Museau/visage = grande zone la plus claire ; accent = plus saturé | niveaux de gris |
| 9 | Séparation en gris ≥ 15 % entre tête, corps, arme | niveaux de gris |
| 10 | Rendu doux + rim + occlusion, contour fin teinté ou absent, aucun trait parasite | gros plan |
| 11 | Poses et animations avec anticipation, écrasement, victoire signature | modal |
| 12 | Détail concentré visage et mains, ≈ 70 % de surface calme | vue d'ensemble |

## 12. Journal des erreurs déjà faites (Gaston, oct. 2026)

| Erreur | Parade |
| --- | --- |
| Planches 2D retournées pour « tourner » le perso | un vrai modèle 3D unique |
| Pièces séparées qui se traversent (bras, oreilles, museau) | un seul maillage fusionné + jonctions à netteté réglée |
| Tache peinte par sommet : bords en escalier | texture / palette, ou plus de densité au visage |
| Contour par coque gonflée : traits fantômes dans les creux | contour en espace écran (saut de profondeur) ou coque à largeur par sommet nulle au visage |
| Mains en marching cubes trop grossier | mains plus denses ; moufle épaisse |
| Chapeau penché : crâne qui dépasse | tester dos et profil à chaque retouche |
| Capture du pane en retard d'une image | deux captures, ou attendre 1 s |
| Calcul de peau à l'ouverture (2 s de gel) | modèle précalculé (`.glb`) |
| Décimation : triangles en lamelles, ombrage et couleurs striés | remaillage **voxel** dont la taille vient de l'aire (`√(3·aire/budget)`), puis recollage des sommets sur la surface (pas de Newton) |
| QuadriFlow refuse les pièces complexes (bouche, orbites) | ne pas en dépendre ; le voxel suffit |
| Bords de couleur peints par sommet : flous, sales | une **pièce séparée** (ruban, truffe) ou un **décalque** (fine couche qui épouse la peau, coupée par la forme de la tache) |
| Fine pièce (ruban) trop peu dense : bord dentelé | budget de triangles par pièce selon sa finesse, pas selon sa taille |

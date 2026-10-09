# Roadmap — tout Base Farmer dans la DA 3D, jouable en local

Point de départ (7 octobre 2026) : les 4 personnages existent en 3D (Blender scripté → `public/models/*.glb`, rendu Supercell dans three.js), mais **seulement dans la loupe de l'écran de sélection**. Le match, les bases, le décor, les effets et l'interface sont encore en 2D dessinée en code (`src/rendering/`, environ 8 000 lignes). Rien du travail 3D n'est commité.

Objectif : une partie complète en local (sélection → match de 7 min → résultats) où **tout** suit la même DA que les personnages.

Chaque étape donne : le but, le prompt à coller dans Claude Code, et le critère « c'est fini ». On fait les étapes dans l'ordre ; chacune finit par un commit.

## Décisions prises (7 octobre 2026)

| Étape | Décision |
| --- | --- |
| 0 | `.glb` versionnés ; piste « marionnettes 2D refaites » abandonnée, non commitée |
| 1 | cibles : ordinateur + iPhone mini (375 × 812) ; **fait : voie A, monde en three.js (D058)** — 60 fps sur ordinateur et sur iPhone mini ; persos penchés de 30° vers la caméra |
| 2 | taille des persos à l'écran et proportions façon Brawl Stars ; expressions du visage **seulement** dans la loupe, la sélection et les résultats (pas en match) |
| 3 | soleil de journée partout, sauf le **Canyon en fin de journée** ; densité de décor façon Brawl Stars (sol lisible, peu de décor) |
| 4 | on **redessine les cartes** avant de les modéliser ; on **renomme** la ressource « Puissance » avant de modéliser son bâtiment |
| 5 | jeu 2.5D, sobre : caméra fixe inclinée, pas de caméra libre ni d'effets 3D démonstratifs ; l'ancien rendu 2D est **supprimé** une fois le 3D validé (pas de mode de secours) |
| 6 | fait | tous les effets du monde en 3D : impacts (étoile + étincelles à la couleur de l'attaquant), poussière, ondes au sol (Carapace, Tourbillon), traînées du Bond, plumes (Pépin touché, Rafale), KO en nuage + étoiles, confettis à chaque capture, icônes de ressources qui s'élèvent à chaque production, queue de Patatras ; seuls les chiffres de dégâts restent du texte 2D | — |
| 7 | interface entièrement à revoir (identité, écrans), pas seulement harmonisée |
| 8 | chargement jusqu'à **10 s en 4G** |
| 9 | tests avec d'autres joueurs **sur le produit fini** seulement (choix assumé : pas de session intermédiaire) |

---

## Avancement (9 octobre 2026)

Le jeu est entièrement en 3D ; l'ancien rendu 2D est supprimé (D064).

| Étape | État | Fait | Reste |
| --- | --- | --- | --- |
| 0 | fait | commits du pipeline, des modèles, du code three.js | — |
| 1 | fait | D058 : monde en three.js, 60 i/s sur iPhone mini | — |
| 2 | presque fini | versions match (~12 000 triangles, `make_match.py`) ; attaques propres à chaque perso (poêle, râteau, recul, fourche) ; poses des 4 capacités ; saut de joie à la capture | Gaston sur charkit ; validation à l'œil des versions légères et des poses (victoire : Patatras se tapote le ventre, Pépin chante, Lorgnon fait la révérence, Gaston lève le poing) |
| 3 | fait | bible [docs/12](12_WORLD_ART_BIBLE.md) ; kit `art/world/lib/propkit.py` ; tonneau, caisse, rocher, clôture, mur en jeu | test en niveaux de gris à faire avec toi |
| 4 | fait | grange, scierie, carrière, forge avec drapeaux d'équipe ; lumière par carte (Canyon en fin de journée) ; sol peint (champs et cours autour des bases) | — (nom et moulin : D059 ; cartes redessinées : D060) |
| 5 | fait | monde 3D complet sous le HUD, caméra testée contre la 2D, match complet sans erreur | — (3D par défaut, modèles préchargés pendant la sélection) |
| 6 | commencé | KO en nuage + étoiles, plumes de Pépin touché, plumes tirées par Lorgnon, queue de Patatras qui se redresse (visible surtout dans la loupe) ; anciens effets 2D par-dessus en attendant | effets des capacités et des impacts en 3D |
| 7 | fait | kit d'interface ([docs/13](13_UI_STYLE.md)) : sélection, HUD, résultats avec le perso en 3D, loupe ; portraits 3D | — |
| 8 | fait | modèles compressés meshopt (22,2 → 8,3 Mo), écran de chargement, premier match ≈ 1,8 Mo soit 2 à 3 s en 4G ([PERFORMANCE.md](../PERFORMANCE.md)) | — |
| 9 | fait | rendu 2D supprimé, parties complètes jouées (sélection, match, résultats, rejouer, changer de perso ; ordinateur et iPhone mini émulé), docs à jour | tests avec d'autres joueurs |

## Étape 0 — Mettre le travail 3D à l'abri

Rien n'est commité aujourd'hui : un mauvais `git checkout` efface deux jours de travail.

```text
Commite le travail 3D en cours, en séparant :
1. le pipeline Blender (art/, .claude/skills/character-3d/, docs/10_CHARACTER_3D_PIPELINE.md) ;
2. les modèles générés (public/models/*.glb) — dis-moi d'abord leur poids total et si on devrait
   les ignorer dans git et les régénérer plutôt que les versionner ;
3. le code three.js et la loupe (src/rendering/three/, CharacterViewer, SelectScene, package.json).
Vérifie que chaque commit compile seul (tsc, tests, build) sur une copie séparée du dépôt.
```

Décisions (7 oct.) : les `.glb` sont versionnés ; la piste « marionnettes 2D refaites » (`puppet/characterAsset.ts`, `puppet/characters/`, vue de dos) est **abandonnée** et n'est pas commitée.

**Fini quand** : `git status` est propre et chaque commit compile.

---

## Étape 1 — La décision qui conditionne tout : comment la 3D entre dans le match

Deux voies possibles :

| | A. Monde en three.js temps réel | B. Sprites photographiés au chargement (prévu dans docs/10) |
| --- | --- | --- |
| Cohérence DA | **la même lumière et le même matériau pour tout**, par construction | à assurer à la main entre persos, bâtiments et décor |
| Animations | celles qui existent déjà (procédurales, expressions) | à figer : directions × poses × images |
| Visée à 360° | gratuite | autant de directions qu'on photographie |
| Coût | réécrire le rendu du monde (Phaser garde l'UI) | garder Phaser, ajouter un « studio photo » |
| Risque | performance mobile | mémoire des textures, animation saccadée |

**Recommandation : A.** La DA unique est l'objectif, et le monde 3D la donne gratuitement. La simulation ne change pas : elle est déjà séparée du rendu. Mais il faut **mesurer d'abord** sur téléphone, d'où un essai court.

```text
On se documente puis on construit. Fais un essai (spike) de la voie A, jetable, sur une branche :
- un canvas three.js derrière le canvas Phaser (Phaser ne garde que l'UI, fond transparent) ;
- caméra orthographique inclinée qui reproduit exactement src/rendering/projection.ts (TILT,
  pixelsPerUnit), pour que le sol 3D tombe sous les zones de capture actuelles ;
- le sol de la Prairie en simple plan, les 2 personnages du match chargés depuis public/models,
  placés et orientés depuis MatchState à chaque image (interpolation comme CharacterRenderer) ;
- mesure : images par seconde et temps de chargement sur ordinateur ET en émulation mobile, avec
  4 personnages à l'écran ; nombre de triangles et d'appels de dessin.
Rends-moi un tableau de mesures et ta recommandation A ou B, chiffres à l'appui. Ne touche pas à
la simulation.
```

Décisions (7 oct.) : appareils cibles = ordinateur **et iPhone mini** (écran 375 × 812 pt, le plus petit iPhone actuel : c'est lui qui fixe la lisibilité et le budget de performance) ; l'essai est **jetable**, sur une branche.

**Fini quand** : la décision est notée dans `DECISIONS.md` avec les mesures. *La suite de ce document suppose la voie A ; si c'est B, les étapes 3 à 6 deviennent « photographier » au lieu d'« afficher ».*

---

## Étape 2 — Personnages prêts pour le match

Les modèles font jusqu'à 300 000 triangles (budget de la loupe). En match, on en voit 2 à 8, petits.

```text
Utilise le skill character-3d. Rends les 4 personnages prêts pour le match :
1. une version légère par perso (cible de départ ~8 000 triangles, à confirmer avec les mesures de
   l'étape 1), générée par le même build.py, exportée à côté du modèle loupe ; contrôle automatique
   du budget dans le script ;
2. Gaston migré sur charkit (même squelette, mêmes noms d'os) ;
3. les retouches notées dans docs/10 §5 (foulard de Pépin, marmite de Patatras) ;
4. la liste complète des états à animer, branchés sur la simulation : repos, course, attaque
   mêlée (Patatras, Pépin, Gaston), tir (Lorgnon), touché, KO (« pouf », pas de violence),
   réapparition, joie à la capture, et la capacité de chacun (Carapace, Bond, Rafale,
   Tourbillon — voir D057), plus une pose de victoire signature par perso.
Une seule construction Blender à la fois. Vérifie chaque perso à la taille du jeu (caméra de match)
avant le gros plan, et note-le sur la grille §11 du skill.
```

**Fini quand** : les 4 versions légères passent leurs contrôles et chaque état est visible dans la loupe.

---

## Étape 3 — La bible DA étendue au monde

Avant de modéliser un seul bâtiment, on fixe les règles communes. Sinon chaque objet aura sa DA.

```text
On se documente puis on construit. Étends la DA des personnages (docs/10, skill character-3d) au
monde entier, dans un nouveau docs/12_WORLD_ART_BIBLE.md :
- lumière unique du jeu (direction, couleur, ombre teintée), matériau partagé avec les persos
  (src/rendering/three/toon.ts), contour, occlusion ;
- palette du monde : sol, végétation, bois, pierre, métal ; règle stricte : les couleurs
  d'équipe (bleu/rouge) ne servent qu'à l'appartenance (drapeaux, anneaux), jamais au décor ;
- échelle : un personnage = référence ; hauteur des bâtiments, rochers, clôtures en multiples ;
- lisibilité : chaque type de base reconnaissable à sa silhouette seule, vue de la caméra de jeu ;
- budget de triangles et de matériaux par catégorie d'objet.
Cherche comment Supercell construit les décors de Clash Royale / Brawl Stars (dis-moi ce que tu
as lu en entier et ce qui n'est qu'un extrait). Puis fais un kit Blender pour les objets
(art/world/lib/propkit.py, sur le modèle de charkit), et un objet témoin : un tonneau, rendu à
côté de Gaston pour valider que les deux vont ensemble.
```

**Fini quand** : le tonneau et Gaston côte à côte « vont ensemble » à la caméra de jeu, et la bible est validée.

---

## Étape 4 — Bases et décor en 3D

```text
Avec propkit et docs/12, modélise le monde, un objet à la fois, chacun avec sa planche de
contrôle :
1. les 5 bâtiments de base (grange/nourriture, scierie/bois, carrière/pierre, forge/métal,
   moulin/puissance), avec ce qui doit changer selon l'état : neutre, équipe A, équipe B,
   contestée, en capture (drapeau, anneau au sol, jauge) — les symboles d'équipe ne doivent pas
   reposer sur la couleur seule (docs/02) ;
2. les obstacles réels des 3 cartes (src/data/maps.ts) : rochers, haies, clôtures, tonneaux —
   leur forme 3D doit coller à leur forme de collision ;
3. le sol de chaque carte (Prairie, Canyon, Quatre-Coins) et la bordure du plateau-diorama ;
4. le sol propre à chaque zone de base (champ de blé, potager, sciure…).
Ne change aucune donnée de jeu : la 3D suit les dimensions de la simulation.
```

**Fini quand** : les 3 cartes sont visibles en 3D avec leurs bases dans tous les états, sans écart avec les collisions.

---

## Étape 5 — Le match branché sur la 3D

```text
Remplace le rendu du monde du match par three.js, à partir de l'essai de l'étape 1 :
- un renderer par système, comme aujourd'hui (carte, bases, personnages, projectiles), qui lit
  MatchState et ne l'écrit jamais ;
- les personnages animés depuis l'état (vitesse, visée, attaque, capacité, touché, KO,
  réapparition, capture) ;
- la caméra suit le joueur comme maintenant ; le zoom s'adapte à l'écran (computeCameraZoom) ;
- la visée souris et tactile reste juste (screenToWorldDirection doit correspondre à la caméra 3D) ;
- l'ancien rendu 2D reste disponible derrière ?renderer=2d le temps de la validation, puis est
  supprimé à l'étape 9 (décision : pas de mode de secours).
Vérifie en jouant : contre le bot Normal sur les 3 cartes, sur ordinateur et en mobile portrait.
```

**Fini quand** : une partie entière se joue en 3D, sans régression des tests ni de la visée.

---

## Étape 6 — Effets et capacités dans la même DA

```text
Refais les effets de combat dans la DA 3D (docs/12), en restant léger (pool fixe, rien de créé
pendant un combat, comme CombatFx) : impact, nombres de dégâts, poussière, projectiles de
Lorgnon (plumes), « pouf » de KO, capture et production de ressources, et les 4 capacités
(bulle de Carapace, traînée du Bond, éventail de Rafale, onde du Tourbillon). Chaque effet doit
se lire en 0,2 s à la taille du téléphone.
```

**Fini quand** : chaque action du jeu a un retour visuel lisible dans le style des personnages.

---

## Étape 7 — Interface et écrans harmonisés

```text
Harmonise toute l'interface avec la DA 3D, sans modale pendant le combat (docs/02) :
- icônes des 5 ressources et des 5 améliorations rendues depuis de petits modèles 3D (même
  lumière), puis figées en images ;
- portraits des persos rendus depuis leurs modèles (mini-carte, résultats) ;
- boutons d'amélioration et de capacité, chrono, bandeaux, typographie : une seule famille de
  formes et de couleurs ;
- écran de sélection et écran de résultats avec la pose de victoire du gagnant ;
- lisibilité vérifiée en mobile portrait (375 px) et paysage.
```

**Fini quand** : aucune capture d'écran ne mélange l'ancien style 2D et le nouveau.

---

## Étape 8 — Chargement et performance

```text
Mesure puis optimise (docs/05 : on mesure d'abord) : temps de chargement (cible : 5–6 s acceptés),
images par seconde en match sur ordinateur et en émulation mobile, mémoire GPU. Ajoute un écran
de chargement dans la DA. Compresse les modèles (Draco ou meshopt) si les mesures le justifient.
Mets à jour PERFORMANCE.md avec les chiffres avant/après.
```

**Fini quand** : budgets tenus et notés dans `PERFORMANCE.md`.

---

## Étape 9 — Nettoyage et partie de bout en bout

```text
Supprime l'ancien rendu 2D devenu inutile (marionnettes, art dessiné en code) une fois le 3D
validé, en gardant ce qui sert encore. Puis joue une partie complète en local : sélection, match
de 7 min contre chaque niveau de bot, résultats, revanche, changement de perso. Liste tout ce qui
casse ou détonne avec la DA, corrige, et mets à jour README, CHANGELOG et DECISIONS.
```

**Fini quand** : `npm run dev`, une partie complète se joue sans accroc, et tout est commité.

---

## Garde-fou

Choix assumé (7 oct.) : les tests avec d'autres joueurs se font sur le produit fini. Conséquence à garder en tête : si ces tests remettent en cause une règle (ressources, capacités, cartes), les écrans et le décor qui en dépendent seront à reprendre.

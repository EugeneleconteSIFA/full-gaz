# Ajouter un personnage

Procédure pour faire entrer un personnage dans le jeu, une fois son modèle 3D validé
(skill `character-3d`, docs/10). Le test `src/tests/roster.test.ts` échoue tant qu'une étape
manque : `npm test` dit laquelle.

À ce jour : **Marguerite** (vache, `art/characters/cow`, « artillerie » en hypothèse) et
**Bernadette** (brebis, `art/characters/sheep`, « soutien » en hypothèse) sont modélisées mais
pas encore dans le roster. Un troisième personnage reste à créer.

## 1. Modèle 3D

1. `art/characters/<model>/build.py` → `art/out/models/<model>.glb` (version vitrine).
2. Version match : `blender -b -P art/characters/lib/make_match.py -- <model> [budget] [bouche]`
   → `<model>.match.glb`. La bouche est celle de l'expression signature
   (placide → `smile`, teigneux → `smirk`).
3. `npm run models:pack` → `public/models/<model>.glb` et `<model>.match.glb`.
4. Aperçu avant l'entrée dans le roster : visionneuse avec `?model=<model>`.

## 2. Apparence — `src/rendering/characterArt.ts`

- `MODEL_ART.<model>` : style d'attaque (`thrust`, `smash`, `sweep`, `shoot`) et expression
  signature (gardée tout le match). Déjà fait pour `cow`.
- `CHARACTER_MODEL.<id>` : une ligne, id gameplay → modèle.

Le match, l'écran de sélection, les portraits, l'écran de résultat, la visionneuse, le lab et le
préchargement lisent tous cette table : rien d'autre à brancher côté rendu.

## 3. Gameplay — `src/data/characters.ts`

Une entrée `character(id, nom, rôle, accroche, stats)` à la fin de `CHARACTERS` (les 4 d'origine
gardent leur ordre). Stats à poser face au `BASELINE` (100 PV, 20 dégâts, portée 7, vitesse 6).

L'attaque spéciale prend un `kind` existant (`guard`, `dash`, `volley`, `spin`). Une **nouvelle**
capacité (ex. le tir en cloche de Marguerite, le ralentissement de Bernadette) demande en plus :

- son type dans `src/data/abilities.ts` (ajouté à `AbilityDefinition`) ;
- son effet dans la simulation (`src/core/`), sa validation (`src/data/validateGameData.ts`) ;
- son usage par les bots (`src/gameplay/bots/`) ;
- son animation (`AbilityMotion`, `src/rendering/three/gltfCharacter.ts`) et ses effets
  (`src/rendering/world3d/Fx3D.ts`).

Même chose pour un nouveau type d'attaque de base (aujourd'hui `melee` ou `ranged`).

## 4. Bots — `src/data/bots.ts`

`BOT_UPGRADE_PRIORITIES.<id>` : ordre d'achat des 5 améliorations, la force du perso d'abord.

## 5. Contrôle

- `npm test` (dont `roster.test.ts`) et `npm run typecheck`.
- `npm run balance` : le tournoi de bots, à régler jusqu'à un taux de victoire raisonnable
  (docs/08).
- Écran de sélection en portrait : au-delà de 4 persos il passe à 3 cartes par rangée.

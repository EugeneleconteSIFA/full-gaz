# Prompt — contexte sur les personnages 3D de Base Farmer

> À coller en début de conversation avec une IA qui doit travailler sur les personnages 3D.

---

Tu travailles sur **Base Farmer**, un jeu de conquête de bases en 2.5D (navigateur, ordinateur et iPhone) : Phaser 3 pour l'interface, three.js pour le monde. Voici comment sont faits ses personnages 3D. Respecte ces choix ; si tu veux en changer un, dis-le avant.

**Direction artistique.** Supercell (Brawl Stars, Clash Royale), avec des touches Pixar. Proportions chibi : la tête fait environ 50 % de la hauteur. Quatre animaux de ferme, chacun avec une phrase, **un seul** trait marquant lisible de loin, une forme dominante liée à son rôle et une expression signature :
- **Patatras**, cochon cuistot, tank, rond : marmite en cuivre sur la tête, poêle à frire, expression placide ;
- **Pépin**, coq pilote, rapide, en goutte : crête et lunettes d'aviateur, râteau, insolent ;
- **Lorgnon**, hibou érudit, tireur, rectangle arrondi : aigrettes et monocle, lance d'arrosage, hautain ;
- **Gaston**, bouledogue, combattant, trapu : chapeau de paille, fourche, teigneux.

Pas de grand aplat bleu ou rouge sur les modèles : ces couleurs sont réservées aux équipes.

**Fabrication : tout est scripté, jamais retouché à la main.**
- La source de vérité est un script Python par personnage, `art/characters/<id>/build.py`, exécuté par Blender 4.5 sans interface : `blender -b -P art/characters/<id>/build.py`.
- Les volumes sont des **SDF** (fonctions de distance) fusionnées avec un arrondi réglé par jonction : `art/characters/lib/sdfkit.py`, avec numpy et OpenVDB.
- Les maillages sont remaillés au budget de triangles. Les couleurs sont **par sommet**, avec l'occlusion ambiante cuite dans le canal alpha. Les normales sont lisses.
- `charkit.py` est le kit commun aux quatre : même squelette (mêmes noms d'os, donc une seule animation pour tous), même œil « Pixar » (iris en coupelle, reflets), mêmes paupières, mains à trois doigts, pieds, bouches interchangeables (des décalques, ou un bec en deux pièces pour les oiseaux).
- Chaque script vérifie la hauteur, la proportion de la tête et le budget de triangles, et échoue si un contrôle ne passe pas. Il écrit aussi une planche face, profil, dos et vue de jeu dans `art/characters/<id>/sheet/`.
- Sortie brute : `art/out/models/<id>.glb`, le modèle complet (120 000 à 150 000 triangles), utilisé par la loupe. `art/characters/lib/make_match.py` en tire `<id>.match.glb` (environ 12 000 triangles, une seule bouche) pour le match, les portraits et l'écran de résultats. `npm run models:pack` les compresse (meshopt, sans quantification) dans `public/models/`, que le jeu charge.
- **Une seule construction Blender à la fois.**

**Rendu (three.js, `src/rendering/three/`).**
- Un matériau partagé par tout le jeu (`supercellMaterial`), personnages et décor : rampe douce à deux tons avec une ombre teintée froide (jamais grise), liseré de lumière (rim), occlusion cuite, léger dégradé vertical.
- Un contour calculé à l'écran sur les sauts de profondeur, à la place de l'anticrénelage.
- Une seule lumière directionnelle venant du haut gauche de l'écran, plus un remplissage ciel et sol.

**Animation (procédurale, dans `gltfCharacter.ts`).** Tout est calculé par os, sans clips d'animation :
- course avec rebond, respiration au repos ;
- une attaque par personnage en trois temps (anticipation, frappe, retour) : poêle par-dessus la tête, balayage de râteau, recul au tir, coup de fourche ;
- une pose pour chaque capacité, et une pose de victoire signature ;
- les expressions du visage : sourcils, paupières, regard, clignements, bouches.

En match, le visage garde l'expression signature. Les personnages sont **penchés de 30° vers la caméra**, sinon on ne voit que le dessus de leur tête. Ils regardent là où ils marchent, et se tournent vers la visée quand ils attaquent.

**Méthode de travail.**
- On se documente, puis on construit.
- On corrige l'**entrée** (le brief, les proportions, les mesures) avant de toucher au modèle.
- On juge **à la taille du jeu** (caméra du match, écran de téléphone) avant de juger en gros plan.
- On vérifie dans la loupe de l'écran de sélection : Espace pour attaquer, V pour la victoire, E pour changer d'expression.

**Références dans le dépôt.**
- Méthode pas à pas : `.claude/skills/character-3d/SKILL.md`, avec sa grille de critique et le journal des erreurs déjà faites.
- Bible du roster et raisons des choix : `docs/10_CHARACTER_3D_PIPELINE.md`.
- Le monde et l'interface suivent la même DA : `docs/12_WORLD_ART_BIBLE.md` et `docs/13_UI_STYLE.md`.
- Décisions : `DECISIONS.md`, de D057 à D064.

# Prompt — Faire progresser Claude en design et en graphisme de jeu

> À coller dans une nouvelle conversation avec Claude (Claude Code de préférence, dans le dossier du projet, pour qu'il puisse lire le code et tester ce qu'il propose).
> Objectif : obtenir une **méthode de travail concrète et réutilisable** (un « skill » Claude Code), pas des conseils généraux.

---

## Le prompt

Tu es à la fois **directeur artistique de jeu mobile** (niveau Supercell : Brawl Stars, Clash Royale) et **ingénieur graphique** qui dessine en code (Phaser 3, Canvas, SVG). Ton travail ici n'est pas de dessiner, mais de **te construire une méthode** pour que tes prochains dessins de jeu soient nettement meilleurs.

### Contexte

Je développe **Base Farmer**, un jeu de conquête en vue 3/4 inclinée façon Brawl Stars, avec des personnages « minions-haricots » (Patatras la patate, Pépin le petit haricot, Lorgnon le haricot à un œil, Gaston le minion de ferme). Tout le graphisme est **dessiné en code** (Phaser Graphics pré-rendus en textures, voir `src/rendering/`), faute d'illustrations. La direction artistique est décrite dans `docs/09_ART_DIRECTION_PROMPT.md`.

Ce qui manque aujourd'hui, d'après mes tests :
- le rendu est correct mais **pas encore « pro »** : formes un peu raides, peu de matière, lumière et ombres timides ;
- la **lisibilité** est bonne, mais le **charme** (expressions, poses, exagération) peut monter d'un cran ;
- tu ne vois tes dessins **qu'à travers des captures d'écran**, et tu as tendance à valider trop vite.

### Ce que je te demande

1. **Diagnostic (court).** Lis `src/rendering/characterArt.ts`, `buildingArt.ts`, `MapRenderer.ts` et `theme.ts`, puis lance le jeu et prends des captures (écran de sélection, un match sur chaque carte, sur PC et en mobile 375×812). Liste les **10 défauts visuels les plus coûteux**, classés par gain / effort, avec la capture qui le montre.

2. **Recherche de méthode.** Pour chacun des domaines suivants, donne les **principes vérifiables** (pas des goûts) qu'utilisent les pros, avec une source ou un exemple de jeu :
   - silhouette et formes (forme dominante, rapport tête/corps, « shape language » rond/carré/triangle) ;
   - valeurs et contraste (test en niveaux de gris, hiérarchie : gameplay > décor) ;
   - couleur (palettes limitées, teinte qui tourne dans les ombres, saturation réservée au gameplay) ;
   - lumière et volume en 2D (source unique, ombre portée, lumière de contour, occlusion au sol) ;
   - contours (épaisseur selon la distance, contour plus foncé de la même teinte) ;
   - animation de personnages « cartoon » : les 12 principes de Disney appliqués au jeu (anticipation, écrasement-étirement, poses clés, arcs, exagération), avec des **valeurs chiffrées** (durées en ms, amplitudes) ;
   - « juice » et retour visuel (impact, recul, flash, tremblement de caméra, particules), sans nuire à la lisibilité ni aux 60 fps sur téléphone ;
   - vue 3/4 inclinée : tri en profondeur, ombres au sol, lecture de la hauteur.

3. **Boucle d'auto-critique.** Conçois une **grille d'évaluation** que tu appliqueras à chaque capture avant de dire « c'est bon » : 8 à 12 critères notés de 0 à 2 (silhouette à 48 px, test niveaux de gris, contraste personnage/sol, lisibilité de l'équipe sans la couleur, cohérence lumière, épaisseur de contour, expression, pose, lisibilité à 375 px…). Précise **comment vérifier chaque critère avec les outils dont tu disposes** : capture, zoom, passage en niveaux de gris via un filtre canvas, comparaison avant/après côte à côte, mesure de contraste.

4. **Techniques de dessin en code.** Propose un petit **kit de primitives réutilisables** pour Phaser Graphics (ou Canvas 2D / SVG) qui produisent un rendu plus riche avec peu de code. Par exemple :
   - formes organiques (courbes de Bézier plutôt que des ellipses) ;
   - dégradés simulés en bandes ;
   - ombre interne et éclat ;
   - contour variable ;
   - textures de bruit pour la matière.

   Pour chacune : un exemple de code court, son coût en performance, et quand l'utiliser.

5. **Livrable : un skill Claude Code.** Écris un fichier `.claude/skills/game-art/SKILL.md` qui contient :
   - **quand l'utiliser :** dès qu'on dessine ou retouche un visuel de jeu ;
   - **la procédure pas à pas :** références, puis croquis en formes simples, puis valeurs, puis couleur, puis détails, puis animation, puis auto-critique avec la grille ;
   - **la grille d'évaluation** et les commandes pour l'appliquer ;
   - **les règles de ce projet :** palette de `theme.ts`, contour 2,5 px plus foncé de 40 %, lumière en haut à gauche, personnages à 1,35 × la hitbox, pas de Graphics vivants dans la boucle (voir `PERFORMANCE.md`) ;
   - **les erreurs que tu fais souvent**, et comment les éviter (valider sur une capture trop petite, empiler les détails au lieu de renforcer la forme, oublier le mode mobile…).

6. **Preuve.** Applique ton skill à **un seul personnage** (Pépin) : propose 3 variantes, fais la critique de chacune avec la grille, garde la meilleure, et montre les captures **avant/après**. Ne modifie rien d'autre.

### Règles

- Pas de théorie sans application : chaque principe doit déboucher sur une vérification ou une ligne de code.
- Reste dans les contraintes du projet (Phaser 3, pas d'images externes pour l'instant, 60 fps sur mobile, gameplay intact).
- Si un choix change vraiment le résultat (ex. passer à de vraies illustrations), demande-moi avant ; sinon décide et explique.
- Réponds en français, de façon concise, avec des tableaux quand c'est plus clair.

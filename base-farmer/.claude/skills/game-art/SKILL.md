---
name: game-art
description: Méthode pour dessiner ou retoucher un visuel de jeu en code (Phaser Graphics pré-rendus, Canvas, SVG) dans Base Farmer — personnages, bâtiments, décor, effets. À utiliser dès qu'on crée ou modifie un fichier de src/rendering/ qui dessine quelque chose, ou qu'on juge un rendu sur capture.
---

# Game art en code — Base Farmer

Règle d'or : **on renforce la forme avant d'ajouter du détail**, et **on ne dit jamais « c'est bon » sans avoir passé la grille (§4) sur une capture à taille réelle ET en niveaux de gris**.

## 1. Règles du projet (non négociables)

| Règle         | Valeur                                                                                                                                                                                                      | Où                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Palette       | uniquement `THEME` (`src/rendering/theme.ts`) ; une nouvelle couleur entre dans `THEME` avec un commentaire                                                                                                 | theme.ts          |
| Contour       | 2,5 px (`THEME.character.outlineWidthPx`), couleur = même teinte 40 % plus foncée : `darker(c, 0.6)` (corps : `darker(shade, 0.55)`)                                                                        | characterArt.ts   |
| Lumière       | **haut-gauche** : face éclairée en haut à gauche, ombre propre et contour plus épais en bas à droite, ombre portée décalée de `THEME.shadow.offsetPx`                                                       | artKit `volume()` |
| Échelle perso | dessin = 1,35 × hitbox (`figureScale`), (0,0) entre les pieds, unités en multiples de `r`                                                                                                                   | characterArt.ts   |
| Équipe        | couleur d'équipe sur **une** pièce de vêtement + symbole (cercle / losange), jamais la couleur seule                                                                                                        | teamSymbol()      |
| Perf          | **aucun Graphics vivant dans la boucle** : tout passe par `bakeTexture()` (bake.ts) ou `cachedGraphics.ts` ; un dessin se cuit une fois, s'anime par transformations d'Image (scale, angle, position, tint) | PERFORMANCE.md    |
| Vue           | sol écrasé × 0,72 (`rendering.tilt`) ; ce qui est debout est dessiné de face, ancré au pied                                                                                                                 | projection.ts     |
| Pupilles      | images séparées (`PUPIL_KEY`) posées sur `FigureSpec.eyes` : le blanc doit rester visible autour (rayon blanc ≥ 1,6 × rayon pupille)                                                                        | characterArt.ts   |

## 2. Procédure

1. **Références (2 min).** Nommer 2 jeux et ce qu'on leur prend (ex. Brawl Stars : silhouette, contour sombre, ombre au sol ; Minions : gros yeux, lunettes). Écrire l'intention en une phrase (« Pépin : petit, rapide, insolent »).
2. **Croquis en formes simples.** 1 forme dominante + 2 secondaires max. Choisir la forme selon le rôle (rond = sympa/tank, carré = solide, triangle = rapide/agressif). Placer les points de contrôle en `r` ; inclinaison ou asymétrie dès ce stade (un corps penché de 8 à 15° = vitesse).
3. **Valeurs.** Trois paliers seulement : clair (éclat), moyen (corps), sombre (ombre + contour). Vérifier la planche en niveaux de gris (§5) _avant_ de toucher aux couleurs.
4. **Couleur.** Le gameplay est saturé, le décor désaturé. L'ombre tourne vers le froid ou vers une teinte plus profonde (pas du simple noir). Mesurer le contraste perso/sol sur les 3 biomes.
5. **Détails.** Uniquement ceux qui survivent à 48 px : yeux, bouche, symbole d'équipe, un accessoire signature. Tout le reste part.
6. **Animation.** Poses clés d'abord (repos, course, tir, coup, victoire), puis le timing (§3.6). Tout passe par les transformations de l'Image cuite.
7. **Auto-critique.** Grille §4 sur : planche agrandie, taille réelle, niveaux de gris, capture de match PC **et** 375×812. Note < 18/24 → retour à l'étape 2 ou 3, pas à l'étape 5.

Pour une refonte : **3 variantes** (polissage seul / nouvelle pose / nouvelle pose + palette), notées avec la grille, puis on garde la meilleure et on supprime les autres.

## 2 bis. Analyse de référence (avant tout nouveau chantier)

On ne copie pas une capture de référence, on la **décompose en mesures**, puis on écrit l'écart avec notre jeu dans un tableau. Exemple : la capture Brawl Stars fournie par l'utilisateur, comparée à Base Farmer.

| Couche                   | Brawl Stars (mesuré sur la capture)                                                            | Base Farmer aujourd'hui  | Outil                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------- |
| Sol                      | 2 tons + **dalles** irrégulières (≈ 1 tous les 2 wu), fissures, bord en falaise avec épaisseur | 1 ton + taches floues    | `prop_paver` + `scatter` (§8), grain                |
| Décor bas (non bloquant) | touffes d'herbe, petits cailloux, partout                                                      | quelques brins           | nuée de décor cuite dans le RenderTexture du sol    |
| Couvert (gameplay)       | **blés / buissons hauts**, en blocs de 2×3 wu, saturés, chauds                                 | aucun                    | `prop_wheat` (cacher = futur mécanisme : à valider) |
| Obstacles                | clôtures, caisses, tonneaux : volumes lisses, AO au sol                                        | murs plats, disques gris | `prop_crate`, `prop_barrel`, `shadeVolume`          |
| Bords                    | falaises, cactus, barrières qui cadrent                                                        | haie plate               | à faire : `cliffEdge`                               |
| Persos                   | modèles 3D : dégradé radial, éclat spéculaire, AO, contour fin sombre                          | aplats Graphics          | `shadeVolume` (canvasBake)                          |
| Densité                  | ≈ 40 à 60 % de la surface habillée                                                             | < 5 %                    | règle de densité (§8)                               |
| Valeurs                  | sol clair et chaud, persos plus sombres et très saturés, cercle d'équipe au sol                | persos ≈ sol             | critère 3                                           |

Procédure : 1) lister les couches de la référence ; 2) compter (densité, nombre de tons, épaisseur du contour en % de la hauteur du perso) ; 3) remplir la colonne « aujourd'hui » à partir de notre capture **au même zoom** ; 4) choisir **une seule** ligne à traiter par itération, celle qui a le plus d'impact.

## 3. Principes vérifiables

### 3.1 Silhouette et formes

- Lisible en aplat noir à 48 px : chaque perso doit être reconnaissable par sa seule silhouette (test Team Fortress 2, Valve, « Illustrative Rendering in TF2 », 2007). → `artLabSilhouette` ci-dessous.
- Rapport tête/corps : en « chibi » ou en haricot, la tête _est_ le corps ; les yeux occupent 30 à 45 % de la largeur (Brawl Stars, Minions).
- Forme dominante = 60 % ou plus de l'aire ; les accessoires cassent le contour (lunettes au sommet, écharpe qui dépasse) sans le noyer.
- Aucune paire de persos ne doit partager la même forme dominante _et_ la même hauteur.

### 3.2 Valeurs et contraste

- Test en niveaux de gris : le perso se détache du sol sans la couleur (contour ou corps ; viser un rapport de luminance contour/sol ≥ 3:1).
- Hiérarchie : perso et projectiles > bases et zones > obstacles > sol. Le sol reste dans la moyenne des valeurs et en basse saturation (déjà le cas pour les 3 biomes).
- La moyenne de luminance du sprite n'est **pas** un bon indicateur : les pupilles et le contour la tirent vers le bas. Juger la planche grise à l'œil et mesurer le contour.

### 3.3 Couleur

- 3 à 5 teintes par objet. Ombre = teinte décalée (hue shift) et plus saturée, pas `× 0,5` en gris : utiliser `mix(fill, colder, t)`.
- La saturation est réservée au gameplay. Un perso dont le corps a la teinte du biome (vert sur la Prairie) doit gagner en saturation ou en écart de valeur.
- Daltonisme : jamais d'information portée par la couleur seule (symboles d'équipe).

### 3.4 Lumière et volume en 2D

- Une seule source, en haut à gauche, pour _tout_ (persos, bâtiments, rochers, ombres portées).
- Quatre couches : ombre propre (bas-droite), bande intermédiaire, cœur éclairé décalé vers la lumière, éclat ; plus un **rebond de lumière** fin sur le bord bas-droit (bounce light) et une occlusion de contact sous les pieds.
- L'ombre portée au sol est une ellipse écrasée × 0,72, décalée vers le bas-droit, alpha 0,3 à 0,4.

### 3.5 Contours

- Contour = même teinte, 40 % plus foncée, jamais noir pur (sauf pupilles).
- Plus épais du côté de l'ombre (+20 à 50 %), plus fin sur les détails intérieurs (0,6 à 0,8 ×).
- Plus fin pour ce qui est loin ou secondaire (décor ≈ 0,8 ×, sol sans contour).

### 3.6 Animation cartoon (12 principes de Disney, Thomas & Johnston 1981)

| Principe                | Valeur pour ce jeu                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Anticipation (tir/coup) | 60–100 ms, recul de 4–8 % en sens inverse                                                            |
| Écrasement-étirement    | ±8–15 % sur un axe, volume conservé (sx × sy ≈ 1) ; impact : 80–120 ms                               |
| Rebond de marche        | 4–6 px, cycle lié à la distance parcourue (`walkCyclesPerUnit`)                                      |
| Respiration au repos    | ±3 % de l'échelle, 0,7–1 Hz                                                                          |
| Clignement              | 100–150 ms toutes les 2,5–4 s, rythme irrégulier                                                     |
| Arcs                    | les sauts suivent une parabole (sin), jamais un aller-retour linéaire                                |
| Ralenti début/fin       | easeOut à l'attaque, easeIn au retour ; `Back.easeOut` pour les « pops »                             |
| Exagération             | joie de capture : saut de 12–20 px + étirement de 15 % ; mort : « pouf » de 6 bouffées en 350–450 ms |
| Mouvement secondaire    | écharpe et pousse décalées de 1 à 2 frames (80–120 ms)                                               |

### 3.7 « Juice » sans perdre la lisibilité ni les 60 fps

- Flash blanc à l'impact : 60–90 ms (`hitFlashMs`), via `setTintFill`, sans nouvelle texture.
- Recul de l'arme : 3–5 px, 80–100 ms. Tremblement de caméra : seulement pour le joueur local, 80–150 ms, amplitude ≤ 0,004 (`camera.shake`), jamais sur un tir ordinaire.
- Particules : au plus 6 à 12 par événement, pool réutilisé, durée ≤ 700 ms, textures cuites. Rien qui couvre l'anneau d'équipe ou la barre de vie.
- Budget : ≤ 2 ms par frame pour le rendu sur un téléphone moyen ; mesurer avec le snippet de PERFORMANCE.md.

### 3.8 Vue 3/4 inclinée

- Tri en profondeur par le y du pied (`depthAt`) ; un objet haut se découpe en tranches (murs).
- Toute chose debout a une ombre au sol, ce qui fait lire sa hauteur ; les projectiles volent à `flightHeightPx` avec leur ombre au sol.
- L'emprise au sol = la hitbox écrasée ; le volume ne déborde que vers le haut.

## 4. Grille d'auto-critique (0 = raté, 1 = moyen, 2 = bon)

| #   | Critère                              | Comment le vérifier                                                                          |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | Silhouette reconnaissable à 48 px    | vignette 48 px de `artLab` + `artLabSilhouette`                                              |
| 2   | Lecture en niveaux de gris           | colonne grise de `artLab`, puis `artLabGray(true)` en match                                  |
| 3   | Contraste perso/sol sur les 3 biomes | vignettes Prairie/Canyon/Quatre-Coins ; contour ≥ 3:1                                        |
| 4   | Équipe lisible sans la couleur       | vignette grise teamA à côté de teamB : le symbole se distingue                               |
| 5   | Lumière cohérente (haut-gauche)      | ombre propre en bas à droite, éclat en haut à gauche, ombre portée vers le bas-droit         |
| 6   | Contour (épaisseur, teinte)          | planche × 3 : pas de noir pur, plus épais côté ombre, pas de trait < 1 px à la taille réelle |
| 7   | Expression                           | à taille réelle, on lit une émotion (sourcils, bouche) ; blancs visibles autour des pupilles |
| 8   | Pose / attitude                      | la planche dit le rôle sans texte (penché = rapide, large = tank)                            |
| 9   | Économie de détail                   | rien qui devienne de la bouillie à 48 px ; ≤ 1 accessoire signature                          |
| 10  | Lisibilité à 375×812                 | capture mobile : perso, anneau, barre de vie lisibles, rien sous le HUD                      |
| 11  | Cohérence avec le reste              | planche côte à côte avec les autres persos : même famille, même lumière                      |
| 12  | Coût                                 | 0 Graphics vivant ajouté, `npx tsc --noEmit` et tests OK                                     |

**Seuil : ≥ 18/24 et aucun 0.** Toujours comparer **avant/après côte à côte** dans la même planche.

## 5. Outils et commandes

Le pane navigateur ne sait pas zoomer sur une région et, quand il est caché, n'avance pas les frames. Les captures ont aussi un retard d'une frame : **toujours prendre deux captures** après un changement. D'où :

```js
// 1) Charger le labo (dans javascript_tool, sur le serveur de dev) :
eval(await fetch("/.claude/skills/game-art/artlab.js?" + Date.now()).then((r) => r.text()));
// 2) Faire avancer un match caché (le joueur apparaît après le compte à rebours) :
const g = window.__game;
let t = performance.now();
for (let i = 0; i < 600; i++) {
  t += 16.7;
  g.step(t, 16.7);
}
// 3) Cuire tous les persos et afficher la planche (grand, gris, 48 px sur 3 biomes + UI) :
const ca = await import("/src/rendering/characterArt.ts");
const sc = g.scene.getScene("match");
for (const id of ["tank", "scout", "shooter", "fighter"])
  for (const tm of ["teamA", "teamB"]) ca.ensureCharacterTextures(sc, id, tm, 21.6);
artLab(["char_scout_body_teamA", "char_scout_body_teamB"], {
  scale: 2,
  bake: (await import("/src/rendering/bake.ts")).BAKE_SCALE,
});
artLabClose();
artLabGray(true);
```

- **Rebake après une modification** : `g.textures.remove(key)` avant `ensureCharacterTextures`, sinon `bakeTexture` garde l'ancienne.
- **Variantes** : cuire chaque variante, copier la texture sous une autre clé (`textures.addCanvas('pepin_B', canvas)`), puis `artLab(['pepin_old','pepin_B',…])` pour tout voir dans la même planche.
- **Pupilles sur la planche** : la texture du corps n'a pas les pupilles. Les dessiner sur la copie aux positions `FIGURES[id].eyes` avant de juger l'expression.
- URLs de match : `/?character=scout&map=meadow|canyon|corners&opponent=dummy|normal&seed=5`.
- Mobile : `resize_window` preset `mobile`, puis recharger.

### Canvas 2D (`src/rendering/canvasBake.ts`) — le rendu « 3D lisse »

Phaser Graphics ne fait que des **aplats** : impossible d'obtenir un rendu lisse avec. Pour tout ce qui doit avoir du volume (persos, accessoires, bâtiments), on dessine en Canvas 2D, cuit une seule fois en texture. Le coût par frame est le même : c'est une Image.

| Fonction                                                                      | Effet                                                                                                        | Coût                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `bakeCanvas(scene, key, w, h, ctx => …)`                                      | même contrat que `bakeTexture`, mais avec dégradés, flou, modes de fusion, masques                           | cuisson : 0,2 à 2 ms par texture                                     |
| `shadeVolume(ctx, pts, cx, cy, rad, {light, mid, dark, outline, rim, gloss})` | volume rond : dégradé radial décalé vers la lumière, rebond de contour (`screen`), éclat spéculaire, contour | cuisson seulement                                                    |
| `contactShadow(ctx, x, y, w)`                                                 | occlusion douce au sol, écrasée par l'inclinaison                                                            | cuisson seulement                                                    |
| `grain(ctx, x, y, w, h, cell, alpha, seed)` + `valueNoise`                    | matière (bois, pierre, tissu) sans scintillement                                                             | cuisson : proportionnelle à la surface ; à éviter au-delà de 256×256 |
| `pathOf(ctx, pts)`                                                            | trace un `blob()` d'artKit pour le remplir, le contourer ou le masquer                                       | gratuit                                                              |

| `relight(scene, key, {light, shade, base})` | passe de lumière haut-gauche + pied assombri sur une texture **déjà cuite** (Graphics ou Canvas) : gain de volume immédiat sur l'existant | une fois par clé, à la cuisson |

Ce qui fait vraiment « 3D » (retour utilisateur : un dégradé doux ne suffit pas) :

- un **écart de valeurs franc** : presque blanc côté lumière, ombre profonde et froide (violette) de l'autre côté ;
- une **ligne d'ombre propre** (terminateur) : la forme moins une copie décalée vers la lumière, légèrement floutée ;
- une **lumière réfléchie** à l'intérieur du bord sombre, de l'**occlusion** en bas et aux jonctions, des **ombres portées** entre les pièces (avant-toit sur le mur, chapeau sur le front) ;
- un **reflet net** avec un halo sur le brillant (acier, laiton, verre), aucun sur le mat (patate, tissu).
  `shadeVolume` fait tout cela d'un seul appel ; les personnages sont dans `characterBodies.ts`.

Leçons mesurées :

- **Tampons** : un détail répété des centaines de fois (touffe, fleur, caillou) se dessine en 3 à 6 variantes dans un petit canvas, puis se copie avec `drawImage` (÷ 3 sur le coût de la peinture du sol).
- Ne jamais `textures.remove()` une texture encore affichée (crash `glTexture` de null) : utiliser une autre clé pour les mesures.
- Une passe `relight` éteint les sources lumineuses (feu de la forge) : garder `shade` ≤ 0,15 sur les bâtiments.

Règles : `gloss` 0 pour la matière mate (patate, tissu), 0,5 ou plus pour la matière brillante (verre, métal) ; l'ombre `dark` doit être **décalée en teinte** (plus froide ou plus profonde) ; contour de 2,5 px sur les éléments debout, aucun contour sur le décor au sol.

Exemples de référence : `src/rendering/propArt.ts` (tonneau, caisse, blé, dalle), `groundArt.ts` (sol peint), `drawBoulder` et `drawWallSlice` dans `MapRenderer.ts`. Pour les voir : `artLab([...PROP_KEYS], {scale: 4, bake})`.

### Personnages articulés (marionnettes)

Les personnages sont des **marionnettes 2D** : `puppet/Puppet.ts` (os = Containers posés sur leur pivot, hiérarchie parent → enfant, IK à 2 os, ressorts), `puppet/animalParts.ts` (une texture par partie, dessinée autour de son articulation), `puppet/PuppetAnimator.ts` (animation paramétrique : MOVE → jambes et bassin, BODY → torse, ATTACK > AIM → bras avant et arme, LOOK → tête et pupilles, ressorts → queue, oreilles, écharpe). L'icône (HUD, sélection) est une photo de la marionnette au repos.

**Pas de contour sur les pièces d'une marionnette** (référence : New Super Mario Bros. Wii) : un trait autour de chaque membre fait voir les coutures. Le volume vient de l'ombrage (tube : côté ombre plus foncé dans la même teinte), les jonctions se lisent grâce à l'ombre douce que chaque pièce avant projette sur ce qui est derrière (`bakePart(..., castShadow)`), et les yeux ont une orbite ombrée au lieu d'un cercle noir. Le contour de la règle §1 vaut pour le décor, pas pour les personnages articulés.

Banc d'essai : `eval(await fetch('/.claude/skills/game-art/puppetlab.js').then(r => r.text()))`, puis `puppetLab({ state: "idle" | "run" | "runAimBack" | "attack" | "hit", t: 260, zoom: 1.6 })` : les 4 animaux côte à côte, deux captures. L'animateur possède la racine (retournement, saut) : toujours placer une marionnette via un conteneur parent.

## 6. Kit de primitives (`src/rendering/artKit.ts`)

| Primitive                | Usage                                                                               | Coût                                       |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `blob(pts)`              | forme organique fermée (Catmull-Rom) depuis 6 à 10 points : corps, écharpe, feuille | cuisson seulement, environ 60 sommets      |
| `curve(pts)` + `taper()` | membre, tige ou sourcil effilé, avec contour                                        | cuisson : une dizaine de cercles par trait |
| `volume(g, pts, style)`  | contour plus épais côté ombre, ombre, 2 bandes, éclat, rebond, contour              | 5 à 6 remplissages, cuisson seulement      |
| `inset(pts, k, dx, dy)`  | réutilise une forme pour les bandes et l'ombre interne                              | gratuit                                    |
| `speckle(g, pts, n, …)`  | matière (taches, grain) déterministe, seed fixe                                     | n cercles, cuisson seulement               |
| `mix(a, b, t)`           | teinte intermédiaire (ombre colorée, bande)                                         | gratuit                                    |

Toutes ces primitives sont interdites dans un `update()` : elles s'appellent dans un `bakeTexture()`.

## 7. Erreurs que je fais souvent

| Erreur                                                                                                                                                          | Parade                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Valider sur une capture réduite (800 px de large)                                                                                                               | planche `artLab` agrandie + vignette 48 px, deux captures                                                           |
| Empiler des détails quand ça ne marche pas                                                                                                                      | revenir à la forme ou aux valeurs ; enlever un détail avant d'en ajouter un                                         |
| Oublier le mobile                                                                                                                                               | capture 375×812 obligatoire avant de conclure                                                                       |
| Lumière incohérente (le `bean()` historique éclaire par la droite)                                                                                              | `volume()` pour tout nouveau dessin ; vérifier le critère 5                                                         |
| Croire une mesure moyenne (luminance moyenne)                                                                                                                   | juger la planche grise + mesurer le contour                                                                         |
| Yeux noyés par la pupille partagée                                                                                                                              | rayon blanc ≥ 1,6 × rayon pupille ; vérifier avec les pupilles dessinées                                            |
| Lire une capture prise pendant un clignement ou avec une frame de retard                                                                                        | 2 captures, ou faire avancer de 20 frames                                                                           |
| Faire avancer le jeu à la main (`g.step`) puis laisser tourner les vraies images : l'horloge de scène recule et les effets basés sur le temps deviennent géants | toujours borner `now - start` à ≥ 0 dans les animations ; ne pas conclure à un bug de rendu sans vérifier l'horloge |
| Retoucher les autres persos sans qu'on l'ait demandé                                                                                                            | ne modifier que la cible ; noter le reste comme défaut                                                              |

## 8. Habillage du terrain (set dressing)

- **Trois couches** : sol (dalles, taches, grain, sans contour) → décor bas non bloquant (touffes, cailloux, petit contour fin) → éléments debout (obstacles et couvert, contour complet et AO). Chaque couche est cuite dans un RenderTexture, jamais en Graphics vivant.
- **Densité cible** : 40 à 60 % de la surface habillée, mais **rien** dans les zones de capture, sur les spawns ni dans les couloirs de tir (garder `THEME.decor.clearanceUnits`).
- **Placement** : Poisson-disk déterministe (seed de la carte) avec **grappes** (3 à 7 éléments) plutôt qu'une pluie uniforme ; varier taille ±20 %, rotation ±10° (au sol seulement) et retournement horizontal.
- **Symétrie** : les cartes sont symétriques par leur centre, et le décor qui touche au gameplay doit l'être aussi. Le décor purement cosmétique peut casser la symétrie pour éviter l'effet « miroir ».
- **Bords** : un plateau se lit grâce à son épaisseur. Falaise ou bord avant avec face sombre et ombre portée sur le fond.
- **Vérification** : `artLabGray(true)` sur un match. Le décor ne doit jamais être plus contrasté qu'un perso (critère 3) ; l'œil va d'abord aux persos, puis aux zones.

## 9. Familles d'assets à produire (feuille de route)

Le contrat est le même pour chaque famille : une fonction `ensure…Textures`, les clés en tête de fichier, une planche `artLab` et la grille. Ordre conseillé (impact / effort) :

1. Sol : dalles, fissures, touffes (biome par biome).
2. Couvert : blé et buissons (à valider côté gameplay avant d'en faire des cachettes).
3. Obstacles : caisses, tonneaux, clôtures à la place des murs plats ; rochers en `shadeVolume`.
4. Persos : passage de `volume()` (Graphics) à `shadeVolume()` (Canvas), un perso à la fois, avec la grille.
5. Bâtiments et icônes de ressources (mêmes outils).
6. Effets (impact, poussière, éclat), cuits et poolés.

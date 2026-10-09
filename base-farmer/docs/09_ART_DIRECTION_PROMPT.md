# Prompt — Direction artistique complète de Base Farmer

> À copier tel quel dans une IA spécialisée Game Art / Game Design.
> Toutes les valeurs techniques ci-dessous viennent du code du prototype (Phaser 3, `src/config/gameConfig.ts`, `src/data/`, `src/rendering/theme.ts`, `src/rendering/projection.ts`). Ne pas les changer sans mettre le code à jour.
>
> **Révision 2 (après playtest).** La vue n'est plus un top-down pur : c'est une **vue 3/4 inclinée façon Brawl Stars**, avec des **personnages « minions » nommés**, debout et vus de face. Le prototype dessine déjà cette direction en code (formes provisoires). Les assets demandés ici remplaceront ces formes sous les mêmes noms, sans toucher au gameplay.

---

## RÔLE

Tu es directeur artistique senior et game artist 2D, spécialisé dans les jeux d'action en vue 3/4 inclinée lisibles sur mobile (références principales : **Brawl Stars** pour la caméra, l'échelle et le punch ; **les Minions** pour le charme des personnages ; Clash Royale et Overcooked pour la lisibilité). Tu produis une direction artistique complète **et** des assets prêts à intégrer dans un moteur 2D (Phaser 3), pas seulement des moodboards.

## LE JEU

**Base Farmer** est un jeu de conquête territoriale en **vue 3/4 inclinée** (caméra orthographique penchée vers l'avant, comme Brawl Stars), jouable dans le navigateur sur PC et téléphone. La carte est un petit plateau-diorama : le sol est vu en pente, tout ce qui est debout (personnages, bâtiments, rochers, murs) est dessiné de face, avec de la hauteur, et trié en profondeur (ce qui est plus bas à l'écran passe devant).

- Match de **7 minutes**, 1v1 (puis 2v2 plus tard), équipe **A (bleue)** contre équipe **B (rouge)**.
- **7 bases** par carte, toutes neutres au départ. On capture une base en restant dans sa zone : 1,5 s pour une base neutre, 1,5 s pour neutraliser une base ennemie puis 1,5 s pour la prendre. Si les deux équipes sont dans la zone, elle est contestée.
- Chaque base produit **une ressource** parmi 5 : **Nourriture, Bois, Pierre, Métal, Puissance**. Toutes les minutes (puis toutes les 30 s en fin de partie), chaque base rapporte 1 de sa ressource à son propriétaire, et une ressource tirée au sort, annoncée à l'avance, rapporte ×3.
- Les ressources achètent **5 améliorations personnelles** (3 niveaux chacune) : **Vie, Vitesse, Portée, Dégâts, Cadence**.
- Combat en temps réel : déplacement, visée libre à 360°, tir de projectiles. Mort = réapparition après 5 s au point de spawn.
- Gagne l'équipe qui contrôle le plus de bases à 0:00.

Ton du jeu : **ludique, nerveux, coloré, mignon, « ferme militaire »** — des petits fermiers-minions qui se disputent des avant-postes de production. Accessible, pas violent (pas de sang, un « pouf » de fumée à la mort), franchement humoristique : gros yeux, rebonds, sauts de joie, clignements.

## OBJECTIF

Créer une identité visuelle **« hyper cool »**, mémorable et cohérente, sans jamais sacrifier la **lisibilité** : en un coup d'œil, sur un écran de téléphone, le joueur doit savoir où il est, où est l'ennemi, à qui appartient chaque base, quelles bases sont contestées, quelle ressource chaque base produit et combien de temps il reste.

---

## CONTRAINTES TECHNIQUES (NON NÉGOCIABLES)

### Vue et projection (NOUVEAU)
- Le gameplay reste une simulation 2D vue de dessus. Le rendu **écrase le sol verticalement d'un facteur 0,72** (`rendering.tilt`) : un cercle au sol devient une ellipse 1 × 0,72. Tout ce qui est debout est dessiné **sans** écrasement, vu de face (élévation 3/4), et posé sur son point au sol.
- **Les textures de sol** (tuiles, zones, ombres, décor plat) se dessinent **vues de dessus** : le moteur les écrase lui-même. **Tout ce qui est debout** se dessine **de face**, légèrement vu d'au-dessus (≈ 30°).
- **Point d'ancrage des assets debout = le pied** (centre bas de l'emprise au sol), jamais le centre de l'image.
- Hauteurs actuelles à l'écran (zoom 1) : murs **22 px**, haie du fond **26 px**, bord avant du plateau **22 px**, rochers = **0,5 × leur rayon** de dôme, projectiles en vol à **18 px** du sol (hauteur de main).

### Échelle
- Le monde est mesuré en **unités monde (wu)**. **1 wu = 32 px** à zoom 1.
- L'écran affiche **14 wu sur son petit côté** (≈ 448 px de jeu) : prévoir la lecture à cette taille.
- Tous les assets sont livrés en **@1x et @2x** (le @2x sert aux écrans Retina et mobiles). Les dimensions ci-dessous sont en @1x.

| Élément | Taille gameplay | Sprite @1x conseillé |
|---|---|---|
| Personnage (rayon de collision 0,5 wu) | emprise au sol Ø 32 px | **debout**, dessiné à **1,35 × la hitbox** : ~70 px de haut, ~46 px de large, canvas 96×104 px, pied à 8 px du bas |
| Projectile (rayon 0,2 wu) | Ø ~13 px | 16×16 px (24×24 avec traînée) |
| Zone de capture d'une base (rayon 2,5 wu) | Ø 160 px | anneau 176×176 px |
| Bâtiment de base (au fond de sa zone, 1,1 wu derrière le centre) | ~2 wu de large | **de face**, 64 px de large, 56 à 75 px de haut (éolienne la plus haute), pied au centre bas |
| Rocher (obstacle circulaire) | rayons 0,9 / 1,2 / 1,5 wu | 3 tailles, **en dôme** : largeur Ø 58 / 77 / 96 px, base = ellipse au sol (× 0,72) |
| Mur (obstacle rectangulaire) | épaisseur 1–1,2 wu, longueur 5 à 18 wu | modulaire, **face du dessus + face avant de 22 px** ; les murs verticaux se posent en tranches de 1 wu (tri de profondeur) |

### Hitbox = visuel
Les collisions sont des cercles et des rectangles exacts. **L'emprise au sol d'un obstacle doit correspondre à sa forme de collision vue inclinée** : un rocher de rayon 1,2 wu repose sur une ellipse de 77 × 55 px ; ce qui monte (dôme, feuillage, face avant d'un mur) dépasse vers le haut de l'écran, jamais sur les côtés. Les personnages, eux, peuvent dépasser de leur hitbox (×1,35) : l'anneau d'équipe au sol montre la vraie emprise.

### Cartes existantes (dimensions en wu, puis px @1x)
| Id | Nom | Taille | Caractère |
|---|---|---|---|
| `meadow` | Prairie | 48×32 wu → 1536×1024 px | champ ouvert, quelques rochers et 2 murets bas |
| `canyon` | Canyon | 52×30 wu → 1664×960 px | couloir central entre deux longs murs, base centrale = goulet |
| `corners` | Quatre-Coins | 60×36 wu → 1920×1152 px | carte large, bases aux coins et aux milieux des bords |

Chaque carte est **symétrique par rapport à son centre** ; selon la partie, la carte est retournée (bleu à gauche ou à droite). Les positions des bases varient légèrement d'une partie à l'autre : **le sol ne doit pas « dessiner » l'emplacement des bases** — elles sont posées par-dessus. Le plateau a une **haie debout le long du bord du fond** et une **face avant** sous le bord bas : prévoir ces deux éléments par biome.

### Formats de livraison
- **PNG 32 bits avec transparence**, pas de fond, pas d'ombre portée cuite hors du sprite sauf si demandé.
- **Atlas de textures** au format **TexturePacker « Phaser 3 » (JSON Hash)**, une page max **2048×2048**, padding 2 px, extrude 1 px.
- Animations : frames numérotées dans l'atlas, **12 fps** par défaut, durée indiquée pour chacune.
- Tilesets de sol : tuiles **32×32 px** (@1x), compatibles **Tiled** (fichier `.tsx`), avec variantes et transitions (règles autotile / wang 47 ou 16 tuiles).
- Icônes UI : **SVG** + PNG 64/128 px.
- Polices : Google Fonts uniquement (licence libre), 1 titre + 1 texte, avec chiffres lisibles (timer, compteurs).
- **Nommage** : `snake_case`, anglais, préfixé par catégorie, aligné sur les ids du code :
  `char_<tank|scout|shooter|fighter>_<anim>_<frame>`, `base_<food|wood|stone|metal|power>_<state>`, `res_<id>`, `upg_<hp|speed|range|damage|fireRate>`, `fx_<nom>`, `tile_<biome>_<nom>`, `obs_<rock|wall>_<variante>`, `ui_<nom>`.
- Arborescence : `assets/{characters,bases,maps,obstacles,fx,ui,icons,fonts}/` + `assets/atlas/`.

### Couleurs d'équipe et accessibilité
- Couleurs actuelles : **Équipe A `#3D8BFD` (bleu) + symbole cercle**, **Équipe B `#FF5A5F` (rouge) + symbole losange**, **Neutre `#B8B8B8` + anneau vide**, **Contesté `#FFD23F` (jaune)**. Tu peux proposer un ajustement, mais garde un couple bleu/rouge et justifie-le.
- **Ne jamais coder une info uniquement par la couleur** : chaque équipe a aussi un **symbole** et un **motif** (drapeau, rayures, etc.). Vérifie la palette en deutéranopie, protanopie et tritanopie (fournis les simulations).
- Contraste texte/fond ≥ 4,5:1 sur l'UI.
- Les deux joueurs peuvent choisir **le même personnage** : l'appartenance à l'équipe doit donc être lisible sur le personnage lui-même (contour, brassard, cape, socle au sol…). Prévoir un **calque teintable** séparé (masque blanc à teinter en code) plutôt que dupliquer chaque sprite en bleu et rouge.

### Visée à 360° (vue 3/4)
Le joueur vise dans n'importe quelle direction indépendamment du déplacement. Le prototype procède ainsi, et les assets doivent suivre la même construction en **calques séparés** :
- `body` : le personnage debout, **3/4 face tourné vers la droite**. Le moteur le **retourne en miroir** quand on vise à gauche : une seule orientation à dessiner (une version dos-3/4 optionnelle pour la visée vers le haut est un bonus).
- `pupils` : **pupilles séparées**, une par œil, que le moteur décale vers la direction visée (les yeux « regardent » la cible) et écrase pour cligner.
- `weapon` : l'arme seule, de profil, **poignée au centre de l'image**, pointant vers +x. Elle tourne autour de la main ; elle passe derrière le corps quand on vise vers le haut.
- `team_mask` : la pièce de tenue d'équipe (casque, écharpe, chapeau, salopette) en **blanc à teinter**, avec le symbole d'équipe.
- `shadow` : ombre au sol (plate, écrasée par le moteur).

### Performance
Cible : 60 fps sur un téléphone moyen. Pas de particules massives, pas de shaders lourds, pas d'animations de fond en plein écran. Préférer peu de frames bien choisies.

---

## LIVRABLES DEMANDÉS

Livre dans cet ordre, en validant chaque étape avant la suivante.

### 1. Bible de direction artistique
- 3 **pistes de DA** contrastées (ex. « diorama jouet », « BD cel-shading », « pixel art HD »), chacune avec moodboard, palette, 1 mockup d'écran de jeu complet. Recommande-en une et explique pourquoi elle sert la lisibilité mobile. **Contrainte de cette révision : les 3 pistes sont en vue 3/4 inclinée, personnages « minions » debout et vus de face.**
- Pour la piste retenue :
  - **Palette maîtresse** (hex) : sol, décor, équipe A, équipe B, neutre, contesté, 5 ressources, UI, états (danger, succès). Règle : le décor est **désaturé/moyen**, les éléments de gameplay (personnages, bases, projectiles) sont **saturés et contrastés**.
  - Règles de **lumière** (source unique, angle), **contour** (épaisseur, couleur), **ombres**, **valeurs** (test en niveaux de gris : personnages et bases doivent ressortir du sol).
  - **Typographies** et règles de texte.
  - Hiérarchie visuelle : ordre de priorité des éléments à l'écran.
  - Do / Don't illustrés.

### 2. Personnages (4)
Pour **chaque personnage** : fiche concept (nom, silhouette, personnalité, 3 mots-clés), turnaround, version 3/4 en jeu (calques de la section « Visée »), **portrait de face** pour l'écran de sélection.

Style **« minion fermier »** : petits personnages ronds, **grosse tête-corps, gros yeux expressifs**, jambes courtes, contour épais, matières « jouet vinyle ». Chaque personnage a un **nom** (c'est ce que voit le joueur, pas son rôle) :

| Id code | Nom | Rôle (interne) | Stats relatives | Silhouette actuelle (à sublimer) |
|---|---|---|---|---|
| `tank` | **Patatras** | tient les zones contestées, **corps à corps** | Vie 150, Vitesse 5,4, Dégâts 35, allonge 1,6 wu | grosse patate grumeleuse, casque-marmite à bandeau d'équipe, **poêle à frire** |
| `scout` | **Pépin** | prend les bases en premier, **corps à corps** | Vie 70, Vitesse 7,8, Dégâts 17, allonge 1,25 wu | petit haricot vert, énormes lunettes, écharpe d'équipe qui flotte, pousse sur la tête, **petit râteau** |
| `shooter` | **Lorgnon** | **seul tireur** : faibles dégâts, très longue portée | Vie 75, Vitesse 5,3, Dégâts 8, portée 9 wu | grand haricot bleu-gris **à un seul œil** cerclé de laiton, bob d'équipe, réservoir d'eau dans le dos, lance-arrosoir |
| `fighter` | **Gaston** | polyvalent, **corps à corps** | Vie 105, Vitesse 6, Dégâts 33, allonge 1,6 wu | le « minion » classique : jaune, deux yeux à lunettes, **salopette d'équipe**, chapeau de paille, **fourche** |

- **Les 4 silhouettes doivent se distinguer en ombre chinoise à 48 px de haut.**
- Animations par personnage (calques séparés, frames + durée). Le prototype anime déjà en code : respiration au repos, petits sauts penchés à la marche, recul de l'arme au tir, écrasement + flash blanc à l'impact, clignement des yeux, **saut de joie quand l'équipe capture la base où il se trouve**, « pouf » à la mort, « pop » à la réapparition. Les frames dessinées doivent garder ce caractère :
  `idle` (4–6), `walk` (6–8, rebond), `shoot` (3–4, avec muzzle flash), `hit` (2), `death` (6–8, pouf comique), `respawn` (6–8), `cheer` (6–8, saut de joie), `blink` (2).
- **Attaques** : Patatras, Pépin et Gaston frappent au corps à corps (l'outil balaie un arc de 110 à 130° en 150 ms, avec une **traînée en croissant**) ; fournir pour chacun l'outil seul (poignée au centre) et la traînée. Lorgnon est le seul tireur : projectile d'eau + impact (4 frames).
- Visualisation des **améliorations achetées** : un petit indicateur discret par amélioration (niveaux 1 à 3), sans surcharger le sprite.

### 3. Bases (7 par carte, 5 types)
- **5 bâtiments en élévation (vus de face, 3/4)**, un par ressource. Actuellement : Nourriture = grange + silo, Bois = scierie avec tas de bûches et **scie circulaire qui tourne**, Pierre = pyramide de blocs taillés + pioche, Métal = forge avec cheminée et **four rougeoyant**, Puissance = **moulin à vent dont les ailes tournent**. Propose mieux si tu trouves, en gardant une pièce animée séparée pour Bois et Puissance.
- Le bâtiment se tient **au fond de sa zone** (la cour devant reste dégagée pour voir qui capture), sur un **socle au sol à la couleur du propriétaire**, avec un **drapeau planté sur le toit** (point d'ancrage du mât à fournir). Il devient semi-transparent quand le joueur passe derrière.
- **5 états visuels** pour chaque base : `neutral`, `teamA`, `teamB`, `contested`, `capturing` (avec **jauge de progression radiale** autour de la zone, à fournir comme anneau découpé en segments ou masque).
- Anneau de zone de capture (Ø 160 px @1x) par état, drapeau/étendard avec symbole d'équipe.
- Animation **« production »** (3–6 frames) quand la base rapporte sa ressource + icône qui s'envole.
- Lisibilité : la ressource produite se reconnaît par la **forme du bâtiment + une icône**, pas seulement la couleur.

### 4. Cartes et décors
- Un **biome par carte** : Prairie (pastoral, ouvert), Canyon (roche, poussière, ocre), Quatre-Coins (propose : marais, bord de rivière, neige…).
- Pour chaque biome :
  - **Tileset de sol** 32 px avec 3–4 variantes de base + transitions + détails (herbe, cailloux, fleurs…) en couche séparée.
  - **Obstacles** : rochers 3 tailles × 3 variantes, murs modulaires (début / milieu / fin / angle), conformes aux hitbox.
  - **Décor non bloquant** : petites touffes, clôtures, caisses, épouvantails… clairement **plats** pour ne pas être confondus avec un obstacle.
  - **Bordure de carte** infranchissable (falaise, haie, eau) en tuiles.
  - **Zones de spawn** bleue et rouge (aire de départ marquée au sol).
  - Un **rendu de carte complet** (image de référence) avec les bases placées, au format exact de la carte.
- Fond d'écran derrière la carte (couleur `#1B1F2A` actuellement) : propose mieux si besoin.

### 5. Effets visuels (FX)
Animations courtes, peu de frames : tir, impact, dégât reçu, mort (« pouf » non violent), réapparition, capture terminée (**pluie de confettis aux couleurs de l'équipe depuis le toit** + saut de joie), base contestée (pulsation jaune), événement de production (bannière + pluie d'icônes), amélioration achetée, chrono < 30 s (urgence), poussière de déplacement de Pépin, ombre au sol des projectiles en vol.

### 6. Interface (UI/HUD)
Penser **mobile d'abord** (portrait et paysage), touch targets ≥ 44 px.
- **Icônes** : 5 ressources, 5 améliorations, 2 symboles d'équipe, vie, chrono, base.
- **HUD** : chrono, compteur de bases par équipe (ex. 4 – 3 avec symboles), ressources du joueur, barre de vie, état de capacité, objectif (flèche vers la base la plus proche / pertinente).
- **Barre d'améliorations** (5 boutons, coût affiché en icônes, états : abordable / trop cher / niveau max).
- **Contrôles tactiles** : joystick gauche (rayon 60 px), zone de visée droite, bouton d'attaque.
- **Bannière d'événement** : « PRODUCTION : BOIS » + quantité gagnée.
- **Écrans** : titre/logo, sélection du personnage (4 cartes : **portrait de face qui respire, le personnage choisi sautille**, nom en titre, 3 attributs en étoiles ★, phrase courte), sélection de carte et difficulté, résultat (victoire / défaite / égalité, idéalement avec les personnages qui célèbrent ou boudent).
- **Logo** « Base Farmer » (versions horizontale, carrée, favicon 32/192/512 px, icône d'app).
- Composants UI en **9-slice** (panneaux, boutons) avec marges indiquées.
- Mockups des écrans à 375×812 (mobile portrait), 812×375 (paysage) et 1920×1080.

### 7. Documentation d'intégration
- **Spritesheet / atlas** + JSON, et un tableau récapitulatif : nom de fichier, taille, nombre de frames, fps, point d'ancrage (pivot, en général centre du cercle de collision), calque.
- **Fichier de tokens** `theme.json` reprenant toutes les couleurs au format `0xRRGGBB` et `#RRGGBB`, avec les mêmes clés que le code actuel (`teams.teamA.primary`, `resources.food`, etc.).
- Liste des licences (polices, références).

---

## SI TU GÉNÈRES LES IMAGES AVEC UN MODÈLE D'IMAGE

Pour chaque asset, fournis le **prompt de génération exact** (Midjourney / DALL·E / Stable Diffusion / Scenario / Leonardo), avec : style verrouillé (même préfixe de style partout, ex. « cute minion-like farm character, chunky vinyl toy, thick outline, Brawl Stars style »), angle de vue « three-quarter front view, camera tilted ~30° above, orthographic » pour tout ce qui est debout et « top-down orthographic » pour les tuiles de sol, fond transparent ou uni à détourer, palette imposée, seed si possible, et negative prompt (« no realistic perspective distortion, no text, no shadow on background, no gore, no scary faces »). Garantis la cohérence entre personnages (même éclairage, même épaisseur de contour, même échelle).

---

## CRITÈRES DE VALIDATION (à vérifier toi-même avant de livrer)

1. Test **48 px de haut** : les 4 personnages se reconnaissent en silhouette noire, et on comprend leur nom au premier regard (patate, pépin, lorgnon, fermier).
2. Test **niveaux de gris** : personnages, bases et projectiles se détachent du sol.
3. Test **daltonisme** : équipe A, équipe B, neutre et contesté restent distincts (grâce aux symboles).
4. Test **téléphone** : un mockup à 375 px de large reste lisible, rien d'important sous les pouces.
5. **Hitbox** : l'emprise au sol de chaque obstacle (vue inclinée × 0,72) correspond à son cercle/rectangle de collision ; les assets debout ont leur ancrage au pied.
6. **Cohérence** : même lumière, même contour, même échelle sur tous les assets.
7. **Nommage et formats** conformes à la section « Formats de livraison ».

## FORMAT DE TA RÉPONSE

1. Commence par les **3 pistes de DA** et ta recommandation, puis **attends ma validation**.
2. Ensuite livre section par section (bible → personnages → bases → cartes → FX → UI → intégration), chacune avec ses visuels, ses fichiers et sa check-list de validation.
3. Pose-moi des questions seulement si un choix change vraiment le résultat ; sinon prends une décision et indique-la.

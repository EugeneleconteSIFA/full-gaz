# Bible DA du monde — décor, bâtiments, lumière

Étend au monde entier la DA des personnages ([docs/10](10_CHARACTER_3D_PIPELINE.md), skill [`character-3d`](../.claude/skills/character-3d/SKILL.md) §6). Roadmap : étape 3 ([docs/11](11_ROADMAP_3D.md)). Rendu : three.js (D058).

**Principe** : le décor est un **fond**. Il recule en valeur et en saturation pour que les personnages et les marqueurs d'équipe ressortent. Toute règle ci-dessous sert ce principe.

## 1. Sources

Recherche du 8 octobre 2026. Les sources primaires de Supercell sur l'environnement de Brawl Stars **n'ont pas été trouvées**. Les règles marquées *[déduction]* sont un raisonnement, pas une citation.

| Source | Lue | Retenu |
| --- | --- | --- |
| Adobe Substance Magazine, Supercell Helsinki (Clash of Clans, Clash Royale) | oui, via un résumé d'outil | formes « boxy », dégradés simples, albédo peu varié, plus mat que le réel (même le métal), usure seulement aux arêtes |
| Game Developer, « How to reduce visual confusion » (DOTA 2) | oui, via un résumé d'outil | le sol a peu de contraste ; trop de contraste partout = rien ne ressort ; tester en niveaux de gris |
| 80.lv, lisibilité des cartes d'UT Blitz | oui, via un résumé d'outil | dégradé vertical léger pour lire les formes |
| PocketGamer.biz, Warcraft Arclight Rumble | oui, via un résumé d'outil | peu de découpes de texture au sol ; éviter le « tout plastique » |
| Valve NPAR07 (rendu de TF2), Polycount, ArtStation (Dinsai, Studio Piñata), GDC Vault (Clash Universe) | extraits seulement | équipes distinguées aussi par la forme ; atlas palette + couleurs par sommet ; budgets indicatifs |

## 2. Lumière

- **Une seule lumière** pour tout le jeu : une directionnelle du haut gauche de l'écran, plus un ciel froid et un sol chaud en remplissage (`World3D.ts`). Personnages et décor la partagent.
- **Ombre teintée froide** (la rampe `RAMP` de `gltfCharacter.ts`), jamais grise. Le décor utilise **la même rampe** que les persos.
- Ombres portées : une **tache ronde** sous les persos ; **occlusion cuite** dans les couleurs par sommet du décor (pas d'ombres temps réel).
- **Canyon, fin de journée** *[déduction]* : on change uniquement la couleur de la lumière (chaude, plus rasante) et la teinte de l'ombre (violet-bleu). On garde l'écart de valeur sol/persos, on renforce le liseré (rim) des persos, et **on ne teinte pas le sol en orange saturé**, sinon le rouge d'équipe se perd. À valider par capture en niveaux de gris.

## 3. Valeurs et couleurs

Hiérarchie, du plus visible au moins visible :

1. **Marqueurs d'équipe** (anneaux, drapeaux, arc de capture) : les plus saturés.
2. **Personnages** : les plus clairs et les plus contrastés des grandes masses.
3. **Bâtiments et obstacles** : contraste moyen, saturation modérée.
4. **Sol** : contraste faible, teinte unie par biome, léger dégradé.

Règles :

- **Bleu et rouge d'équipe réservés à l'appartenance** : drapeau, anneau au sol, arc de capture, bannière ou toit du bâtiment possédé. Jamais dans le décor.
- Neutre = gris-crème (`THEME.teams.neutral`).
- Un objet de décor n'est **jamais plus saturé que le personnage le plus terne**.
- Test obligatoire : **capture désaturée**. Les persos doivent rester les formes les plus nettes.

## 4. Formes

- **Silhouette d'abord** : chaque bâtiment se reconnaît à sa silhouette seule, vue de la caméra du jeu (35° de la verticale).
- 2 à 3 **grandes masses** par objet, **chanfreins épais**, ruptures de plans nettes ; pas de détail fin sauf aux arêtes.
- Langage de forme partagé avec les persos : rond et dodu pour la ferme ; aucun angle vif ni pointe fine.
- **Une usure franche**, à un seul endroit logique (coin écorné, planche fendue), pas de bruit.
- Échelle : un perso fait **2,2 unités** de haut. Tonneau ≈ 1,1 ; caisse ≈ 1,2 ; clôture ≈ 0,9 ; rocher 1 à 1,6 ; bâtiment 3 à 4,5 (sans dépasser deux fois un perso pour ne pas masquer le jeu).

## 5. Matériaux

- **Couleur par sommet** (RGB) + **occlusion cuite** (alpha), comme les persos ; aucune lumière peinte.
- Bois chaud, pierre froide désaturée, métal **plus clair et plus froid**, mat.
- Contour : celui du jeu (écran, sur les sauts de profondeur). Le sol n'en reçoit pas, puisqu'il n'a pas de saut de profondeur.
- Un seul matériau partagé pour tout le décor (même rampe que les persos).

## 6. Sol et densité (choix « Brawl Stars »)

- Sol **lisible et calme** : une teinte par biome, variations très douces, aucune texture bruyante.
- Le cœur jouable reste **dégagé**. Le décor non bloquant (touffes, fleurs) est rare et rangé en périphérie.
- Tout ce qui ressemble à un obstacle **bloque** ; tout ce qui ne bloque pas reste plat et pâle. La 3D suit exactement la collision (`src/data/maps.ts`).

## 7. Budgets

| Catégorie | Triangles | Remarque |
| --- | --- | --- |
| Personnage en match | ~12 000 | `make_match.py` |
| Bâtiment de base | ≤ 6 000 | 5 bâtiments, 7 instances |
| Obstacle (tonneau, caisse, rocher) | ≤ 1 500 | instancié |
| Sol d'une carte | ≤ 4 000 | plus la bordure |

Mesures D058 : 60 i/s sur iPhone mini avec plus de 500 000 triangles. Ces budgets laissent une large marge pour les effets.

## 8. Checklist « le tonneau à côté de Gaston »

À passer pour chaque objet, posé à côté d'un perso, à la caméra du jeu et à la taille d'un téléphone :

1. **Silhouette** (aplat noir) : l'objet se reconnaît-il ?
2. **Niveaux de gris** : le perso est-il plus clair et plus contrasté que l'objet, et l'objet plus contrasté que le sol ?
3. **Pas de bleu ni de rouge d'équipe** hors marqueur d'appartenance.
4. Même rampe, même ombre teintée, même contour que le perso ? Aucune lumière peinte ?
5. 2 à 3 masses, chanfreins épais, détail seulement aux arêtes ?
6. Une seule usure, franche ?
7. Jamais plus saturé que le perso le plus terne ?
8. Échelle conforme au §4 ?
9. Budget du §7 tenu, sans nouveau matériau ?
10. Canyon : refaire 2 et 3 sous la lumière de fin de journée.

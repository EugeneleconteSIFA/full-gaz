# Brief : nom et direction artistique d'un jeu de trajets à Lille

Tu es directeur·rice artistique et designer d'interface. Je te confie le nom et la refonte visuelle d'un petit jeu web. Lis tout le brief avant de proposer quoi que ce soit, puis suis le déroulé de la dernière section.

## 1. Le jeu en deux minutes

Le jeu s'appelle provisoirement « Correspondance ». C'est un puzzle quotidien de plus court chemin dans Lille, à jouer entre étudiants en amphi, sur le modèle de Wordle.

- **Une grille par jour, la même pour tout le monde.** Elle donne une station de départ (D), une station d'arrivée (A) et une info trafic du jour : travaux, grève, verglas, ou trafic normal.
- **Le plan** est schématique, pas à l'échelle, dans l'esprit d'un plan de métro. Il montre 25 lieux réels de Lille (Lomme et Hellemmes compris) et trois types de liaisons :
  - métro M1 et M2 ;
  - bus Lianes 1, 5, 7, 90 et 92 ;
  - rues à pied.

  Chaque liaison affiche sa durée en minutes dans une pastille.
- **Le joueur trace son trajet** en touchant les stations une à une. Quand plusieurs lignes relient deux mêmes stations, un panneau lui demande laquelle prendre.
- **Le cœur du puzzle** : monter dans un métro ou un bus coûte une attente (métro 3 min, bus 4 min, à pied 0). Changer de ligne se paie, si bien que le trajet le plus direct n'est presque jamais le plus rapide.
- **À la validation**, le joueur voit :
  - son écart à l'optimal en %, avec un verdict (« Optimal », « Excellent », « Bien joué », « Peut mieux faire », « Grand détour ») ;
  - son chrono ;
  - le meilleur trajet tracé sur le plan ;
  - un texte de partage en emojis (🟩🟨🟥, un carré par étape) qui ne révèle pas la solution.
- **Classement entre amis** : un groupe rejoint avec un code de 6 caractères, un classement du jour et un classement de la semaine.
- **Mode Entraînement** : une grille au hasard, rejouable à volonté.

Le public : des étudiants de 18 à 25 ans, sur leur téléphone, souvent en amphi ou dans le métro, qui se comparent entre potes. Le ton est complice et tutoie.

## 2. Un nouveau nom

« Correspondance » ne me convient plus. Je veux un nouveau nom qui :

- se retienne et se dise facilement à l'oral, en amphi : « t'as fait le … du jour ? » ;
- fonctionne comme un mot ou une marque courte, de préférence en français. Un mot qui évoque Lille, le Nord ou le ch'ti est bienvenu s'il reste compréhensible par tous ;
- évoque le trajet, le réseau, la débrouille ou le « plus court chemin », sans être générique ;
- tienne en titre sur un écran de 390 px de large ;
- marche dans le texte de partage, par exemple « [Nom] n°12 · 11 oct. » ;
- n'appartienne pas à une marque existante connue, notamment Ilévia et les noms de ses lignes ou de ses titres de transport.

Propose **dix noms** avec, pour chacun, une ligne d'explication. Puis recommande tes **trois préférés** et donne une piste visuelle pour chacun. Signale ceux dont tu n'as pas pu vérifier qu'ils sont libres : nom de domaine, marques déposées, jeux existants. Le nom et la DA se choisissent ensemble.

## 3. Ce que je veux de la nouvelle DA

La DA actuelle est propre mais neutre. Elle ressemble à une interface de signalétique : fond gris-bleu clair, encre bleu nuit, titre en Barlow Condensed en capitales, chiffres en IBM Plex Mono, durées des liaisons dans des pastilles arrondies. Le trajet du joueur est surligné en cyan, et l'alerte trafic est en orange. Je veux une identité qui :

1. **ait une personnalité qu'on reconnaît en une capture d'écran** partagée sur un groupe de messagerie ;
2. **parle de Lille sans cliché** : briques, pignons flamands, Vieux-Lille, la Braderie, l'univers du VAL, le métro automatique lillois. Évite la carte postale et les beffrois partout ;
3. **reste un vrai plan de transport** : la lisibilité du réseau passe avant la décoration, et le plan est l'écran principal ;
4. **donne envie de revenir chaque jour**, avec un rituel du jour : numéro de puzzle, révélation du résultat, partage.

Propose **trois pistes contrastées**. Chacune a un nom, une intention en deux phrases et des références. Je choisirai, puis tu détailleras la piste retenue.

## 4. Contraintes non négociables

**Technique**
- Une seule page HTML/CSS/JS, sans framework ni étape de build. Les polices peuvent venir de Google Fonts ; aucune autre ressource externe.
- Le plan est un SVG généré en JavaScript. Les couleurs et les styles passent par des classes CSS et des variables CSS. Ne propose pas d'illustrations bitmap lourdes : tout doit rester léger et vectoriel.
- Thème clair et thème sombre complets. Les couleurs sont des variables sur `:root`, redéfinies pour le sombre.

**Mobile d'abord**
- La largeur de référence est 390 px. Vérifie aussi 820 px (tablette) et l'ordinateur.
- La page ne doit jamais défiler horizontalement. Seul le plan peut défiler dans son cadre, car il est plus large que l'écran.
- Les cibles tactiles font au moins 44 × 44 px.

**Accessibilité**
- Contraste WCAG AA pour tout le texte, dans les deux thèmes.
- Les lignes ne doivent jamais se distinguer par la couleur seule. Aujourd'hui, le métro est en trait plein et épais, le bus en tirets, la rue en gris fin. Garde au moins un codage par la forme : épaisseur, tirets, motif.
- `prefers-reduced-motion` doit couper toutes les animations non essentielles.

**Emojis** : pas d'emoji dans l'interface. Ils ne servent que dans le texte de partage.

**Couleurs des lignes** : sept lignes doivent rester distinguables entre elles, sur fond clair comme sur fond sombre.

| Ligne | Couleur officielle |
|---|---|
| M1 | jaune |
| M2 | rouge |
| Lianes | toutes bleues |

Les bleus des Lianes officielles sont indistinguables entre eux. Tu peux t'écarter des couleurs officielles, mais justifie tes choix.

**Les états du plan**, à dessiner tous :
- station normale, station plaque tournante (« hub »), départ (D), arrivée (A) ;
- stations accessibles depuis la position actuelle (aujourd'hui un anneau qui pulse) ;
- position actuelle, stations déjà parcourues ;
- trajet tracé par le joueur (aujourd'hui une large bande colorée sous les lignes) ;
- meilleur trajet révélé à la fin (aujourd'hui des pointillés) ;
- liaison fermée par la perturbation du jour (aujourd'hui une pastille « × ») ;
- durée modifiée par la perturbation (aujourd'hui une pastille cerclée d'orange) ;
- liaisons parallèles : jusqu'à trois lignes entre deux mêmes stations, décalées côte à côte.

## 5. Les écrans et composants à couvrir

1. **En-tête** : logo ou marque, titre (le nouveau nom), sous-titre (« Puzzle n°12 · dimanche 11 octobre · Lille »), bascule « Du jour » / « Entraînement ».
2. **Consigne** : « Rejoins [D] Saint-Philibert jusqu'à [A] Fives en un minimum de minutes. »
3. **Info trafic** : encart neutre ou d'alerte, selon la perturbation.
4. **Plan** : environ 850 × 520 unités SVG, sur une grille de 10 colonnes et 6 rangées, avec 25 stations et environ 48 liaisons. Il faut une légende.
5. **Panneau de choix de ligne** : « Vers Porte de Douai : quelle ligne ? », avec un bouton par ligne, par exemple « M2 · 1 min + attente 3 » et « Liane 1 · 3 min ».
6. **Tableau de bord** : trajet en minutes, nombre d'étapes, chrono.
7. **Fil du trajet** : une suite de puces, par exemple « Saint-Philibert » → « attente 3 min » → « M2 · 7 min » → « Euratechnologies » → …
8. **Message d'état** (« Touche une station reliée à… ») et boutons Annuler, Recommencer, Valider le trajet.
9. **Écran de résultat** :
   - un grand pourcentage avec son verdict, une phrase de détail ;
   - un encadré pédagogique sur Dijkstra ;
   - le texte de partage dans un bloc copiable, avec les boutons « Copier le résultat » et « Grille d'entraînement ».
10. **Classement entre amis** :
    - formulaire avec pseudo, code de groupe ou création d'un groupe ;
    - ensuite : nom et code du groupe, boutons « Inviter » et « Quitter » ;
    - onglets « Aujourd'hui » / « Semaine », puis une liste classée (rang, pseudo, écart, chrono) où ma propre ligne est mise en avant.
11. **Icône et favicon** du jeu, et une image d'aperçu pour le partage de lien (1200 × 630).

## 6. Ce que tu ne dois pas casser

Une autre personne intégrera ta DA dans le code. Pour qu'elle puisse le faire sans réécrire la logique :

- **Garde la structure** et les `id` de tous les éléments :

  ```
  actions again brief choose chooseOpts chooseQ chrono copied copy cost count detail
  fBoards fCode fCreate fGCode fGName fGroup fJoin fJoinBtn fLeave fList fMsg fName
  fNote fPseudo fShare fTabDay fTabWeek fTitle fWait friends legend lesson m-daily
  m-train map notice noticeTag noticeText pct reset result route shareText status sub
  undo validate verdict waitInfo
  ```

  Tu peux ajouter des éléments décoratifs, des classes et des enveloppes autour.
- **Garde les classes posées par le JavaScript** :
  - sur le plan SVG :
    - lignes : `.ln` avec `.metro`, `.bus` ou `.rue`, plus la ligne (`.M1`, `.M2`, `.L1`, `.L5`, `.L7`, `.L90`, `.L92`) et `.closed` ;
    - tracés : `.band` (`.on`), `.optline` (`.show`) ;
    - pastilles : `.pill` (`.on`, `.mod`, `.x`) ;
    - stations : `.sta` (`.hub`, `.begin`, `.end`, `.visited`, `.current`, `.reach`), avec à l'intérieur `.hit`, `.ring`, `.dot` et `.mk` ;
    - noms de lieux : `.nm` (`.key`) ;
  - dans la page :
    - fil du trajet : `.route` avec `.stop`, `.first`, `.leg` + ligne, `.wait`, `.empty` ;
    - boutons : `.btn` (`.primary`) ;
    - classement : `.board-list li.me`, et `[aria-pressed]` / `[aria-selected]` pour les bascules.
- **Respecte la règle `[hidden] { display: none !important; }`**. Un titre trop large dans un conteneur flex a déjà fait défiler la page horizontalement : prévois `min-width: 0` et des césures.
- **Le nouveau nom** remplacera « Correspondance » dans le titre, le texte de partage et l'onglet du navigateur. Les identifiants techniques (`corr:` dans le stockage local, `/*GEN-START*/`) ne changent pas.
- **Ne touche pas à la logique.** Les données du réseau, le générateur et le calcul du score sont hors de ton périmètre, et les textes restent en français, au tutoiement.

## 7. Livrables attendus

**Étape 1, le nom et les trois pistes.** D'abord les dix noms et ta recommandation (section 2). Puis, pour chacune des trois pistes :
- nom, intention, ambiance et références ;
- palette complète, en clair et en sombre, avec les codes hexadécimaux et les ratios de contraste des couples texte/fond ;
- typographies (titre, texte, chiffres), avec la justification des chiffres tabulaires pour les chronos et les minutes ;
- une maquette de l'écran de jeu à 390 px : en-tête, consigne, plan en cours de partie, tableau de bord.

**Étape 2, la piste retenue en détail.**
- **Fichier de tokens CSS prêt à coller** : le bloc `:root` clair, le bloc sombre, les rayons, les espacements, les ombres et les durées d'animation. Le sombre se déclare sous deux sélecteurs : `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` et `:root[data-theme="dark"] { … }`.
- **Styles du plan SVG** : tous les états listés en section 4, avec le CSS correspondant aux classes de la section 6.
- **Maquettes à 390 px** : plan en cours de partie, panneau de choix de ligne, écran de résultat, classement.
- **Une maquette à 820 px**.
- **Micro-interactions** : toucher d'une station, tracé qui s'allonge, révélation du résultat. Pour chacune, donne la durée, la courbe et l'équivalent quand le mouvement est réduit.
- **Icône, favicon et image de partage**, en SVG.
- **La liste de ce que tu n'as pas pu vérifier** : contrastes non mesurés, rendu des polices, etc.

Rends tes maquettes en HTML/CSS autonome, sur une seule page, plutôt qu'en images. Je dois pouvoir les ouvrir dans un navigateur et récupérer le CSS directement.

## 8. Déroulé

1. Reformule en cinq lignes ce que tu as compris, et pose au maximum trois questions si quelque chose bloque vraiment.
2. Livre l'étape 1 et attends mes choix : le nom et la piste.
3. Livre l'étape 2 de la piste retenue.

Je ne peux pas te joindre le code actuel : base-toi sur les descriptions de ce brief. Si une information te manque pour une maquette, fais une hypothèse raisonnable et signale-la.

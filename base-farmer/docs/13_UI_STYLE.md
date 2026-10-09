# Interface — identité visuelle

Roadmap étape 7 ([docs/11](11_ROADMAP_3D.md)). Code : [`src/rendering/ui/uiKit.ts`](../src/rendering/ui/uiKit.ts) (couleurs, textes, panneaux, boutons) et [`src/rendering/ui/portraits.ts`](../src/rendering/ui/portraits.ts) (portraits 3D).

L'interface prolonge la DA des personnages (Supercell : épais, arrondi, contour encre) et suit la règle du monde : **le bleu et le rouge ne disent que l'équipe** ([docs/12](12_WORLD_ART_BIBLE.md) §3).

## Typographie

| Usage | Police | Style |
| --- | --- | --- |
| Titres, chiffres, boutons, noms | **Lilita One** | blanc (ou or), contour encre épais, petite ombre portée |
| Descriptions, légendes | Fredoka gras | crème ou gris-bleu, sans contour |

## Formes

- **Panneau** : ardoise profonde `#2a3658`, contour encre `#161b2e` de 3 px, reflet clair fin en haut (la lumière vient d'en haut), rebord plus sombre en bas, ombre portée de 4 px.
- **Bouton** : la même forme, en couleur ; il s'enfonce quand on appuie (l'ombre disparaît). **Or** = action principale (Jouer, Rejouer), **ardoise** = secondaire.
- **Sélection** : liseré or épais, jamais une couleur d'équipe.
- **Pastilles** (choix de carte et d'adversaire, chronomètre, portefeuille) : panneaux en capsule.

## Écrans

- **Sélection** : logo « BASE FARMER » en or, cartes-panneaux avec le portrait 3D de chaque perso (rendu une fois depuis son modèle), étoiles en or, capacité en or ; pastilles de carte et d'adversaire ; bouton « JOUER » doré. Les cartes prennent la hauteur restante : tout tient sur un iPhone mini.
- **Match** : pastille du chronomètre, écussons de score aux couleurs d'équipe de part et d'autre de la mini-carte (icônes : portraits 3D), portefeuille en pastille, boutons d'amélioration en panneaux colorés (liseré blanc quand on peut acheter), bouton de capacité doré cerclé d'encre, ruban de phase bordé d'or, barres de vie en capsule encre.
- **Résultats** : ton personnage en 3D sur un podium (pose de victoire, ou mine inquiète après une défaite), ruban or / gris, raison, « REJOUER » doré, « Changer de perso » ardoise.

## Règles

- Pas de modale pendant le combat (docs/02).
- Toute nouvelle pièce d'interface passe par le kit : pas de rectangle plat, pas de nouvelle police.
- Vérifier à 375 × 812 (iPhone mini, portrait) et en paysage.

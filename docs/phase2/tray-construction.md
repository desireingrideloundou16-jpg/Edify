# Phase 2C-4D-1 — construction de la barquette

> **Construction de référence.** C'est une barquette pliée simple et cohérente, qui sert de source de vérité au
> futur patron. Elle ne prétend pas couvrir toutes les barquettes industrielles (soufflets diagonaux, parois
> évasées, rebords, verrouillages automatiques…).

## Modèle concerné

| id | Nom | Dimensions catalogue | Matière | Modèle |
|---|---|---|---|---|
| `food-tray` | Barquette | 180 × 120 × 40 mm | Carton alimentaire | `tray` |

Les deux autres produits qui partageaient le modèle `tray` en ont maintenant un propre. C'est le même procédé que
pour pizza et burger en 2C-4C-0 : `resolveStructure()` ne reçoit que le modèle, et ce sont des objets physiques
différents.

| id | Nouveau modèle | 3D | Patron |
|---|---|---|---|
| `display-box` (Présentoir comptoir) | `display` | même bloc qu'avant, identique au bit près | non supporté |
| `egg-carton` (Boîte à œufs) | `moulded` (pulpe moulée) | même bloc qu'avant, identique au bit près | non supporté : un emballage moulé n'a pas de patron à plat |

Les projets enregistrent `shapeId` et le modèle est relu dans le catalogue : aucune donnée n'est à migrer.

## Dimensions et épaisseur

- Axes three.js (convention de toutes les boîtes) : x = L, y = H (sol à 0), z = W (avant en +z).
- 180 × 120 × 40 = **encombrement extérieur exact**. Le carton est à l'intérieur.
- Épaisseur `t` : `materialThickness(matière)`. Pour le carton alimentaire, c'est la valeur nominale de 0,45 mm.
  Elle n'est pas écrite dans la géométrie : changer de matière change la construction (testé).
- Dimensions intérieures : L − 2t × W − 2t × H − t (entre les parois, au-dessus du fond), soit
  179,1 × 119,1 × 39,55 mm.

## Construction : plateau rectangulaire à coins collés

| Pièce | Rôle | Plaque (mm) |
|---|---|---|
| `bottom` | fond, entre les parois | (L − 2t) × (W − 2t) |
| `front` / `back` | parois avant / arrière, entre les côtés | (L − 2t) × H |
| `left` / `right` | côtés, sur toute la profondeur | W × H |
| `flap-front-left`, `flap-front-right`, `flap-back-left`, `flap-back-right` | pattes d'angle | `flap` × (H − t) |

- **Plis** (`assembly.folds`) : 8 plis à 90°, en arbre depuis le fond.
  - 4 plis principaux : fond → avant, dos, gauche et droite, sur les arêtes du fond ;
  - 4 plis de pattes : chaque extrémité de l'avant et du dos porte une patte, repliée vers l'intérieur.
- **Coins** : chaque patte se replie de 90° autour de l'arête verticale de l'extrémité de la paroi. Elle repose sur
  le fond et est **collée à plat contre la face intérieure du côté** (`glueTo`, nouveau champ générique de
  `AssemblyPart`). La validation vérifie que les deux pièces sont bien face contre face.
- **Longueur des pattes** : **HYPOTHÈSE.** C'est la règle de patte de collage du projet (`glueFlapWidth`, celle de
  l'étui), appliquée à la hauteur de paroi : 13,8 mm ici. Les pattes avant et arrière d'un même côté ne se touchent
  jamais.
- **Ouverture** : le dessus est vide. Pas de couvercle, pas de charnière ; `closure: "none"`.
- **Angles** : francs. L'ancien arrondi artificiel du bloc (`RoundedBoxGeometry`) n'est plus utilisé pour la
  barquette.

## Surfaces

| Surface | Face physique | Dessin | Taille |
|---|---|---|---|
| `front` | extérieur de la paroi avant | `front` | (L − 2t) × H |
| `back` | extérieur du dos | `back` | (L − 2t) × H |
| `left` / `right` | extérieur des côtés | `side` | W × H |
| `bottom` | dessous du fond | `plain` | (L − 2t) × (W − 2t) |

- **Supprimée** : `top` (`strip`), le dessus imprimé du bloc fermé, qui n'existe pas physiquement.
- **Intérieur** : les faces intérieures (fond, parois) et les pattes existent en 3D, mais ce ne sont **pas** des
  surfaces imprimables. Elles sont en carton uni, et aucune surface `interior-*` n'est créée. C'est la séparation
  géométrie / surfaces d'impression.

## 3D et UV

- Une plaque `BoxGeometry` par pièce (9 maillages, 108 sommets) : c'est le builder d'assemblage déjà utilisé par
  la boîte postale, partagé sans changement de comportement (empreinte de la boîte postale identique).
- Seule la face extérieure d'une pièce imprimée porte l'illustration. La texture garde l'échelle en mm de la
  surface (comme le PDF).
- UV vérifiés par les tests : parois à l'endroit, lecture de gauche à droite vue de l'extérieur ; fond avec son
  haut vers l'avant ; aucune surface inversée.

## Patron

Il est développé depuis cet assemblage en **2C-4D-2** : voir [tray-dieline.md](tray-dieline.md).

## Limites

- **Pattes rectangulaires**, sans chanfrein de dégagement.
- **Pli vif** : pas de compensation d'épaisseur dans les longueurs.
- **Intérieur non imprimable**.
- **Boîte à œufs** : son épaisseur (0,45 mm par défaut) reste fausse pour de la pulpe moulée ; à corriger dans une
  phase dédiée.
- **Présentoir** : il reste un bloc fermé, sa construction propre (façade, fronton) n'est pas définie.

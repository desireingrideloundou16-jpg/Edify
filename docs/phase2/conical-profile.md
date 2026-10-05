# Phase 2C-4F-1 — profil conique et développement exact des pots

Cette phase résout **la géométrie de la paroi conique et son développement exact**. Elle ne traite ni le procédé
industriel, ni la matière.

## Modèles

| shapeId | Modèle | Patron |
|---|---|---|
| `protein-tub`, `yogurt-cup`, `deli-container`, `hair-cream-tub` | `tub` | **supporté** (`template: "conicalWrap"`) |
| `ice-cream-tub` (Pot de glace) | **`papertub`** | non supporté |

Le **pot de glace** prend son propre modèle, comme pizza, présentoir ou sac de farine avant lui.
- En carton, sa paroi est un flan découpé roulé, avec couture, fond rapporté et bord roulé : une construction
  non définie.
- Il garde **exactement** sa 3D, ses UV et sa surface rectangulaire d'avant (empreinte identique).
- Son refus est explicite : « Pot en carton : la paroi est un flan de carton roulé… ».
- Les projets enregistrent `shapeId` : aucune migration.

## 1. Le tronc de cône (`structure/profile/conicalProfile.ts`)

La paroi construite par la 3D est un tronc de cône droit et ouvert, de rayon R en haut, r en bas et de hauteur
verticale h.
- **Source** : `cylinderWrap("tub", L, W, H)`, la même fonction que le builder 3D. Le rayon du bas (`rBottom`) y
  est désormais défini **une seule fois**, et le builder le lit au lieu de le recalculer. Le profil ne contient
  aucune constante propre aux pots.
- **Calcul** : `tubWall(L, W, H)` → `frustumWall(R, r, h)`.

## 2–4. Développement : un secteur d'anneau

| Grandeur | Formule |
|---|---|
| Génératrice | g = √(h² + (R − r)²) |
| Rayon extérieur (bord haut) | R_out = g · R / (R − r) |
| Rayon intérieur (bord bas) | R_in = g · r / (R − r), et R_out − R_in = g |
| Angle (radians) | θ = 2πR / R_out, d'où θ · R_out = 2πR et θ · R_in = 2πr (testé) |

**Disposition du secteur**, vu côté imprimé :
- l'apex est sous le secteur ;
- l'**arc extérieur = le haut du pot** ;
- l'axe vertical = la face ;
- les **deux côtés radiaux = la couture, au dos** (θ = ±π, la couture du maillage 3D).

**Coordonnées de surface** : en mm, origine en haut à gauche de la boîte englobante, y vers le bas.
- Largeur : 2 R_out sin(θ/2).
- Hauteur : R_out − R_in cos(θ/2).

Les arcs sont discrétisés (`arcSegments`) pour qu'aucune corde ne s'écarte de plus de 0,01 mm de l'arc. La face
et les deux coins de couture sont des sommets.

## 5–6. Correspondance secteur ↔ cône et UV

- **Cône → secteur** (`coneToSurface(θ, y)`) :
  - ρ = R_in + (y / h) · g : la génératrice est conservée ;
  - ψ = θ · (angle du secteur) / 2π : les longueurs d'arc sont conservées, ρ · ψ = rayon · θ.
- **Secteur → cône** : `surfaceToCone`, l'inverse exact (aller-retour testé).
- **UV de la paroi 3D** : chaque sommet de la `CylinderGeometry` (silhouette **inchangée**, positions identiques à
  l'octet près) reçoit l'UV de sa propre place dans le secteur.
- **Résultat** : 1 mm d'illustration = 1 mm de paroi, en haut **comme en bas**. L'ancien placage comprimait le bas de
  14 % (0,86) ; le nouveau donne 1 à 1,8 × 10⁻⁴ près, l'écart entre une facette (1/96 de tour) et son arc.
- **Orientation** : couture au dos (colonne de sommets dédoublée : u = 0 à gauche du secteur, u = 1 à droite), face
  au centre, lecture de gauche à droite, sans miroir.

## Surface physique, surface imprimable, illustration

- **Surface** : `wrap` garde son identifiant, mais c'est désormais **le secteur développé**. `wMm × hMm` est sa boîte
  englobante, et `shape` (nouveau champ générique de `PrintSurface`) porte :
  - `outline` : le secteur complet (= la découpe) ;
  - `printOutline` : le secteur **sans la bande du couvercle**.
- **Dessin** : `drawSurface` remplit le fond, dessine l'illustration dans `printArea` (la boîte de `printOutline`),
  **découpée** au secteur imprimable.
- **Illustration non déformée** : elle n'est **ni redimensionnée ni déformée** à plat, puisque son repère est celui
  du patron. C'est la correspondance vers le cône qui fait la transformation.
- **Effet visible** : un texte horizontal à plat suit un léger arc sur le pot. C'est le comportement physique d'une
  étiquette plate posée sur un cône.

## 9. Bande cachée par le couvercle

- **Géométrie** : la jupe du couvercle (rayon 1,025 R, hauteur lidH) commence à H − lidH, sous le haut de la paroi
  (bodyH). Elle cache une bande de hauteur verticale `bodyH − (H − lidH)`, soit `covered · g / h` le long de la
  génératrice.
- **Calcul** : tout vient du builder (`lidH`, `bodyH`), aucune valeur fixe ; un test le vérifie sur le maillage du
  couvercle.
- **Traitement** : la bande reste **physiquement présente**, mais elle est :
  - **exclue de l'impression** (`printOutline`) ;
  - déclarée en zone technique `covered` (`TechnicalZone`, générique), affichée en vert pointillé avec la légende
    « Zone sous le couvercle (non imprimée) », et dans le PDF.

## 10–13. Patron, couture, PDF

- **Patron** : `dieline.ts` → `conicalWrap(wall, coveredSlant, …)`, **un seul contour fermé** (le secteur), sans
  rectangle autour, sans trou ni seconde pièce.
  - Aire = surface latérale π(R + r)·g, à moins de 10⁻⁴ près (polygone inscrit).
  - `creases: []`, aucun pli formé, aucune fente, aucune colle.
- **Couture** : simplement la frontière angulaire du secteur. **Aucun recouvrement** n'est inventé : la paroi
  développée couvre exactement 360°.
- **PDF = aperçu** : le même `FlatLayout` (matière transmise), sans aucun calcul propre au PDF. La page mesure
  secteur + 2 × 3 mm de fond perdu + 2 × 18 mm de marge.

| Pot | R / r / h (mm) | Génératrice | R_out / R_in | Angle | Secteur à plat (mm) |
|---|---|---|---|---|---|
| protein-tub | 60 / 51,6 / 151,64 | 151,872 | 1 084,8 / 932,9 | 19,91° | 375,10 × 165,92 |
| yogurt-cup | 35 / 30,1 / 66,9 | 67,079 | 479,1 / 412,1 | 26,30° | 217,99 × 77,88 |
| deli-container | 57,5 / 49,45 / 62,44 | 62,957 | 449,7 / 386,7 | 46,03° | 351,64 × 93,74 |
| hair-cream-tub | 45 / 38,7 / 62,44 | 62,757 | 448,3 / 385,5 | 36,14° | 278,08 × 81,77 |

## Limitations (non traitées)

- **Procédé** : procédé industriel exact (IML, impression directe, étiquette adhésive), recouvrement de couture.
- **Mise en page** : elle reste celle de l'enveloppe rectangulaire (`drawWrap`), découpée au secteur. Les éléments
  placés près des coins de la boîte englobante (hors secteur) sont donc rognés. Un texte horizontal à plat placé loin
  de l'axe (près de la couture) apparaît **incliné** sur le pot, jusqu'à environ un demi-angle de secteur. C'est
  physiquement exact pour une étiquette plate, mais peu lisible. Une mise en page adaptée au secteur (zone sûre
  inscrite, textes en arc) est une phase à part.
- **Matière** : l'épaisseur des PP reste à 0,1 mm (fausse) ; la transparence de la boîte traiteur n'est pas rendue.
- **Pot de glace** : flan de carton, fond rapporté, bord roulé.
- **Fabrication** : contraintes de thermoformage ou d'injection, compensation d'impression, retrait, tolérances.
- **Facettes** : la paroi 3D reste à 96 facettes, avec un écart de 1,8 × 10⁻⁴ entre une facette et son arc.

# Phase 2C-4E-1 — construction des sacs film à soufflets latéraux

> **Construction de référence**, pas une couverture de tous les sacs du marché. Elle n'inclut ni quad-seal, ni fond
> carré, ni valve, ni zip, ni lien, ni poignée.

## Modèles

| id | Nom | L × W × H (mm) | Matière | Modèle | Patron |
|---|---|---|---|---|---|
| `rice-bag` | Sac de riz | 200 × 90 × 330 | Film PE | `bag` | non (2C-4E-2) |
| `gari-bag` | Sac de gari / farine | 180 × 70 × 280 | Film PE | `bag` | non (2C-4E-2) |
| `pet-food-bag` | Sac croquettes | 250 × 100 × 400 | Film PE | `bag` | non (2C-4E-2) |
| `coffee-bag-gusset` | Sac café soufflet | 110 × 70 × 250 | Kraft + alu | `bag` | non (2C-4E-2) |
| `flour-bag` | Sac de farine | 150 × 80 × 250 | Papier kraft | **`paperbag`** | non supporté |

- **Construction partagée** : les quatre sacs film ont la même construction (film soudable à soufflets latéraux),
  seules les dimensions changent. Elle est paramétrée par L, W, H et l'épaisseur `t` = `materialThickness`.
- **Le sac de farine** : il prend son propre modèle (comme pizza, présentoir ou boîte à œufs). C'est un sac papier
  probablement à fond carré : tube collé et fond plié en diagonales, que le moteur ne sait pas représenter (plis non
  parallèles aux axes). Il garde exactement son ancien bloc 3D (empreinte identique) et refuse le patron avec un
  message explicite. Les projets enregistrent `shapeId` : aucune migration.

## Construction (`structure/profile/bagProfile.ts`)

Une laize imprimée formée en tube :

```
| aileron | ½ dos | soufflet G | face | soufflet D | ½ dos | aileron |
```

- **Soudure longitudinale en aileron** : les deux bords sont retournés **vers l'extérieur** et soudés par leurs faces
  **intérieures** (la seule couche soudable d'un complexe), puis l'aileron est couché à plat sur l'extérieur du dos.
  *Correction 2C-4E-2* : en 2C-4E-1, les ailerons étaient tournés vers l'intérieur, ce qui faisait se toucher leurs
  faces imprimées. Le calcul de la face imprimée (`outerNormal`) l'a mis en évidence lors du développement.
- **Soufflets latéraux** de largeur W − 2t (entre les couches de face et de dos).
- **Fond** : soudure plate transversale sur tout le tube.
- **Haut** : ouvert. Sa bande est soudée par le conditionneur après remplissage (`closure: "heatSeal"`).

| Élément | Valeur | Source |
|---|---|---|
| Soudure basse | `pouchSeals("flatpouch", H).bottom` | règle existante des sachets soudés |
| Soudure haute | `pouchSeals("flatpouch", H).top` | idem |
| Aileron | = soudure basse | **HYPOTHÈSE** (mêmes mâchoires) |
| Montée du fond `rise` | (W − 2t) / 2 | les coins du soufflet se plient à 45° |
| Bande inclinée du fond `slope` | `rise` × √2 | longueur de film de cette bande |
| Longueur de film `flatH` | H − rise + slope | longueur de la laize par sac |

**L × W × H** est l'**enveloppe extérieure du sac rempli**, comme pour toutes les familles (vérifié exactement). Le
film est plus long que H (riz : environ 348,6 mm pour 330 mm), parce que le fond consomme de la longueur.

### Deux vues du même film, calculées à partir des mêmes nombres

- **`bagAssembly`, le tube formé** (état de fabrication), dans `PackagingStructure.assembly` :
  - 7 pièces en plaques de film : `front`, `gusset-left`, `gusset-right`, `back-left`, `back-right`, `fin-left`,
    `fin-right` ;
  - 6 plis à 90° en arbre depuis la face (face → soufflet → demi-dos → aileron) ;
  - la soudure dorsale est une **liaison** (`fin-left.bond = { to: "fin-right", kind: "weld" }`), **pas un pli** ;
  - les soudures transversales sont des `assembly.endSeals` (`seal-bottom`, `seal-top` avec `afterFilling`).

  C'est la donnée d'entrée de la future laize (2C-4E-2, `develop.ts`).
- **`bagShape`, le sac rempli** (3D) : chaque panneau est **le même rectangle de film**, plié selon des droites sans
  étirement. Un test vérifie que chaque triangle 3D garde exactement ses longueurs à plat et que l'aire de chaque
  panneau est celle de son rectangle.
  - **Face et dos** : soudure basse verticale (couches pressées au plan central), bande inclinée à 45°, paroi
    verticale.
  - **Soufflets** : paroi verticale. Sous la paroi, chaque demi-soufflet se plie en deux triangles : l'un couché à
    plat derrière la bande de face (ou de dos), l'autre fermant le coin du fond. Dans la soudure basse, le soufflet
    est plié en deux vers l'intérieur.
  - **Ailerons** : couchés à plat sur l'extérieur du dos, à côté du centre (deux couches de film).

## Nouvelles primitives génériques (petites)

- **`AssemblyPart.bond = { to, kind: "glue" | "weld" | "seam" }`** : une liaison face contre face qui n'est pas un
  pli. `glueTo` (2C-4D) reste tel quel ; c'est le cas « colle ».
- **`assembly.endSeals: EndSeal[]`** : `{ id, kind, edge, widthMm, parts, afterFilling? }`, une soudure
  transversale en bout de tube.
- **`ClosureKind` `"heatSeal"`**.
- **Validation** :
  - la liaison doit être face contre face ;
  - une soudure de bout doit avoir une largeur positive et des pièces existantes ;
  - une surface imprimable peut couvrir plusieurs pièces orientées de la même façon (le dos sur ses deux moitiés).

## Surfaces

| surfaceId | Rôle | Taille (mm) | Zone imprimable |
|---|---|---|---|
| `front` | face extérieure | L × flatH | sans les soudures haute et basse |
| `back` | dos (deux demi-panneaux, une seule illustration) | L × flatH | idem |
| `gusset-left` / `gusset-right` | soufflets | (W − 2t) × flatH | idem |

- **Supprimées** : `top`, `bottom`, `left`, `right` (faces de la boîte déformée).
- **Soudures** : ce ne sont pas des surfaces, elles restent hors `printArea`, comme pour les sachets.
- **Intérieur et ailerons** : film uni.

## 3D et UV

- **UV** : UV = position à plat / taille du panneau. 1 mm de film = 1 mm de l'illustration (testé : gradient UV =
  taille de la surface).
- **Orientation** (testée, sans miroir) : illustration à l'endroit (haut = +y), lecture de gauche à droite vue de
  l'extérieur, normales vers l'extérieur.
- **Intérieur** : la face intérieure du film est une deuxième couche décalée de t, en film uni.
- **Ouverture** : vue plongeante (contrôle manuel) avec le fond en V et l'arête de la soudure basse visibles.

## Épaisseur

`materialThickness` est utilisée telle quelle : 0,1 mm pour le film PE, et **0,2 mm pour « Kraft + alu »**. Ce
dernier tombe dans la règle « métal » prévue pour l'aluminium, ce qui est incohérent pour un complexe. Ce n'est pas
corrigé ici : l'effet sur la construction est minime (largeur des soufflets W − 2t, décalage de la couche
intérieure). C'est à traiter dans une phase dédiée aux matières.

## Limites

- **Fond** : soudure plate uniquement. Le sac rempli repose sur sa soudure basse, sans fond carré.
- **Plis** : idéalisés, sans pli de film arrondi.
- **Couches pressées** : approximées au dixième de millimètre près dans la soudure basse.
- **Épaisseur « Kraft + alu »** : voir ci-dessus.
- **Code-barres et texte du dos** : le dos est coupé par la soudure dorsale au centre ; ce qui la traverse est
  partagé entre les deux fenêtres, et l'aileron couché en masque une bande. Pas encore de zone sûre autour de la couture.

## Phase 2C-4E-2 — laize (patron)

Les 4 sacs film sont **supportés** (`template: "sideGussetBag"`). La laize est **développée depuis l'assemblage** par
`foldedSheet` / `develop.ts` : racine = la face, vue de l'extérieur, debout (`BAG_ROOT`).

```
| aileron G | ½ dos (fenêtre L/2 → L) | soufflet G | face | soufflet D | ½ dos (fenêtre 0 → L/2) | aileron D |
```

- **Une seule pièce** : un rectangle (4 sommets) d'aire égale à la somme des panneaux. Il n'y a **pas de fente** (les
  panneaux sont tous pliés entre eux) et **pas de colle**.
- **Plis formés** (`FoldKind` `"formed"`, générique) : les 6 plis du tube sont faits par la machine, pas rainés. Ils
  sont dans `formedFolds` (et `hinges[].kind`), **jamais** dans `creases`. Ils sont tracés en bleu pointillé fin, avec
  la légende « Pli formé » ; le PDF indique « pli formé (non rainé) ». Les cartons gardent leurs rainages inchangés
  (valeur par défaut `"crease"`).
- **Soudures** (`SealZone`, générique), tracées en gris encadré et quadrillé :
  - **ailerons** : la liaison `weld` produit une zone sur **chacun** des deux ailerons, soudés par leurs faces
    intérieures (testé) ;
  - **soudure basse** : bande au pied de la laize, de la largeur utilisée par la 3D ;
  - **soudure haute** : bande en tête, marquée **après remplissage** (contour en tirets).

  Les soudures ne sont ni des plis ni des découpes. L'illustration s'arrête aux deux soudures (`printArea`).
- **Dos** : une seule surface `back` sur deux panneaux. Chaque demi-dos est une **fenêtre** (`surfaceOffsetMm`,
  calculé de façon générique par `surfaceWindows`) :
  - demi-dos droit : [0 ; L/2] ;
  - demi-dos gauche : [L/2 ; L].

  Refermé, le dos se lit en continu. Un test vérifie, pour chaque surface, qu'un point a la même position dans
  l'illustration en 3D et sur la laize.
- **Orientation** : toutes les surfaces sont à l'endroit dans la laize (rotation 0), sans miroir (`outerNormal` = face
  imprimée de la 3D).
- **Longueur** : la longueur du film vient de l'assemblage (`flatH`), pas de H.
- **Aperçu = PDF** : le même `FlatLayout`, matière comprise (testé : changer la matière change la laize).

| Sac | Laize (mm) | Face | Soufflet | ½ dos | Aileron | Soudure haute / basse | PDF (mm) |
|---|---|---|---|---|---|---|---|
| Sac de riz | 615,6 × 348,6 | 200 | 89,8 | 100 | 18 | 21,45 / 18 | 657,6 × 390,6 |
| Sac de gari | 530,4 × 294,46 | 180 | 69,8 | 90 | 15,4 | 18,2 / 15,4 | 572,4 × 336,5 |
| Sac croquettes | 735,6 × 420,67 | 250 | 99,8 | 125 | 18 | 22 / 18 | 777,6 × 462,7 |
| Sac café | 386,7 × 264,41 | 110 | 69,6 | 55 | 13,75 | 16,25 / 13,75 | 428,7 × 306,4 |

Le fond perdu (3 mm) et les marges (18 mm) s'ajoutent autour de la laize. Le sac café utilise t = 0,2 mm (« Kraft +
alu », règle « métal » héritée, non corrigée).

Limites :
- **Plis à 45° du fond** : réels mais non tracés, car absents de l'assemblage du tube. Le pli central des soufflets
  est tracé depuis 2C-4E-3.
- **Résolution** : le sac croquettes sort à 274 dpi, à cause du plafond existant de 8 000 px du PDF.
- **Laize unitaire** : pas de pas de répétition, pas de repère d'impression (eyemark), pas de sens de déroulement.

## Phase 2C-4E-3 — zone technique de couture et plis centraux des soufflets

Deux ajouts, sans rien changer d'autre à la laize : dimensions, contour, surfaces, rotations, fenêtres, soudures et
3D sont identiques, octet pour octet, une fois ces ajouts retirés (vérifié sur les 4 sacs).

### Zone technique de la couture dorsale

- **Primitive générique** `TechnicalZone` (`PackagingStructure.technicalZones`) : `{ id, kind, panel, surfaceId,
  polygon, note }`, avec `kind` parmi `seam`, `glue`, `seal`, `fold`, `margin`.
  - C'est une zone **imprimée** où il faut éviter les éléments critiques (code-barres, QR code, textes, logos,
    numéro de lot, mentions légales).
  - Ce n'est ni une découpe, ni un pli, ni une fente, ni une colle, ni une soudure.
  - Seul le type `seam` est produit aujourd'hui.
- **Calcul** (`develop.ts`, `seamStrips`) : chaque aileron soudé (liaison `weld` ou `seam`) est attaché à son demi-dos
  par un pli. Couché sur ce demi-dos, il en recouvre l'image miroir par rapport à la ligne de pli. Comme l'aileron
  peut être couché d'un côté ou de l'autre, les deux images forment la zone :
  - une bande de la **largeur de l'aileron** de chaque côté de la couture (rien n'est écrit en dur : un aileron
    élargi élargit la zone, testé) ;
  - limitée à la **longueur imprimable**, entre la soudure haute et la soudure basse (les bandes `endSeals`).
- **Relation avec le dos** : la surface `back` reste **une seule** surface logique, imprimable. Chaque zone porte le
  panneau qui la contient (`back-left` / `back-right`) et `surfaceId: "back"`. Les fenêtres `surfaceWindows` /
  `surfaceOffsetMm` sont inchangées.
- **Rendu** :
  - aperçu : vert clair (la couleur des repères, comme le fond perdu) avec un contour pointillé, légende « Zone
    technique — couture dorsale » ;
  - PDF : les mêmes polygones du même `FlatLayout`, légende « Vert pointillé : zone technique (couture), éviter les
    éléments critiques ».

### Plis centraux des soufflets

- **Primitive générique** `AssemblyPart.innerFolds` (`InnerFold { id, edge, kind }`) : un pli **à l'intérieur** d'une
  pièce, et non entre deux pièces.
- **Définition** : `bagAssembly` le place sur l'axe central de chaque soufflet (`gusset-left-centre`,
  `gusset-right-centre`), de type `formed`, de la soudure basse à la soudure haute.
- **Projection** : `innerFoldLines` le projette sur la laize par la carte de développement du soufflet.
- **Données** : `structure.innerFolds` (avec ids) et `formedFolds`, ce qui donne 8 plis formés en tout. Jamais dans
  `creases`.
- **Rendu** : le même que les autres plis formés (bleu pointillé fin, « pli formé (non rainé) »).

### Hors périmètre

Restent hors de cette phase :
- les plis à 45° du fond ;
- le repère d'impression (eyemark), le sens de déroulement et la répétition de laize ;
- toute optimisation industrielle de bobine ;
- la correction de l'épaisseur « Kraft + alu » et la résolution du PDF ;
- le sac papier et les pots.

La zone technique est une **indication**, pas un contrôle automatique : rien n'empêche encore de placer un élément
critique dessus (un futur contrôle avant impression pourra s'en servir).

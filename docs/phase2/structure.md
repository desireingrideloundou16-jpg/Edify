# Structure packaging (phase 2C-1)

`src/lib/structure/` est la source de vérité structurelle d'un packaging. C'est un module pur : pas de DOM, pas de
React, pas de three.js, pas de réseau, pas de hasard.

```
PackagingShape (catalogue) ──► resolveStructure() ──► PackagingStructure
                                                        ├── print/layout.ts  (FlatLayout : aperçu 2D, PDF)
                                                        ├── 3D            (phases 2C-3 / 2C-5)
                                                        ├── SVG, preflight (phase 2C-6)
                                                        └── Phase 3 : PackagingIntent → resolveStructure()
```

## Pourquoi

Avant cette phase, le patron (`print/layout.ts`) et la 3D (`three/packagingModels.ts`, `three/geometry/*`)
recalculaient chacun la structure de leur côté. Huit modèles recevaient un faux patron d'étui à rabats (brique,
coffret rigide, boîte postale…). `resolveStructure()` est désormais le seul endroit où l'on décide de la famille,
du gabarit, des surfaces imprimables et du support du patron.

## Unité canonique : le millimètre

Toutes les valeurs de la structure sont en mm. Le patron à plat a l'axe y vers le bas et son origine en haut à gauche
du contour de découpe. Les conversions se font seulement aux bords : pixels (canvas), points (PDF), unités de scène
(3D, voir `userData.mmPerUnit` posé par `buildPackaging`) et mètres (AR).

## Familles

| Famille | Modèles | Ce qui est plat |
|---|---|---|
| `dieline` | box, mailer, rigid, pillow, tray, carton | le carton entier (découpe, plis, panneaux) |
| `profile` | bottle, wine, dropper, pump, spray, jug, jar, tin, tub, cup, papertube, tube, can | seulement l'étiquette ou l'enveloppe ; la forme vient du constructeur 3D (`profile.builder`) |
| `flexible` | pouch, flatpouch, sachet, bag, shopper | les feuilles (face, dos, soufflet) |

`MODEL_RULES` couvre explicitement les 24 `ShapeModel` : le type `Record<ShapeModel, …>` fait échouer la compilation
si un modèle manque.

## `PackagingStructure`

| Champ | Contenu |
|---|---|
| `family`, `model`, `outerMm {L, W, H}` | famille et dimensions du catalogue |
| `material {name, thicknessMm, thicknessSource}` | épaisseur lue dans le nom (« Carton rigide 1,5 mm ») ou valeur **nominale** par type (`"default"`) : à remplacer par une spécification d'imprimeur plus tard |
| `dieline` + `dielineNote` | `"supported"` ou `"unsupported"` (avec la raison affichée à l'utilisateur) |
| `template`, `flatMm`, `kindLabel`, `panels`, `cut`, `creases`, `glue`, `rootPanel` | patron (formats supportés seulement) |
| `hinges` | déclaré, vide : charnières avec sens montagne / vallée en 2C-5 |
| `profile {builder, sectionMm}`, `closure {kind}` | formes profilées et type de fermeture |
| `seals` | déclaré, vide : soudures des sachets en 2C-3 |
| `printSurfaces` | surfaces imprimables (voir ci-dessous) |
| `bleedMm` | `BLEED_MM` = 3 mm (constante déplacée ici, réexportée par `print/layout.ts`) |

`validatePackagingStructure()` vérifie les dimensions, les nombres finis, l'unicité des identifiants et les références
entre panneaux, surfaces et charnières.

## `PrintSurface`

Une surface imprimable a un identifiant stable (`front`, `back`, `left`, `right`, `top`, `gusset`, `label`, `wrap`),
indépendant de sa position dans le patron et de tout index de tableau. Elle porte sa taille en mm, sa façon d'être
dessinée (`draw.kind`, `frontFraction`, `rotate`) et une zone sûre nominale (`SAFE_MM` = 3 mm, bornée au quart du plus
petit côté). Chaque panneau du patron référence sa surface (`panel.surfaceId`), et le `Panel` de `FlatLayout` la
transporte aussi.

Pour les formats sans patron, `printSurfaces` décrit les faces nominales imprimées par la 3D aujourd'hui.
L'alignement exact entre les surfaces et la 3D se fera en 2C-3.

## Règle « unsupported »

Un format sans gabarit valide n'a **pas** de patron :

- `flatLayout()` lève `UnsupportedDielineError` au lieu de produire un faux étui ;
- `resolveFlatLayout()` ne lève jamais d'erreur et renvoie `{ supported: false, message }` ;
- l'aperçu « Patron à plat » affiche le message, l'export PDF le signale à l'utilisateur, et l'archive ZIP est livrée
  sans PDF, avec la raison dans `fiche-technique.json`.

Formats non supportés aujourd'hui : `carton`, `rigid`, `mailer`, `tray`, `pillow` (gabarits en 2C-4), `jug`, `bag`,
`shopper`, ainsi que `tub` et `cup`, dont l'étiquette conique se découpe en arc et non en rectangle.

## Compatibilité avec `print/layout.ts`

`layout.ts` est devenu un adaptateur (`layoutFromStructure`). Les gabarits (`tuckEndBox`, `wrapLabel`, `frontBack`)
ont été déplacés **à l'identique** dans `structure/dieline.ts`. Vérification faite sur les 119 formes du catalogue : les
87 formes supportées produisent exactement le même `FlatLayout` qu'avant (même contour, mêmes plis, mêmes panneaux),
avec en plus `surfaceId`. Les autres consommateurs (`print/artwork.ts`, `exportPrintPdf.ts`) n'ont pas changé.

## Phase 3

L'AI Packaging Director produira un `PackagingIntent` (aujourd'hui égal à `StructureInput` : modèle, dimensions en mm,
matière), validé, puis passé à `resolveStructure()`. L'IA ne fournit jamais de sommets, d'UV, de coordonnées de patron
ni de transformations 3D.

## Phase 2C-2 — étiquettes alignées sur la géométrie 3D

Pour les contenants profilés, la surface imprimable est définie une seule fois, dans
`structure/profile/labels.ts`, à partir du modèle physique :

| Fonction | Modèles | Largeur | Hauteur |
|---|---|---|---|
| `bottleLabel` | bottle, wine, dropper, pump, spray | périmètre réel de la section (cercle, ellipse, rectangle arrondi) × couverture de la famille | zone d'étiquette sur la partie droite du corps, entre le congé de base et l'épaule |
| `jarLabel` | jar | 0,7 × périmètre de la section ronde | 0,62 × hauteur du corps |
| `cylinderWrap` | can, tin, papertube, tube (et tub, cup, non supportés) | circonférence 2πR | corps imprimé (canette : entre les cols ; boîtes : sous le couvercle) |

La 3D (`three/packagingModels.ts`) place et texture ses étiquettes avec ces fonctions, et `resolveStructure()` en fait
les `printSurfaces` : **surface texturée 3D = étiquette du patron = PDF**, par construction.

Pour y parvenir sans three.js dans la structure, les calculs purs ont été déplacés sans modification :

- `structure/profile/bottleProfile.ts` : sections, épaules, hauteurs, familles et préréglages (+ `bottleMetrics()`) ;
  `three/geometry/bottleGeometry.ts` les réexporte ;
- `structure/profile/closureProfile.ts` : types de fermeture, `closurePreset()` et `closureTop()`, la hauteur de la
  fermeture calculée avec les formules des profils 3D. La bouteille s'arrête là où commence sa fermeture, donc cette
  hauteur fixe celle de l'étiquette. Un test la compare à la boîte englobante de la vraie géométrie.

Vérifications : les 119 modèles 3D du catalogue sont identiques au bit près avant et après (positions et tailles de
textures). Les 36 patrons hors étiquettes (étuis, sachets, canettes, tubes) sont inchangés. Seuls les 51 patrons
d'étiquettes concernés changent, pour devenir exacts.

## Phase 2C-3 — surfaces d'impression partagées 3D ↔ impression

Une surface physique = un identifiant = une taille = un dessin, pour la 3D comme pour l'impression.

```
resolveStructure() ──► PrintSurface { id, wMm, hMm, printable, printArea?, draw, placement? }
                          │                                        │
          3D : texture de la surface (packagingModels)   Patron / PDF : panneau surfaceId
                          └────────── artwork/surface.ts : drawSurface() ──────────┘
```

- `PrintSurface` gagne `printable` (patte de collage, faces intérieures, ouverture du sac : présentes physiquement,
  jamais imprimées), `printArea` (zone d'illustration plus petite que la surface : sachets, hors soudures) et
  `placement` (pièce et face où la 3D la pose : `{ part: "lid", face: "+y" }`).
- **Ce qui est dessiné** sur une surface est décidé une seule fois par `drawSurface()` (`artwork/surface.ts`) :
  le patron (`print/artwork.ts`) et les textures 3D l'appellent tous les deux. Les moteurs restent différents
  (canvas du PDF, texture WebGL), le contenu est commun.
- **Définitions physiques partagées** (pures, dans `structure/profile/`) : `boxProfile.ts` (pièces des boîtes,
  coffret, bidon, sacs et le type de chaque face), `cartonProfile.ts` (dimensions de la brique, déplacées depuis
  `cartonGeometry.ts`), `flexibleProfile.ts` (largeur des soudures, utilisée aussi par `pouchGeometry.ts`).
- La 3D marque chaque matière imprimée avec `userData.surfaceId` ; un test vérifie sur les 119 formes qu'aucune
  surface n'est orpheline (3D → structure, structure → 3D, structure → patron).

| Surface | 3D | Patron / PDF | Id |
|---|---|---|---|
| Dessus d'étui | face +y, marque (`strip`) | panneau de rabat, `strip`, retourné à 180° | `top` |
| Fond d'étui | face −y, `plain` | rabat sous la face avant, `plain` (**ajouté**) | `bottom` |
| Côtés | ±x | panneaux de part et d'autre de la face | `right` / `left` |
| Patte de collage | — | dans le contour, non imprimée | `glue` (printable: false) |
| Face / dos de sachet | groupes 0 / 1 du maillage, `drawFace` | panneaux face / dos | `front` / `back` |
| Soufflet | groupe 2 (plaque du fond) | bande sous les panneaux | `gusset` |
| Soudures | bandes serties | `seals` + `printArea` (sans illustration) | `seal-top` / `seal-bottom` |
| Corps de brique | tube chanfreiné | bande du corps (2C-4A) | `body` |
| Pans du toit de brique | groupes 0 / 1 du toit | panneaux du toit (2C-4A) | `roof-front` / `roof-back` |
| Étiquette / enveloppe | voir 2C-2 | voir 2C-2 | `label` / `wrap` |

Corrections de correspondance (le reste de la 3D est identique au bit près) :

- **Sachets** : la 3D enroulait une seule texture `drawWrap` autour du sachet, avec la couture au milieu du dos (le
  texte du dos était coupé et décalé). Le maillage est désormais découpé en panneaux face / dos / soufflet (mêmes
  triangles, mêmes normales), avec des UV calculés sur la longueur réelle de chaque rangée. Chaque panneau est dessiné
  comme sur le patron.
- **Brique** : la texture du corps était déclarée à 0,83 · H au lieu de la hauteur réelle du tube (illustration
  écrasée de 14 % sur OKKO), et le toit à L × W au lieu de L × pente. Les deux pans sont maintenant deux surfaces.
- **Étui** : le dessus du patron montre ce que montre la 3D (la marque), et le fond imprimé en 3D figure maintenant
  sur le rabat du fond.

## Phase 2C-4A — gabarit réel de la brique à pignon

`model: "carton"` est désormais `supported` (`template: "gableTop"`, `dieline.ts` → `gableTopCarton`). Le gabarit
est le développement à plat de la brique 3D, calculé avec les mêmes nombres (`cartonDims(cartonConfigFor(L, W, H))`)
et les mêmes surfaces : aucune surface propre au patron.

```
 fin   ┌──────┬──────────┬──────┬──────────┐
       │pignon│ roof-    │pignon│ roof-    │   pignons : soufflets repliés, diagonales jusqu'à l'apex
 toit  │  /\  │ front    │  /\  │ back     │
 ──────├──────┼──────────┼──────┼──────────┤┐
 corps │gauche│  face    │droite│   dos    ││ glue (non imprimée)
       └──────┴──────────┴──────┴──────────┘┘
```

| Élément | Valeur | Source |
|---|---|---|
| Largeur du corps | périmètre du tube 3D chanfreiné | `body.wMm` = `cartonDims().perimeter` |
| Hauteur du corps | soudure basse → pli du toit | `body.hMm` = `bodyPrintH` |
| Pans du toit | L × pente | `roof-*.wMm/hMm` = L × `roofSlant` |
| Face / dos | L (sous les bords des pans) | idem |
| Côtés | (P − 2L) / 2 | reste du périmètre |
| Crête (fin) | `ridgeH` | `cartonDims()` |
| Patte de collage | règle commune `glueFlapWidth(W)` | partagée avec l'étui |

- **Plis** : pli du toit et pli de crête sur toute la largeur, coins verticaux, pli de patte, et pour chaque pignon
  deux diagonales coin → apex (de longueur égale à la pente, comme l'arête du triangle 3D) et un pli central.
- **Couture** : sur l'arête dos/gauche. Une couture au centre du dos couperait `roof-back` en deux. Le panneau du corps
  montre donc la surface `body` décalée d'un demi-dos (`Panel.surfaceOffsetMm = L / 2`, validé dans
  `[0, wMm)`) : l'illustration est celle du tube 3D, dont l'UV commence au centre du dos. Le PDF dessine cette
  fenêtre par deux appels à `drawSurface`, avec un découpage au rectangle du panneau.
- **Panneaux sans surface** (pignons, crête) : présents dans le contour et dans `panels`, mais absents du `FlatLayout`
  (seuls les panneaux imprimés y figurent). Ils prennent le fond, comme leur matière unie en 3D.
- **3D** : inchangée (empreinte identique à 2C-3 sur les 119 formes).

Limites connues :

- **Fond non modélisé** : la 3D n'a pas de fond plié, donc le patron s'arrête au bas du corps (indiqué dans
  `kindLabel`).
- **Épaisseur** : nominale, non appliquée (aucune compensation de pli).
- **Texte du dos** : `drawWrap` place le texte du dos à cheval sur la demi-largeur gauche du dos et le côté gauche.
  Il traverse donc la couture de collage, comme il traverse l'arête en 3D. Le corriger demande une composition de
  l'enveloppe par face, prévue pour une phase ultérieure.

## Phase 2C-4B — gabarit réel du coffret rigide

`model: "rigid"` (Coffret rigide, Coffret montre, Boîte à chaussures, Grand coffret cadeau) est désormais
`supported` (`template: "rigidSetUp"`, `dieline.ts` → `rigidSetUpBox`).

**Construction réelle** (lue dans la 3D, `boxParts("rigid")`) : coffret à couvercle séparé, de type « couvercle
cloche ».
- Le fond est un plateau ouvert, L × W × 0,78 H, dont le dessus (`base-top`) est l'ouverture.
- Le couvercle est un plateau ouvert retourné, 1,015 L × 1,015 W × 0,30 H, posé sur le haut du fond ; son dessous
  (`lid-bottom`) est l'ouverture.
- Il n'y a ni charnière, ni aimant, ni épaulement, ni plateau intérieur, ni tiroir.

**Patron** : deux pièces sur la même feuille, chacune développée en croix (panneau central et 4 parois articulées
sur ses arêtes), aux dimensions des pièces 3D. Les pièces sont séparées par 2 × fond perdu.

```
        ┌front─┐               ┌─back─┐
   ┌────┼──────┼────┐     ┌────┼──────┼────┐
   │left│ fond │right│     │left│dessus│right│
   └────┼──────┼────┘     └────┼──────┼────┘
        └─back─┘               └front─┘
     fond (vu de dessous)    couvercle (vu de dessus)
```

- **Surfaces** : seulement les 12 surfaces existantes `base-*` et `lid-*`. Les 10 surfaces imprimables ont chacune
  leur panneau. Les ouvertures (`base-top`, `lid-bottom`, `printable: false`) n'ont pas de panneau, car ce n'est pas
  de la matière.
- **Plis** : les 4 arêtes du panneau central de chaque pièce (8 au total), et aucun autre.
- **Découpe** : deux contours fermés en croix, coins dégagés. Nouveau champ `extraCuts` (structure et
  `FlatLayout`) pour les pièces supplémentaires ; l'aperçu (`drawDieline`) et le PDF (page 2) les tracent.
- **Rabats, pattes, collage** : aucun. Les coins d'un coffret monté se ferment par bande d'angle, et l'habillage est
  collé sur toute la surface : ce ne sont pas des éléments du patron.
- **Orientation** : `draw.rotate` accepte maintenant 90 et 270 (sens horaire, sur la feuille à plat seulement). La 3D
  dessine toujours la surface à l'endroit. Le fond est vu de dessous, face en haut ; le couvercle est vu de dessus,
  dos en haut. Cela correspond aux UV de `RoundedBoxGeometry`, vérifié par un test. Les parois du fond lisent leur
  bas vers le panneau central, celles du couvercle leur haut.

  | Paroi | Rotation |
  |---|---|
  | `base-back`, `lid-back` | 180° |
  | `base-left` | 270° |
  | `base-right` | 90° |
  | `lid-left` | 90° |
  | `lid-right` | 270° |

  Dans le `FlatLayout`, un panneau tourné d'un quart de tour mesure `hMm × wMm` (`quarterTurn`), et
  `renderFlatArtwork` y dessine la surface à l'endroit avant de la tourner. Tout passe par `drawSurface`.
- **3D** : inchangée (empreinte identique sur les 119 formes).

Limites connues :

- **Rempli et oreilles non inclus** : l'habillage papier réel déborde à l'intérieur des parois (rempli) et a des
  oreilles d'angle. La 3D ne modélise ni l'intérieur ni ces débords, et leur largeur est un choix de fabrication :
  le patron est l'habillage extérieur exact, sans rempli (indiqué dans `kindLabel`).
- **Épaisseur** : lue dans le nom de la matière (1,5 ou 2 mm), non appliquée au patron (pas de compensation
  carton gris / habillage). Le jeu du couvercle (+1,5 %) vient de la 3D, pas de l'épaisseur.
- **Grands formats** : la Boîte à chaussures (930 × 387 mm à plat) sort à 217 dpi, à cause du plafond existant de
  8 000 px du PDF.

## Phase 2C-4C-0 — construction de référence de la boîte postale

Il n'y a pas encore de patron (prévu en 2C-4C). Cette phase remplace le bloc fermé des boîtes postales par une
vraie construction en carton plié, commune à la 3D et à la structure (`profile/mailerProfile.ts`,
`PackagingStructure.assembly`).

**Catalogue**

| Construction | Modèles |
|---|---|
| A — boîte postale à rabat d'insertion (`model: "mailer"`) | `ecom-mailer`, `mailer-small`, `mailer-large`, `subscription-box` |
| B — constructions propres, non définies | `pizza-box` (`model: "pizza"`), `burger-box` (`model: "clamshell"`, coque à charnière) |

Les modèles B gardent exactement l'ancien bloc 3D (empreinte identique) et restent non supportés. Les projets
enregistrent `shapeId`, et le modèle est relu dans le catalogue : aucune donnée n'est à migrer.

**Construction A** (type FEFCO 0427, une seule feuille). Axes three.js : x = L, y = haut, z = W (avant +).
L × W × H du catalogue = **encombrement extérieur exact**. Le carton (épaisseur t) est à l'intérieur.

| Pièce | Rôle |
|---|---|
| `bottom` | fond, entre les parois |
| `front` + `front-inner` | paroi avant double, roulée sur son arête haute (pli 180°) |
| `back` | dos simple ; porte la **charnière** du couvercle à son arête haute |
| `left` / `right` + `*-inner` | côtés doubles, roulés (180°) |
| `ear-front-*`, `ear-back-*` | oreilles des extrémités avant et dos, prises entre les deux épaisseurs du côté |
| `top` | couvercle, entre les bords roulés des côtés et devant le bord roulé avant |
| `tuck` | **rabat d'insertion**, sous l'avant du couvercle, derrière la double paroi avant |
| `dust-left` / `dust-right` | rabats anti-poussière du couvercle, à l'intérieur des côtés |

Dimensions intérieures : L − 6t (côtés : extérieur + oreille + retour) × W − 3t (avant double + dos) × H − 2t
(fond + couvercle).

- **Plis** (`assembly.folds`) : 15 plis pour 16 pièces. Ils forment un arbre depuis le fond, ce qui confirme une
  feuille unique ; chacun relie deux pièces le long de leur arête commune.
- **Charnière** : une seule (`hinge: true`), entre l'arête haute du dos et l'arrière du couvercle. Les tests ouvrent
  le couvercle à 90° et 180° : il ne traverse aucune pièce du fond.
- **Fermeture** : `closure.kind = "tuck"` (rabat d'insertion).
- **Colle** : aucune ; la boîte tient par ses doubles parois et ses oreilles.

**Paramètres** (`MAILER_RULES`, centralisés, **HYPOTHÈSES de conception Edify**, à valider avec un cartonnier) :
- rabat d'insertion = 0,5 × hauteur intérieure ;
- rabats anti-poussière = 0,5 × hauteur intérieure ;
- oreilles = 0,45 × (W − 2t), pour que les oreilles avant et arrière d'un côté ne se touchent jamais.

**Surfaces** : les ids ne changent pas (`right`, `left`, `top`, `bottom`, `front`, `back`), de même que le type de
dessin de chacune. Seules leurs tailles changent : ce sont celles des faces extérieures réelles des pièces.
- `front` : (L − 2t) × H ;
- `back` : (L − 2t) × (H − t) ;
- côtés : W × H ;
- `top` : (L − 6t) × (W − 2t) ;
- `bottom` : (L − 2t) × (W − 2t).

Les pièces intérieures (retours, oreilles, rabats) n'ont pas de surface d'impression : elles sont en carton uni.

**3D** : une plaque `BoxGeometry` par pièce, dont seule la face extérieure imprimée porte l'illustration. Les UV
sont vérifiés par les tests :
- parois : haut de l'illustration en haut, lecture de gauche à droite vue de l'extérieur ;
- couvercle : haut vers le dos ;
- fond : haut vers l'avant.

**Épaisseur** : `materialThickness` lit maintenant la lettre de cannelure. B = 3 mm nominal (au lieu de 1,5 :
seule la Grande boîte postale est concernée) ; E et « ondulé » sans lettre restent à 1,5 mm. Les autres cannelures
gardent 1,5 mm tant qu'aucun pack n'en dépend.

Limites :
- **Pas de languettes de verrouillage** : les retours intérieurs reposent sur le fond, mais leurs languettes et les
  fentes du fond ne sont pas modélisées (à définir avec le patron 2C-4C).
- **Pas de rayon de pli** : plis à arête vive, sans rayon de cintrage ni compensation d'écrasement de la cannelure.
- **Coins** : de petits jeux de l'ordre de t restent aux coins arrière hauts, comme sur une boîte réelle.
- **Intérieur non imprimable** : l'impression intérieure n'est pas proposée.
- **Couvercle fermé** : l'éditeur affiche la boîte fermée ; l'ouverture n'est utilisée que par les tests.

## Phase 2C-4C — patron réel de la boîte postale

Les 4 boîtes postales (`ecom-mailer`, `mailer-small`, `mailer-large`, `subscription-box`) sont désormais
`supported` (`template: "rollEndTuckFront"`). Pizza et burger restent non supportés. Il reste 21 formats non
supportés au catalogue.

**Développement à plat** (`structure/develop.ts`, générique) : le patron est **calculé depuis
`assembly`**, sans coordonnée écrite à la main.
- **Racine** : le fond, vu de dessous (côté imprimé), avant en haut. C'est la convention du fond du coffret
  rigide (`MAILER_ROOT`).
- **Parcours de l'arbre des plis** : chaque enfant garde sa coordonnée le long de l'arête de pli et s'étend
  au-delà de son parent, sur sa propre longueur (pli vif, la même idéalisation que la 3D). L'angle de pli (90° ou
  180°) indique le sens du repli en volume ; il ne change pas la position à plat.
- **Panneaux** : 16, un par pièce de carton, à ses dimensions. Le panneau d'une pièce imprimée porte sa surface.
- **Contour** : `cut` est le contour de l'union des panneaux. Il est unique, fermé et simple, et son aire égale la
  somme des panneaux. `extraCuts` est interdit par la validation : c'est une seule feuille.
- **Plis** : 15, un par pli de l'assemblage, sur la frontière commune des deux panneaux et à la longueur de
  l'arête 3D. `hinges` est maintenant produit (`from`, `to`, ligne, angle) ; tous les plis sont des plis
  « montagne » vus du côté imprimé, car tout se replie vers l'intérieur.
- **Fentes** (`slits`, nouveau champ, tracé en magenta comme la découpe) : quand deux panneaux se touchent sans
  être pliés ensemble, un trait de coupe les sépare. Il y en a 8, aux 4 coins du fond : chaque côté est séparé de
  l'oreille et de la paroi avant ou du dos voisins. Un test vérifie que toute longueur de contact est soit un pli,
  soit une fente.
- **Orientation des surfaces** : calculée en reportant le haut de l'illustration de chaque face (UV de la 3D,
  `FACE_UP`) dans le patron.

  | Surface | Rotation |
  |---|---|
  | `front`, `top`, `bottom` | 0° |
  | `back` | 180° |
  | `right` | 90° |
  | `left` | 270° |

  Vérification indépendante : le haut de chaque illustration est sur le bon pli physique (bord roulé pour les
  parois, charnière pour le dos et le couvercle, pli fond/avant pour le fond).

**Disposition** (de haut en bas) : retour avant, paroi avant, fond (avec les côtés, puis leurs retours, à gauche
et à droite), dos, couvercle, rabat d'insertion. Les oreilles sont aux extrémités de l'avant et du dos, et les
rabats anti-poussière de part et d'autre du couvercle.

**Rabats et fermeture** : le rabat d'insertion, les rabats anti-poussière et les oreilles viennent de l'assemblage,
avec les tailles de `MAILER_RULES`. La fermeture se fait par le rabat d'insertion, glissé derrière la double paroi
avant (`closure: "tuck"`).

**Languettes et fentes de verrouillage : non ajoutées (décision).** La construction se ferme sans elles : les
oreilles sont prises dans les doubles parois, et les rabats anti-poussière et le rabat d'insertion maintiennent
l'ensemble quand le couvercle est fermé. Couvercle ouvert, les retours intérieurs ne tiennent que par friction.
Des languettes s'emboîtant dans le fond les verrouilleraient ; elles demandent de nouveaux paramètres et une
modification de l'assemblage, à décider avec un cartonnier.

**Colle** : aucune.

**PDF** : `generatePrintPdf` (et la page `/dev-renders`) passe maintenant la **matière** à `flatLayout`, comme
l'aperçu. Avant, le PDF calculait le patron avec l'épaisseur par défaut (0,45 mm). Le défaut était sans effet
jusqu'ici, aucun patron ne dépendant de l'épaisseur ; il fausse un patron développé depuis le carton plié.

Formats à plat :

| Boîte | À plat (mm) |
|---|---|
| Boîte postale | 454 × 519,5 |
| Petite | 344 × 384,5 |
| Grande | 738 × 829 |
| Box abonnement | 634 × 704,5 |

Limites :
- **Oreilles rectangulaires**, telles que décrites par l'assemblage. Hypothèse : pas de chanfrein de dégagement.
- **Pli vif** : pas de double rainage sur les plis roulés à 180°, pas de compensation d'épaisseur dans les
  longueurs. Le pli roulé des côtés passe sur 3 épaisseurs.
- **Pas de languettes de verrouillage** (voir ci-dessus).
- **Résolution** : la Grande boîte postale sort à 243 dpi et la Box abonnement à 286 dpi, à cause du plafond
  existant de 8 000 px du PDF.

## Phase 2C-4D-1 — construction de la barquette

La barquette (`food-tray`, `model: "tray"`) est maintenant un plateau ouvert à coins collés, en carton plié
(`profile/trayProfile.ts`, `assembly`). Le présentoir comptoir (`display`) et la boîte à œufs (`moulded`) ont des
modèles propres, avec leur bloc 3D inchangé. Il n'y a pas encore de patron. Détails :
[tray-construction.md](tray-construction.md).

## Phase 2C-4D-2 — patron de la barquette

La barquette est supportée (`gluedCornerTray`). Son patron est développé depuis l'assemblage par `foldedSheet`.
Cette phase introduit la primitive générique `glueZones`, déduite de `glueTo` (panneau, pièce cible, côté de la
feuille, polygone), dessinée en gris hachuré dans l'aperçu et en gris dans le PDF. Détails :
[tray-dieline.md](tray-dieline.md).

## Phase 2C-4E-1 — construction des sacs film

Les 4 sacs film (`bag`) sont désormais un tube de film à soufflets latéraux : soudure dorsale en aileron (liaison
générique `bond`, kind `weld`), soudure basse plate, haut ouvert soudé après remplissage (`endSeals`). Leur 3D est
le film plié sans étirement (`bagShape`). Le sac de farine passe au modèle `paperbag`, inchangé et non supporté.
Il n'y a pas encore de patron. Détails : [bag-construction.md](bag-construction.md).

## Phase 2C-4E-2 — laize des sacs film

Les 4 sacs film sont supportés (`sideGussetBag`). La laize est développée depuis l'assemblage. Cette phase ajoute
trois éléments génériques :
- `FoldKind` (`crease` / `formed`) : les plis formés vont dans `formedFolds`, jamais dans `creases` ;
- `SealZone` : zones de soudure issues des liaisons `weld` et des `endSeals` ;
- `surfaceWindows` : une surface portée par plusieurs panneaux (le dos en deux fenêtres, via `surfaceOffsetMm`).

Le développement a aussi corrigé l'aileron de 2C-4E-1, désormais tourné vers l'extérieur et soudé par ses faces
intérieures. Détails : [bag-construction.md](bag-construction.md).

## Phase 2C-4E-3 — zone technique de couture et plis centraux des soufflets

Deux primitives génériques :
- `TechnicalZone` (`technicalZones`) : une zone imprimée où éviter les éléments critiques. Pour la couture dorsale
  des sacs film, elle est déduite de la soudure `weld` : c'est l'image de l'aileron rabattu sur chaque demi-dos.
- `AssemblyPart.innerFolds` : un pli à l'intérieur d'une pièce. C'est le pli central de chaque soufflet, de type
  `formed`, présent dans `innerFolds` et `formedFolds`.

La laize est inchangée par ailleurs. Détails : [bag-construction.md](bag-construction.md).

## Phase 2C-4F-0 — audit des pots (`tub`)

Il s'agit d'un audit seul : aucun changement de code. Les 5 pots partagent un tronc de cône ouvert (r = 0,86 R),
exactement développable en secteur d'anneau. Leur surface `wrap` actuelle est un rectangle 2πR × hauteur, plaqué
avec 14 % de compression en bas. Ils restent non supportés. Détails et architecture recommandée :
[tub-audit.md](tub-audit.md).

## Phase 2C-4F-1 — profil conique et développement exact des pots

Les 4 pots plastiques (`tub`) ont désormais une surface d'impression qui **est** leur paroi développée, en secteur
d'anneau (`conicalProfile.ts`, `PrintSurface.shape`). Les UV de la 3D sont tirés de ce secteur, ce qui supprime la
compression de 14 % en bas. Le patron `conicalWrap` est un seul contour. La bande sous le couvercle n'est pas
imprimée (`TechnicalZone` `covered`). Le pot de glace passe au modèle `papertub`, inchangé et refusé. Détails :
[conical-profile.md](conical-profile.md).

## Phase 2C-4F-2 — zone sûre et composition sur secteur conique

`conicalSafeArea.ts` (pur) calcule, dans le repère développé des pots :
- les zones imprimable, sûre (marges `SAFE_MM`, couture) et principale ;
- le rectangle de texte et le cercle de logo conseillés ;
- un score et une orientation conseillée.

Ces éléments sont exposés en `compositionGuides`, puis dans `FlatLayout.guides`, tracés dans l'aperçu seulement. La
géométrie, les UV, le PDF et l'illustration sont inchangés. Détails : [conical-safe-area.md](conical-safe-area.md).

## Phase 2C-4F-3 — mise en page intelligente des pots coniques

`conicalLayout.ts` (pur) classe les éléments de l'illustration (rôles, priorités P0 à P4) et les place dans les
régions exactes de 2C-4F-2 :
- un élément valide reste à sa place ;
- sinon, il est déplacé au plus court, sans collision avec les éléments prioritaires et sans quitter son côté du pot ;
- une colonne que le placement un par un casserait est réalignée (ordre, axe et tailles gardés) ;
- un élément impossible à placer est signalé `invalid`, avec sa raison.

La structure expose les régions (`composition`, pots uniquement). Les primitives de l'artwork déclarent leurs
éléments (`artwork/placement.ts`). Le mode RECOMMEND montre le plan dans l'aperçu. Le mode APPLY porte les décalages
dans le design, ce qui donne la même position pour l'aperçu, la 3D et le PDF. Géométrie, UV, patrons et dimensions
sont inchangés. Détails : [conical-smart-layout.md](conical-smart-layout.md).

## Phase 2C-4F-4 — persistance, éléments liés et preflight

- **Persistance** : l'APPLY de la mise en page intelligente est enregistré avec le projet (`SavedProject.smartLayout`,
  état versionné et validé au chargement). Il est redessiné tel quel après rechargement et peut être retiré à tout
  moment, ce qui restaure l'original intact.
- **Éléments liés** : un élément déclaré lié (`parentId`) suit son parent puis est revérifié ; son invalidité remonte
  au groupe.
- **Preflight** (`conicalPreflight.ts`, pur) : il réutilise régions, règles et collisions du placement et classe les
  problèmes en pass, warning ou blocking. Un PDF d'impression n'est jamais créé avec un problème bloquant.
- **Hors périmètre** : aucun changement de géométrie, d'UV, de patron ni de 3D. Formats concernés : les 4 pots
  plastiques.

Détails : [conical-smart-layout.md](conical-smart-layout.md), sections 11 à 17.

## Phase 2C-4G — audit final du moteur

Le gate `tests/unit/structure/engine-audit.test.ts` (160 tests) vérifie, sur les 119 formats :

- structure, surfaces, 3D, artwork, patron et PDF ;
- la cohérence croisée aperçu = PDF = 3D ;
- le cycle de persistance ;
- le preflight égal à l'export ;
- la barrière d'export ;
- les corruptions et le déterminisme.

Seule correction : `resolveStructure` refuse proprement (`unsupported`, sans surface) un modèle inconnu ou des dimensions non finies ou ≤ 0. Les 119 structures, 3D et patrons sont identiques. Détails : [packaging-engine-final-audit.md](packaging-engine-final-audit.md).

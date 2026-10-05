# Phase 2C-4G — audit final du moteur de packaging

Ce document ne décrit que ce qui a été **vérifié** par le gate `tests/unit/structure/engine-audit.test.ts`, les
suites existantes, les comparaisons d'empreintes et la validation dans le navigateur.

## 1. Objectif

Décider si le socle physique (structure → 3D → surfaces → artwork → patron → PDF → mise en page intelligente →
persistance → preflight) est assez cohérent et déterministe pour ne plus être modifié avant la phase 3, l'éditeur
professionnel.

## 2. Architecture

```
catalogue (SHAPE_ROWS, 119 formats)
   ↓ model + L × W × H + matière
resolveStructure()  ── profils (labels, bottle, box, carton, mailer, tray, bag, conical…)
   ├── printSurfaces (PrintSurface)  ──┬── 3D : packagingModels.buildModel → surfaceTexture → drawSurface
   │                                   └── patron : FlatLayout (print/layout.ts, adaptateur pur)
   ├── panels / cut / creases / glue / seals / technicalZones  → FlatLayout → drawDieline (aperçu), page 2 du PDF
   └── composition (pots uniquement) → conicalSafeArea → conicalLayout → smartLayoutState → conicalPreflight
artwork : drawSurface → drawWrap / drawFace (placement.ts : relevé et décalages)
PDF : exportPrintPdf → flatLayout + renderFlatArtwork (= drawSurface par panneau) + pdf-lib
```

## 3. Sources de vérité

| Donnée | Source unique | Consommateurs vérifiés |
|---|---|---|
| construction, dimensions, matière, patron | `resolveStructure()` | 3D, FlatLayout, PDF, composition |
| géométrie des profils | `structure/profile/*` (`cylinderWrap`, `tubWall`, `bottleLabel`, `boxParts`, `cartonConfigFor`, `bagShape`…) | 3D **et** structure lisent les mêmes fonctions |
| surface imprimable | `PrintSurface` (`printSurfaces`) | textures 3D (`userData.surfaceId`, `userData.mm`), panneaux du FlatLayout, artwork |
| dessin d'une surface | `drawSurface()` | texture 3D, feuille du PDF, aperçu (`renderFlatArtwork`) |
| fond perdu | `BLEED_MM` = 3 | structure (`bleedMm`), FlatLayout, PDF |
| zone sûre conique | `conicalSafeArea()` (via `structure.composition`) | guides, placement, preflight |
| placement | `planLayout()` | recommandation, APPLY, preflight (suggestion) |
| collision | `rectsOverlap` + `placementOrder` | placement **et** preflight |
| état appliqué | `SmartLayoutState` (projet) → `wrapPlacementFromState` | aperçu, 3D, miniatures, PDF, preflight |

**Conversions d'unités, toutes explicites** :
- mm → px : `pxFor`, `kx = w / wMm` dans `drawSurface`, `pxPerMm` dans `renderFlatArtwork` ;
- mm → points PDF : `MM = 72 / 25.4` ;
- monde 3D : le groupe est mis à l'échelle (plus grande dimension = 1 unité), sans changer ses proportions ;
- UV : normalisées [0, 1], calculées depuis la surface (pour les pots : `coneToSurface`, `conicalUV`) ;
- placement : décalages en mm, convertis en fractions du cadre imprimé (`WrapPlacement`).

**Duplication critique trouvée** : aucune. La 3D ne recalcule pas les surfaces, elle les reçoit de la structure.

## 4. Formats supportés : 107 sur 119

| Modèle | Famille | Gabarit | Formats |
|---|---|---|---|
| box | dieline | tuckEndBox | 18 |
| rigid | dieline | rigidSetUp | 4 |
| mailer | dieline | rollEndTuckFront | 4 |
| carton | dieline | gableTop | 3 |
| tray | dieline | gluedCornerTray | 1 |
| bottle, wine, dropper, pump, spray | profile | wrapLabel | 17, 5, 2, 2, 3 |
| jar | profile | wrapLabel | 11 |
| can, tin, tube, papertube | profile | wrapLabel | 3, 7, 2, 4 |
| tub | profile | conicalWrap | 4 |
| pouch, flatpouch, sachet | flexible | frontBack | 3, 5, 5 |
| bag | flexible | sideGussetBag | 4 |

## 5. Formats refusés : 12 sur 119, inchangés

`pillow-box`, `display-box`, `pizza-box`, `burger-box` (clamshell), `noodle-box` et `fries-box` (cup : **gobelets
hors périmètre**), `egg-carton` (moulded), `jug-bottle`, `detergent-bottle` et `jerrican-5l` (jug),
`ice-cream-tub` (papertub), `flour-bag` (paperbag).

Chacun :
- reçoit `dieline: "unsupported"` avec sa raison ;
- n'a ni gabarit, ni découpe, ni `flatMm`, ni composition ;
- voit `flatLayout` lever `UnsupportedDielineError` et le PDF refusé ;
- ne peut recevoir aucun état de mise en page (testé).

La 3D de présentation reste disponible.

## 6. Invariants physiques (vérifiés sur les 119 formats)

- **Structure** : valide (`validatePackagingStructure`), entièrement finie, déterministe.
- **Surfaces** :
  - identifiants uniques ;
  - au moins une surface imprimable ;
  - `printArea` comprise dans la surface ;
  - `bleedMm` = `BLEED_MM`.
- **Fond perdu** : il n'entre jamais dans la taille physique (FlatLayout = `flatMm`). La page du PDF vaut toujours
  patron + 2 × (3 mm de fond perdu + 18 mm de marge), quel que soit le format.
- **Zones techniques** (soudures, colle, zone de couture, bande sous couvercle) : dans la feuille. Les pattes de colle
  sont `printable: false`, et la bande sous le couvercle est exclue du contour imprimé (suites 2C-4E et 2C-4F).
- **Zone sûre conique** : un vrai secteur d'anneau, strictement à l'intérieur du secteur imprimé, distinct de la
  `printArea` (une boîte) et du fond perdu.

## 7. PrintSurface

Chaque texture du modèle 3D porte l'identifiant d'une surface de la structure, **à la même taille en mm**. Chaque
surface imprimable de la structure est montrée par la 3D (119 sur 119). Chaque panneau du patron renvoie à une
surface existante.

## 8. 3D

- Positions et UV toujours finies ; boîte englobante valide.
- Empreinte des 119 modèles (sommets, UV, tailles de texture, groupes) : **identique** avant et après cette phase.

## 9. Patron (dieline)

Découpes principale et secondaires, zones de colle, de soudure et techniques : toutes à l'intérieur de la feuille.
Le patron reste une conséquence de la construction ; aucun n'a été modifié.

## 10. FlatLayout

Dérivé de la structure par un adaptateur pur (`layoutFromStructure`), sans calcul physique propre. Sa taille vaut
`flatMm`. Les 119 sont **identiques** avant et après cette phase.

## 11. Artwork

- `drawSurface` est appelé sur chaque surface des 119 formats : aucune coordonnée non finie.
- L'artwork ne modifie jamais la géométrie.
- La mise en page intelligente ne fait que translater des éléments déclarés.

## 12. Mise en page intelligente

Pour les 4 pots, le même élément tombe au **même endroit en mm**, à 10⁻⁶ près, dans la texture 3D et dans la feuille
du PDF, avant comme après APPLY.

Le rendu APPLY ne déplace que les éléments de l'état, chacun de son décalage exact ; tout le reste est dessiné à
l'identique.

## 13. Persistance

- **Cycle complet** : APPLY → rechargement → APPLY → restauration → rechargement → APPLY redonne le **même état**.
- **Contenu modifié après APPLY** : l'état recalculé remplace l'ancien, et chaque placement décrit l'élément tel
  qu'il est désormais dessiné.
- **Navigateur** : l'empreinte du patron rechargé est identique à celle de l'APPLY, puis identique à l'original après
  restauration et rechargement.

## 14. Preflight

Il examine **exactement** ce qui est exporté, dans 5 cas : aucun état, état appliqué, version inconnue, état d'un
autre pot, état corrompu. Ses éléments examinés coïncident avec ceux dessinés par l'export (10⁻⁹), et son rapport est
identique à celui calculé sur les éléments exportés.

## 15. Barrière d'export

- **Décision** : `exportAllowed` (blocking → refusé ; warning ou pass → autorisé).
- **Contrat de l'atelier (testé)** : PDF et ZIP passent par `preflightNow()`, puis par le blocage, **avant**
  `gateDownload()` (aucun crédit consommé). Les fichiers d'impression utilisent `fullDesign`, et le preflight utilise
  l'état appliqué courant.
- **Navigateur** :
  - code-barres coupé → aucun fichier, dialogue avec correction ;
  - mentions trop longues → bloqué sans proposer de correction automatique ;
  - avertissement → export accompagné du message.

## 16. Pots coniques

`protein-tub`, `yogurt-cup`, `deli-container`, `hair-cream-tub`. Vérifications, à 10⁻⁹ près :
- génératrice = √(h² + (R − r)²) = R_out − R_in ;
- arc haut = 2πR, arc bas = 2πr ;
- largeur = 2 R_out sin(θ/2), hauteur = R_out − R_in cos(θ/2) ;
- la surface `wrap` **est** le secteur développé ;
- la composition est celle de `conicalSafeArea`.

`ice-cream-tub` reste refusé.

## 17. Tests

- **Nouveau** : `engine-audit.test.ts`, 160 tests.
  - matrice des 119 formats ;
  - répartition supportés / refusés ;
  - formats refusés, pots, cohérence croisée, cycles de persistance ;
  - preflight égal à l'export ;
  - contrat d'export ;
  - corruptions, déterminisme, temps.
- **Avant / après** : 943 → 1 103 tests.

## 18. Résultats

- 119 formats audités, sans aucune remarque.
- Empreintes 3D, FlatLayout et structures complètes : 119 sur 119 identiques.
- Temps mesurés :
  - 119 structures : 32 ms ;
  - zone sûre : moins de 0,05 ms ;
  - placement : 5 à 52 ms ;
  - preflight : 5 à 37 ms.

**Correction apportée** : `resolveStructure` refuse désormais proprement un modèle inconnu ou des dimensions non
finies ou ≤ 0 (voir la section 19). Avant, il donnait une fausse construction ou levait une erreur.

## 19. Limitations

- **Entrées refusées** (modèle inconnu, dimensions invalides) : elles n'ont **aucune** surface. La 3D n'est donc pas
  construite pour elles. Ces entrées ne sont pas atteignables depuis l'interface (formes du catalogue seulement).
- **Décors liés** : seuls ceux de l'emblème et du médaillon sont déclarés.
- **Lien de partage** : il ne transporte pas l'état appliqué.
- **Code-barres** : pas de taille minimale contrôlée (aucune règle de ce type n'existe encore).
- **Avertissements** : un « Contenu net » P2 invisible n'est qu'un avertissement.
- **Physique non modélisée** : épaisseur des PP, transparence, procédés (IML…), tolérances de fabrication.

## 20. Décisions pour la phase 3

- **Socle** : le socle physique est **gelé**. La phase 3 consomme `resolveStructure`, `PrintSurface`, `drawSurface`,
  le placement et le preflight, sans les dupliquer.
- **Positions** : toute position d'élément édité doit passer par le mécanisme de placement déclaré (`placeElement` et
  état versionné), pour rester une seule position logique pour l'aperçu, la 3D et le PDF.
- **Export** : la barrière d'export reste obligatoire pour tout nouveau chemin d'export.
- **Gate** : garder `engine-audit.test.ts` comme gate de non-régression du moteur.

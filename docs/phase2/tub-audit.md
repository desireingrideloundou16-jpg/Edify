# Phase 2C-4F-0 — audit physique des pots (`tub`)

Cet audit n'implémente rien : aucun patron, aucune modification de la 3D, des surfaces, des UV ni du catalogue.
Les pots restent non supportés. Les faits ci-dessous sont **mesurés** sur le code et les maillages, et figés par
`tests/unit/structure/tub-audit.test.ts`.

## 1. Inventaire

| shapeId | Nom | Catégorie | L × W × H (mm) | Matière | Épaisseur (`materialThickness`) |
|---|---|---|---|---|---|
| `protein-tub` | Pot de protéine | jars | 120 × 120 × 170 | PEHD | 0,6 mm (défaut « plastique ») |
| `yogurt-cup` | Pot de yaourt | jars | 70 × 70 × 75 | PP | **0,1 mm** (règle « film », voir §8) |
| `ice-cream-tub` | Pot de glace | jars | 100 × 100 × 90 | Carton alimentaire | 0,45 mm (défaut « carton ») |
| `deli-container` | Boîte traiteur | jars | 115 × 115 × 70 | PP transparent | **0,1 mm** (règle « film ») |
| `hair-cream-tub` | Pot de crème capillaire | jars | 90 × 90 × 70 | PP | **0,1 mm** (règle « film ») |

Points communs aux 5 pots :
- **Structure** : `model: "tub"`, `family: "profile"`, `profile.builder: "tub"`, `closure: "lid"`.
- **Patron** : `dieline: "unsupported"`, avec le message « Contenant conique : son étiquette se découpe en arc, pas
  en rectangle. Le patron n'est pas encore disponible pour ce format. »
- **Surface** : une seule, `wrap` (`kind: "wrap"`, `frontFraction: 0,3`, `placement: { part: "label" }`).

## 2. Builder 3D (le même pour les 5)

`three/packagingModels.ts`, cas `tin` / `papertube` / `tub` / `cup`, avec les dimensions de
`structure/profile/labels.ts` → `cylinderWrap("tub", L, W, H)` :

| Pièce | Géométrie | Valeurs |
|---|---|---|
| Paroi | `CylinderGeometry(rTop, rBot, bodyH, 96, 1, openEnded, θ₀ = −π, 2π)` | R = min(L, W) / 2, **r = 0,86 R**, bodyH = H − 0,6 × lidH, lidH = 0,18 H |
| Fond | `CircleGeometry(r, 64)` à y ≈ 0 | uni, non imprimé |
| Couvercle | `CylinderGeometry(1,025 R, 1,025 R, lidH)` fermé, de H − lidH à H | uni (couleur d'accent), non imprimé |

Aucun profil spécifique, aucune géométrie de révolution (`lathe`) ni de rebord. Les 5 pots diffèrent **uniquement
par leurs dimensions** ; les rapports r/R = 0,86, lidH/H = 0,18 et bodyH/H = 0,892 sont communs. Le même builder sert
aussi au `cup` (r = 0,72 R) et au cylindre (`tin`, `papertube`), hors périmètre de cet audit.

## 3. Géométrie physique et profil radial

La paroi est un **tronc de cône** exact, à parois droites et ouvert, polygonal à 96 facettes planes. Son périmètre
diffère du cercle de 0,018 %. Le rayon varie linéairement avec la hauteur, de r en bas à R en haut.

| Pot | R haut | r bas | Hauteur de paroi | Génératrice | Demi-angle d'ouverture |
|---|---|---|---|---|---|
| protein-tub | 60 | 51,6 | 151,64 | 151,872 | 3,171° |
| yogurt-cup | 35 | 30,1 | 66,9 | 67,079 | 4,189° |
| ice-cream-tub | 50 | 43 | 80,28 | 80,585 | 4,983° |
| deli-container | 57,5 | 49,45 | 62,44 | 62,957 | 7,346° |
| hair-cream-tub | 45 | 38,7 | 62,44 | 62,757 | 5,761° |

**Couvercle** : sa jupe (rayon 1,025 R) descend jusqu'à H − lidH, sous le haut de la paroi (bodyH). Elle **cache les
0,072 H supérieurs de la paroi** : 12,24 mm (protéine), 5,40 (yaourt), 6,48 (glace), 5,04 (traiteur et crème).

## 4. Surface imprimable

- **Seule surface imprimée** : la paroi latérale (`wrap`). Le fond et le couvercle sont des matières unies.
- **Surface actuelle** : un **rectangle** de largeur **2πR** (la circonférence du **haut** seulement) et de hauteur
  **bodyH** (la hauteur **verticale**, pas la génératrice).
- **Couverture** : 360°, sans recouvrement, sur toute la paroi, y compris la bande cachée par le couvercle.
- **Ce que le code ne dit pas** : il ne représente pas d'étiquette distincte, de zone frontale, de recouvrement ni de
  découpe. Cela correspond au cas « A. impression 360° complète » ou « F. aucune étiquette physique distincte »,
  selon le procédé (impression directe, IML, étiquette), que le code ne précise pas.

## 5. UV

Ce sont les UV de `CylinderGeometry`, mesurés :
- **v (vertical)** : de 0 en bas à 1 en haut, linéaire en hauteur.
- **u (horizontal)** : de 0 à 1 sur le tour, à pas angulaire uniforme.
- **Couture** : à u = 0, **au dos** (θ₀ = −π, point (0, −r)).
- **Lecture** : côté gauche à u = 0,25 et face à u = 0,5, donc lecture de gauche à droite vue de face, sans miroir.
  L'illustration de face est centrée (`frontFraction` 0,3).

**Une illustration rectangulaire placée dans ces UV** couvre toute la paroi conique, mais **sans conserver les mm** :
- en haut, 1 mm d'illustration = 1 mm de paroi ;
- en bas, 1 mm d'illustration = 0,86 mm de paroi, soit une **compression horizontale de 14 %** qui croît linéairement
  du haut vers le bas (un cercle devient une ellipse vers le bas) ;
- verticalement, 1 mm d'illustration = génératrice / hauteur mm de paroi (0,15 % à 0,8 % d'écart).

Le rectangle actuel n'est donc **pas** la surface physique ; c'est précisément la raison du refus de patron.

## 6. Développabilité

Un tronc de cône est **exactement développable** : sa paroi se met à plat sans déformation en **secteur d'anneau**,
avec un rayon extérieur ρ₂ = R × génératrice / (R − r), un rayon intérieur ρ₁ = ρ₂ − génératrice et un angle
φ = 2πR / ρ₂. Vérification numérique (arc extérieur = 2πR, arc intérieur = 2πr, à 10⁻³ mm près) :

| Pot | ρ ext (mm) | ρ int (mm) | Angle | Arc ext = 2πR | Arc int = 2πr | Encombrement à plat |
|---|---|---|---|---|---|---|
| protein-tub | 1 084,8 | 932,9 | 19,911° | 376,991 | 324,212 | 375,1 × 165,9 |
| yogurt-cup | 479,1 | 412,1 | 26,297° | 219,911 | 189,124 | 218,0 × 77,9 |
| ice-cream-tub | 575,6 | 495,0 | 31,271° | 314,159 | 270,177 | 310,3 × 98,9 |
| deli-container | 449,7 | 386,7 | 46,032° | 361,283 | 310,704 | 351,6 × 93,7 |
| hair-cream-tub | 448,3 | 385,5 | 36,139° | 282,743 | 243,159 | 278,1 × 81,8 |

Les 96 facettes sont planes : le polygone se développe lui aussi exactement, à 0,018 % du cercle. **Aucune
approximation n'est nécessaire.**

## 7. Comparaison

Les 5 pots ont **la même construction géométrique** : même builder, mêmes rapports, seules les dimensions changent.
Une abstraction commune est justifiée par la géométrie. Le procédé, lui, n'est pas le même pour tous :
- **PEHD et PP** (protéine, yaourt, crème, traiteur) : la paroi est moulée ; on imprime une **étiquette** ou une
  décoration (IML, impression directe) en secteur d'anneau.
- **Carton alimentaire** (glace) : la paroi est elle-même **un flan de carton découpé** (secteur d'anneau) roulé, avec
  un recouvrement de couture, un fond rapporté et un bord roulé. Rien de cela n'est modélisé.

## 8. Épaisseur et matières

`materialThickness` :
- **PEHD** : 0,6 mm (défaut « plastique »).
- **Carton alimentaire** : 0,45 mm (défaut « carton »).
- **PP et PP transparent : 0,1 mm**. « pp » déclenche la règle « film », ce qui est faux pour un pot injecté (paroi
  d'environ 0,4 à 1 mm). C'est sans effet aujourd'hui, car l'épaisseur n'est pas utilisée par la 3D des pots. Non
  corrigé (hors périmètre).
- **Boîte traiteur** : en « PP transparent », elle est rendue en plastique opaque (classement 3D « plastic »). Une
  boîte transparente porte en général une étiquette et non une impression pleine paroi : le code ne le précise pas.

## 9. Décision par modèle

| Pot | Décision | Justification |
|---|---|---|
| protein-tub | **SUPPORTED_CANDIDATE** | Paroi tronconique exacte, développable en secteur d'anneau ; impression d'étiquette ou de décoration. |
| yogurt-cup | **SUPPORTED_CANDIDATE** | Idem. |
| hair-cream-tub | **SUPPORTED_CANDIDATE** | Idem. |
| deli-container | **SUPPORTED_CANDIDATE** (réserve) | Idem en géométrie. Réserve : contenant transparent, l'étendue réelle de l'impression (pleine paroi ou étiquette partielle) n'est pas définie. |
| ice-cream-tub | **NEEDS_DEDICATED_CONSTRUCTION** | En carton, la paroi est un flan découpé : il faut le recouvrement de couture, le fond et le bord roulé, absents de la construction. |

Aucun pot n'est NOT_DEVELOPABLE ni INSUFFICIENT_GEOMETRY.

## 10. Architecture recommandée pour 2C-4F-1

Un **profil commun `frustumWall` / `conicalLabel`** (pur, en mm), calculé à partir de `cylinderWrap` (R, r, bodyH)
et utilisé par la 3D et par le patron, comme `bagShape` pour les sacs.

1. **Surface imprimable non rectangulaire** : la surface `wrap` devient un **secteur d'anneau**. Il faut :
   - soit une forme de surface (`PrintSurface` avec un contour) dessinée par `drawSurface` dans le repère du
     secteur ;
   - soit garder un rectangle « redressé » (largeur 2πR, hauteur = génératrice) et le **déformer** en secteur au
     moment du placement. C'est une décision produit, car le second choix déforme l'illustration à plat.
2. **UV isométriques** : remplacer les UV de `CylinderGeometry` par une projection du secteur, pour que 1 mm
   d'illustration = 1 mm de paroi en tout point (aujourd'hui, −14 % en bas).
3. **Étendue imprimée** : exclure la bande cachée par le couvercle (0,072 H) ou la déclarer zone technique
   (`TechnicalZone`, déjà générique).
4. **Patron** : le secteur d'anneau avec sa couture au dos (la couture des UV). Recouvrement éventuel à décider
   (étiquette enroulée) ; pas de recouvrement pour l'IML.
5. **Pot de glace** : phase dédiée (flan de paroi + fond + bord), après les 4 pots plastiques.

## Limites de l'audit

- **Procédé non représenté** (IML, impression directe, étiquette) : l'étendue réelle d'une étiquette partielle
  n'est donc pas déterminable depuis le code.
- **Épaisseur des PP** : fausse (0,1 mm), non corrigée.
- **Familles proches** : `cup` (même builder, r = 0,72 R) et cylindres (`tin`, `papertube`) non audités ici.

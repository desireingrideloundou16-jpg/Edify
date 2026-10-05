# Phase 2C-4F-2 — zone sûre et composition sur secteur conique

Cette phase est une phase de **composition géométrique**. Elle ne change ni la paroi, ni le secteur, ni les UV, ni
le PDF physique, ni aucun pixel de l'illustration : elle dit **où** une illustration se lit bien sur le pot.

```
conicalProfile (secteur, bande du couvercle)     ← géométrie : source de vérité (2C-4F-1)
      ↓
conicalSafeArea (structure/profile/conicalSafeArea.ts, pur)
      ├── printable : secteur sans la bande du couvercle
      ├── safe      : printable − marges (haut, bas, couture)
      ├── primary   : la face du pot (zone principale)
      ├── textArea  : plus grand rectangle droit dans la zone principale
      ├── logo      : plus grand cercle dans la zone principale
      └── score, orientation conseillée, tests point / rectangle
      ↓
structure.compositionGuides → FlatLayout.guides → aperçu uniquement
```

## 1. Pourquoi une zone sûre

Depuis 2C-4F-1, l'illustration est dessinée dans le plan exact du secteur. Une ligne horizontale à plat, placée à
l'angle ψ de l'axe, apparaît **inclinée de ψ** sur le pot. C'est physiquement exact, mais peu lisible près de la
couture. Plutôt que de déformer l'illustration, le moteur indique les zones favorables.

## 2. Secteur ≠ zone sûre

Toutes les régions sont des **secteurs d'anneau autour de l'apex** du développement (ρ₀ ≤ ρ ≤ ρ₁, |ψ| ≤ ψmax), dans
le repère de l'illustration (mm, y vers le bas). Ce ne sont jamais des boîtes englobantes.

| Région | ρ₀ | ρ₁ | ψmax |
|---|---|---|---|
| secteur | R_in | R_out | angle/2 |
| imprimable | R_in | R_out − bande couverte | angle/2 |
| **sûre** | R_in + marge radiale | R_out − bande − marge radiale | angle/2 − marge de couture |
| **principale** | = sûre | = sûre | min(sûre, ½ × arc principal) |

## 3. Marges

| Option | Valeur par défaut | Origine |
|---|---|---|
| `radialMarginMm` | `SAFE_MM` = 3 mm | la marge nominale du projet (`resolveStructure`) |
| `angularMarginDeg` | 3 mm le long du cercle du **bas** (le plus petit), en degrés autour du pot | dérivée de la marge radiale |
| `primaryArcDeg` | `PRIMARY_ARC_DEG` = 120° | **hypothèse de composition** : le panneau principal ≈ ⅓ du tour |

Aucune valeur n'est propre à un pot. Les options explicites remplacent les valeurs par défaut (testé).

## 4. Couture et zone couverte

- **Couture** : elle reste la frontière angulaire du secteur. Elle n'est ni déplacée, ni recouverte, ni collée. La
  zone sûre s'en écarte de `angularMarginDeg`. `distanceToSeam(p)` donne la distance en mm, dans le plan développé.
- **Zone couverte** : c'est la bande `covered-by-lid` de 2C-4F-1 (`tubWall`, issue de la jupe du couvercle), sans
  aucune hauteur recalculée. La zone sûre commence une marge radiale en dessous (testé contre la `TechnicalZone`).

## 5–6. Zone principale, texte et logo recommandés

- **Zone principale** : la zone sûre réduite à la face du pot (±60° autour de l'axe par défaut).
- **`textArea`** : le plus grand rectangle droit, centré sur la face, entièrement dans la zone principale. Son bord
  bas repose sur la crête de l'arc intérieur, sa demi-largeur est bornée par l'angle de la zone, et ses coins hauts
  touchent l'arc extérieur. L'aire est maximisée par une recherche déterministe. Ce n'est **pas** la largeur de la
  boîte englobante.
- **`logo`** : le plus grand cercle sur l'axe de la face, à l'intérieur de la zone principale (solution exacte).

## 7. Contraintes géométriques (API)

- `pointInRegion(wall, region, p)` : le point appartient-il à la région ?
- `rectInRegion(wall, region, rect)` : un bloc rectangulaire y tient-il ?
  - Le disque extérieur et le coin angulaire sont convexes : les 4 coins décident.
  - Pour l'arc intérieur, c'est le point du bloc le plus proche de l'apex qui décide.
- `distanceToSeam(wall, p)` : distance à la couture, en mm.
- `compositionScore(sa, p)` ∈ [0, 1], déterministe : 0 hors zone sûre, sinon (proximité de la face) × (distance au
  bord haut ou bas de la zone sûre, normalisée). Il vaut 1 à la face, à mi-hauteur.

## 8. Orientation conseillée

`textOrientationAt(wall, p)` → `{ tiltDeg, tangentRotationDeg, recommended }` :
- une ligne horizontale à plat en p apparaît inclinée de `tiltDeg` (= ψ) sur le pot ;
- la tourner de `tangentRotationDeg` la fait suivre le cercle ;
- `recommended` vaut `upright` sous `LEVEL_TOLERANCE_DEG` (2°), `tangent` au-delà.

C'est un **conseil** de composition : aucun glyphe n'est transformé.

## Aperçu et PDF

- **Aperçu** (`drawDieline`), en traits fins vert « repère » :
  - zone sûre : tirets ;
  - zone principale : trait mixte ;
  - texte et logo conseillés : pointillés.

  Légendes : « Zone sûre », « Zone principale (face), titre et logo conseillés ».
- **PDF** : les guides font partie du `FlatLayout`, mais `exportPrintPdf` **ne les trace pas** (testé : le PDF ne
  contient que la découpe, les repères de coupe et la bande du couvercle). Le patron physique est inchangé.

## 9. Ce qui n'est pas corrigé

- La mise en page de l'illustration existante (`drawWrap`) **n'est pas déplacée** : elle reste celle de 2C-4F-1.
  Ces contraintes préparent une composition future, sans l'imposer.
- **Typographie et procédé** : pas de courbure automatique des lignes, de compensation typographique,
  d'adaptation de glyphes, ni de correction perceptuelle.
- **Fabrication** : IML, impression directe, étiquette adhésive, recouvrement, tolérances, retrait, transparence,
  épaisseur des PP.
- **Pot de glace** : hors périmètre.

## 10. Valeurs par pot (calculées depuis le profil)

| Pot | Secteur | Marge de couture | Zone principale (ψ) | Texte conseillé | Logo |
|---|---|---|---|---|---|
| protein-tub | 375,10 × 165,92, 19,91° | 3,33° | ±3,32° | 108,5 × 132,2 mm | Ø 117,1 mm |
| yogurt-cup | 217,99 × 77,88, 26,30° | 5,71° | ±4,38° | 63,6 × 54,6 mm | Ø 55,7 mm |
| deli-container | 351,64 × 93,74, 46,03° | 3,48° | ±7,67° | 105,0 × 48,7 mm | Ø 51,9 mm |
| hair-cream-tub | 278,08 × 81,77, 36,14° | 4,44° | ±6,02° | 82,0 × 49,8 mm | Ø 51,7 mm |

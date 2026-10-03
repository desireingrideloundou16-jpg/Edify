# Visual Fidelity — matières, étiquettes, lumière (phase 2B-5)

Documentation technique du moteur de rendu des packs (Three.js 0.169, WebGL2, React Three Fiber).

## 1. Architecture des matières

Source de vérité unique : `src/lib/three/materials/`.

| Fichier | Rôle |
|---|---|
| `materialPresets.ts` | Pur (sans DOM ni objet three.js). Matrice des 27 matières (`MATERIAL_PRESETS`), finitions (`finishFromLabel`, `FINISH_FALLBACK`, `printedPreset`), verre (`glassPreset`), qualité (`MaterialQuality`), graine (`hashSeed`, `createDeterministicNoise`) et `resolveMaterial()`, qui applique couleur, teinte, finition, qualité et graine, avec des valeurs bornées. |
| `materialFactory.ts` | Seul endroit qui crée un `MeshPhysicalMaterial` : micro-surface, rugosité calibrée, anisotropie, dispersion, transmission. |

`packagingModels.ts` n'instancie plus aucune matière directement. `printed()`, `solid()`, `glassMaterial()` et
`METAL_SILVER()` sont de minces enveloppes autour de la fabrique ; seul le liquide vu à travers le verre reste un
matériau local, étiqueté `liquid`. Un test vérifie que chaque maillage de chaque type de pack utilise une matière de
la fabrique.

### Matrice

| Famille | Presets |
|---|---|
| Papier / carton | `paper`, `kraft`, `laidPaper`, `carton`, `glossyCarton`, `matteCarton`, `softTouch` |
| Plastique | `mattePlastic`, `glossyPlastic`, `hdpe`, `pet`, `translucentPlastic`, `plasticFilm`, `metallizedFilm` |
| Verre | `glass`, `tintedGlass`, `perfumeGlass`, `frostedGlass` |
| Métal | `aluminum`, `brushedMetal`, `paintedMetal`, `printedMetal`, `foil` |
| Autres | `rubber`, `labelMatte`, `labelGlossy`, `labelEdge` |

Planche de calibration : `/dev-renders?mode=materials&lighting=premium&quality=high` (`2B5-matrice-matieres.png`).
Elle sert à contrôler les blancs (papier, PEHD), les noirs (plastique noir), le kraft, le rouge (capsule), le verre
clair et teinté, et l'aluminium.

### Finitions

Rendues : `matte`, `glossy`, `satin`, `softTouch`, `uncoated`, `laid`, `varnish` (= vernis brillant), `metallic`.
Déclarées pour plus tard, avec un repli documenté (`FINISH_FALLBACK`) : `foil`, `spotUv`, `emboss`, `deboss`. Un
vernis sélectif ou une dorure *localisée* demandera un masque par zone d'artwork, donc une évolution du système de
textures ; ce n'est pas fait dans cette phase.

## 2. Micro-surface, rugosité, imperfections

`surfaceDetail.ts` génère dans le navigateur, une seule fois puis en cache, des textures tuilables de 256 px :

- **Normal map** par type (papier, kraft, vergé, couché, soft-touch, plastique, brossé, film), en 4 variantes
  (`MICRO_VARIANTS`).
- **Rugosité calibrée** autour de `ROUGH_BASELINE = 0.6` : la matière prend `roughness = cible / 0.6`, donc sa
  rugosité moyenne est exacte, et la carte peut monter au-dessus de la moyenne là où il y a des micro-rayures
  (orientées le long du brossé pour les métaux) ou des traces de manipulation.
- **Échelle physique** : la répétition suit la taille réelle de la face en millimètres.

### Déterminisme

`seed = hashSeed(marque, produit, modèle, matière)`, puis une graine par matière du pack. Elle choisit la variante du
motif, son décalage sur la surface et une variation de teinte de ±0,4 à 2 % selon la famille. Même pack, même rendu ;
deux packs différents ont des grains légèrement différents. Aucun `Math.random()`.

### Qualité

| Niveau | Contenu | Utilisé par |
|---|---|---|
| `low` | PBR simple, sans micro-surface ; verre en transparence simple, sans passe de transmission | aperçu sur mobile ou GPU modeste |
| `medium` | + micro-surface et variation de rugosité ; anisotropie et sheen réduits | aperçu interactif, vignettes |
| `high` | + micro-rayures, traces, anisotropie complète, dispersion du verre | rendu HD |
| `ultra` | réservé au futur mode path tracing ; se comporte comme `high` | — |

`buildPackaging(spec, design, { quality })` : le troisième argument est facultatif (`medium` par défaut). Le niveau
vient de `chooseQuality()` (`RenderQualityConfig.materialQuality`).

## 3. Verre

`MeshPhysicalMaterial` avec transmission, épaisseur en millimètres (paroi de 2,5 mm, 3 mm pour le verre teinté, 8 mm
pour le parfum), IOR 1,5 à 1,52, rugosité 0,015 à 0,04, et dispersion en HD. Le verre teinté (ambré, vert) filtre la
lumière par sa couleur et par une absorption proportionnelle au chemin parcouru (`attenuationDistance`).

Limites de WebGL (three r169) :

- La transmission ne voit que les objets opaques derrière elle : deux verres superposés ne se voient pas l'un à travers
  l'autre. C'est pour cela que le liquide reste opaque.
- La réfraction est approchée pour une épaisseur uniforme ; il n'y a pas de caustiques.
- La passe de transmission ne peut pas être calculée en résolution réduite dans cette version. En qualité `low`, le
  verre n'utilise donc pas de transmission.

Un rendu exact (verre épais de parfum, caustiques) relève du futur mode ULTRA (path tracing).

## 4. Étiquettes physiques

`createBottleLabel(section, { thickness })` produit une coque de 0,15 mm (`LABEL_THICKNESS_MM`) qui épouse la section
réelle (cercle, ellipse, rectangle arrondi) :

- groupe 0 : face imprimée (`labelMatte` ou `labelGlossy` selon la finition), UV inchangés ;
- groupe 1 : chants et dos en papier blanc (`labelEdge`). Le chant donne le liseré de lumière sur les bords, et le dos
  se voit à travers le verre transparent.

Elle est posée à 0,08 mm du contenant : pas de z-fighting, pas d'étiquette qui flotte. Les pots utilisent la même
étiquette. Les boîtes et cartons sont imprimés directement, sans étiquette.

## 5. Lumière, ombres, caméra

- Studio procédural (`studioEnvironment.ts`) : cyclorama avec un dégradé continu du sol vers les murs, ce qui donne
  des reflets à horizon doux. Les 5 éclairages existants sont conservés.
- Ombres (`studioRig.ts`) : ombre portée douce (VSM), ombre de contact large, et une **ombre de contact serrée**
  (portée de 5 % de la hauteur, peu floutée), qui assombrit seulement là où le pack touche le sol.
- HD (`hdRender.ts`) : la profondeur de champ fait la mise au point sur la face avant du pack, par une projection
  décentrée (*thin lens*), au lieu de réorienter la caméra vers son axe.
- Tone mapping Neutral, sortie sRGB, textures d'artwork en sRGB, cartes de détail en espace linéaire : inchangés et
  cohérents.

## 6. Régressions corrigées

- **Sachet** (`pouchGeometry.ts`) : triangles orientés vers l'intérieur ; le sachet kraft, rendu sur une seule face,
  montrait l'intérieur du panneau arrière (TERRA tout noir).
- **Brique** (`cartonGeometry.ts`) : contour du corps non fermé (face gauche absente), face avant décalée dans la
  texture, toit en pyramide sous une crête flottante. Réécrit en gardant la même API : contour fermé, face avant au
  centre de la texture, toit à pignon, crête pleine.
- **Pots** : couvercle de la bibliothèque de fermetures (bord arrondi, moletage pour le PEHD, métal lisse sinon).

## 7. Performance (Intel UHD P630, Chrome, WebGL2)

| Mesure | Avant | Après |
|---|---|---|
| Vue interactive, packs opaques | 60 FPS | 60 FPS |
| Vue interactive, flacons en verre (LUMINA, MAISON LUNE, SOLÈNE, PIMENTO) | 44 à 53 FPS | 50 à 55 FPS |
| HD 1200 px, 32 images (6 produits × 4 vues) | 0,9 à 3,1 s | 0,76 à 2 s |
| Showcase 1024 px (17 packs) | 0,19 à 3,2 s | 0,16 à 2,6 s |

Les textures de détail sont générées une fois par combinaison (type, variante, réglages) et partagées.

## 8. Vers le mode ULTRA

`MaterialQuality` prévoit déjà `ultra`, et `resolveMaterial()` produit des paramètres physiques complets (IOR,
épaisseur, absorption, anisotropie, dispersion) directement utilisables par un path tracer. `three-gpu-pathtracer`
0.0.23 est compatible avec three 0.169 ; les versions ≥ 0.0.24 exigent three ≥ 0.185.

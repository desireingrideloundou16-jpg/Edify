# Phase 2 — Moteur de mockup 3D : suivi avant / après

Banc d'essai : `/dev-renders` (mode par défaut, `npm run dev`), soit les 17 packs de démonstration, rendus en 1024 px
avec le moteur réel d'Edify. Les planches sont régénérées à chaque étape.

## 2.2 — Micro-surfaces procédurales (matières)

- `src/lib/three/surfaceDetail.ts` : champs de hauteur tuilables, calculés une seule fois dans le navigateur puis mis en
  cache, et convertis en normal maps et roughness maps. Huit types : papier, vergé, kraft, couché, soft-touch,
  plastique (peau d'orange), aluminium brossé, film froissé. Aucun fichier ni réseau, coût nul.
- `printed()` (`packagingModels.ts`) choisit la matière selon le support **et** la finition (brillant, mat,
  soft-touch, non couché, vergé, satiné). Le vernis brillant est un clearcoat lisse posé sur le papier ; le
  soft-touch a un léger sheen ; l'échelle du grain est physique (millimètres de la face).

| Planche | Contenu |
|---|---|
| `2.2-avant.jpg` / `2.2-apres.jpg` | les 17 packs |
| `2.2-gros-plans.jpg` | à gauche avant, à droite après : sachet kraft, pot avec étiquette vergé, sachet de chips (film), canette |

## 2A — Éclairage studio, caméras, ombres, rendu HD

Mesures sur un GPU **Intel UHD P630 intégré** (Chrome, WebGL2 via Direct3D 11, sans WebGPU) : un appareil modeste,
représentatif. Scripts : `/dev-renders` (showcase 1024 px, avec durée), `/dev-renders?mode=viewer&i=N` (vue interactive :
FPS et temps de construction du modèle), `/dev-renders?mode=hd&i=N&camera=hero&lighting=premium` (rendu HD).

### Architecture

| Fichier | Rôle |
|---|---|
| `src/lib/three/scenePresets.ts` | **Configuration centrale**, pure et testée : 5 éclairages (`soft`, `premium`, `dramatic`, `ecommerce`, `natural`), 8 prises de vue (`front`, `threeQuarter`, `hero`, `top`, `closeUp`, `catalog`, `back`, `bottom`) en azimut, élévation, focale (mm), marge, zoom, point visé et ouverture. Contient aussi la composition automatique `frameShot()`, les niveaux `PREVIEW` / `HD` (`chooseQuality`) et les demandes de prise de vue `resolveShot({ style: "heroPremium" })`, qui serviront à la future couche IA. |
| `src/lib/three/studioEnvironment.ts` | Studio photo procédural (cyclorama et softboxes) converti en environnement de reflets. Aucun HDRI téléchargé. |
| `src/lib/three/studioRig.ts` | Plateau commun : environnement, lumières principale, de remplissage et de contour, ombre portée douce (VSM) sur un sol invisible, ombre de contact qui épouse la forme du pack. La carte d'ombre n'est recalculée que quand le pack change. |
| `src/lib/three/hdRender.ts` | Rendu **HD** dans le navigateur : accumulation de N images (anti-crénelage, ombres douces par déplacement de la source, profondeur de champ). |
| `src/lib/three/capabilities.ts` | Détection WebGL, WebGL2, WebGPU, mobile et appareil modeste. Sans WebGL, message de repli au lieu d'un écran noir. |

Consommateurs : la vue 3D de l'éditeur (`Packaging3DViewer`), les vignettes du catalogue et les visuels showcase
(`thumbnails.ts`), et le rendu HD : tous lisent les mêmes presets. Le visuel publicitaire (`adRender.ts`) et le hero de
la page d'accueil gardent leur propre éclairage pour l'instant.

### Résultats (17 packs)

| Mesure | Avant | Après |
|---|---|---|
| Vue interactive, FPS (min / médiane) | 57,6 / 60,2 | 55,0 / 60,1 |
| Construction du modèle (médiane / max) | 55 / 71 ms | 54 / 70 ms |
| Showcase 1024 px (médiane / moyenne / max) | 230 / 317 / 1 338 ms | 227 / 360 / 1 654 ms |
| Rendu HD 1600 px, 48 images accumulées | n'existait pas | 1,3 à 3,9 s |
| Sans GPU (SwiftShader) | rendu | rendu (lent) |
| Sans WebGL | canvas vide | message de repli |

| Planche | Contenu |
|---|---|
| `2A-avant-apres.jpg` | canette, flacon compte-gouttes, étui, canette noire (à gauche avant, à droite après) |
| `2A-showcase-avant.jpg` / `2A-showcase-apres.jpg` | les 17 packs, moteur showcase |
| `2A-vue-3d-avant.jpg` / `2A-vue-3d-apres.jpg` | les 17 packs, vue interactive de l'éditeur |
| `2A-rendu-hd.jpg` | rendus HD : hero premium, ¾ naturel, hero premium en verre, catalogue e-commerce, gros plan doux, hero dramatique |

### Rendu HD : choix techniques

- **Maintenant** : accumulation rastérisée (WebGL). Elle fonctionne partout où l'aperçu fonctionne, réutilise
  exactement les mêmes matières et ne demande aucune dépendance. Sur appareil modeste ou mobile : 20 images au lieu
  de 48, taille limitée à 2048 px.
- **Plus tard (ultra)** : `three-gpu-pathtracer`, non installé. La version 0.0.23 est compatible avec three 0.169 ;
  les versions ≥ 0.0.24 exigent three ≥ 0.185. Il apporterait l'éclairage global (lumière qui rebondit entre les
  surfaces, réfractions exactes dans le verre), au prix de dizaines de secondes par image sur ce type de GPU.
- **WebGPU** : indisponible sur la machine de test et encore absent de nombreux navigateurs. Il n'est pas utilisé ;
  WebGL2 reste la base, et la détection est prête.

## 2B — Silhouettes des bouteilles

`src/lib/three/geometry/bottleGeometry.ts` : un seul moteur paramétrique remplace le profil circulaire
`LatheGeometry`, qui ignorait L ≠ W. Chaîne : famille → configuration → section → profil vertical → géométrie.

- **Section** : cercle, ellipse vraie, rectangle ou carré à coins arrondis (`cornerRadius`), polygone à facettes
  (`facetCount`). La largeur et la profondeur sont respectées exactement (testé). Tous les anneaux partagent le même
  échantillonnage, un sommet par direction, donc l'épaule peut transformer la section du corps en section du col
  sans couture ni NaN.
- **Profil** : congé de base, corps droit, épaule (`soft`, `rounded`, `sloped`, `sharp`, `none`), col distinct, bague
  de finition (point d'attache des futures fermetures : `neck.width / depth / y`). Arêtes vives seulement là où elles
  sont voulues (épaule `sharp` ou `none`).
- **Base** : `flat`, `slightlyRounded`, `recessed` (piqûre de fond, bouteille de vin).
- **Étiquette** : `createBottleLabel` suit la section réelle, centrée à l'avant, avec les mêmes UV (gauche → droite,
  bas → haut) et la même `wrapTexture` qu'avant. Les artworks existants s'appliquent sans modification.
- **Liquide** (verre et plastique transparent) : même section, légèrement en retrait.
- **Familles** (`bottleFamily` / `bottlePreset`) : `round`, `beverage` (PET), `oval` (shampoing, VERDANT), `perfume`
  (flacon rectangulaire, SOLÈNE), `wine` (MAISON LUNE, bière, huile), `dropper`, `pump`, `spray`.
- Fermetures inchangées ; la bouteille s'arrête là où la fermeture commence, donc la hauteur totale reste celle du
  catalogue.

Triangles (corps + fond) : 4 032 pour les bouteilles rondes et ovales, 4 752 pour le vin (piqûre), 1 824 pour le
parfum. S'y ajoutent 20 à 96 triangles d'étiquette.

| Planche | Contenu |
|---|---|
| `2B-bouteilles-avant-apres.jpg` | par paires (avant à gauche, après à droite) : LUMINA ¾, MAISON LUNE face / hero / ¾, SOLÈNE face / hero / ¾, VERDANT gros plan / face / hero / ¾, PIMENTO face / ¾ |
| `2B-catalogue-bouteilles.jpg` | 22 bouteilles du catalogue, plus MAISON LUNE (face, ¾, hero), avec le nouveau moteur |

## 2B-4 — Bibliothèque de fermetures

`src/lib/three/geometry/closureLibrary.ts` : `createClosureGeometry(config)` renvoie une fermeture en **pièces
séparées**, chacune avec un emplacement de matière (`primary`, `secondary`, `metal`, `rubber`, `glass`). La phase
photoréalisme pourra ainsi donner à chaque pièce sa micro-surface et ses variations de rugosité.

| Type | Pièces | Triangles |
|---|---|---|
| `screwCap` (VERDANT, boissons) | bouchon moleté (32 nervures en géométrie) + bague d'inviolabilité | 1 488 + 360 |
| `ribbedCap` (PIMENTO, bouteilles rondes) | bouchon à 24 nervures larges + bague | 1 296 + 360 |
| `tamperRing` | bague seule | 480 |
| `wineCapsule` (MAISON LUNE) | capsule métallique qui dégage la bague du col, légers plis de feuille (seed) | 960 |
| `pump` | collerette nervurée, tige, poussoir, bec courbé | 2 388 |
| `spray` (SOLÈNE) | virole métallique, poussoir, buse orientée (`sprayDirection`) | 1 188 |
| `dropper` (LUMINA) | collerette nervurée, bulbe caoutchouc, pipette en verre dans la bouteille | 2 376 |
| `canLid` | bord roulé, fraisure, panneau en retrait, rivet, vraie languette (anneau, fente) | 2 306 |

- Origine y = 0 au sommet du col : la jupe des bouchons descend sur la bague du col (`bottle.finish`, exposé par
  `bottleGeometry.ts`).
- Montage en deux passes dans `packagingModels.ts` : la bouteille s'arrête là où la fermeture commence, donc la
  hauteur du catalogue est conservée (testé).
- Nervures : manchon dense (4 sommets par nervure) entre un bas et un haut peu subdivisés, pour que chaque nervure
  garde son côté éclairé et son côté ombré sans dépasser le budget.
- Déterministe : la seule irrégularité (plis de la capsule) vient du `seed`.

| Planche | Contenu |
|---|---|
| `2B4-fermetures.jpg` | gros plans : canette (dessus, hero), VERDANT (hero, face), PIMENTO, pompe, LUMINA, MAISON LUNE (hero, face), SOLÈNE (face, ¾) |
| `2B4-17-packs.jpg` | les 17 packs de démonstration avec les fermetures |
| `2B4-regression-sachet-brique.jpg` | **régression antérieure à cette phase** : TERRA (sachet) et OKKO (brique), en phase 2A, dans `a1ee833` et aujourd'hui |

**Régression connue, hors périmètre** : depuis les géométries de sachet et de brique (`d8206eb`, `3eacdd4`),
l'illustration de TERRA n'apparaît plus sur la face avant (sachet noir), et celle d'OKKO est projetée sur le toit et
les côtés au lieu de la face avant. Ce n'est pas causé par les fermetures : rendu identique avec et sans cette phase.

## 2B-5 — Visual Fidelity / photoréalisme

Détails techniques : [visual-fidelity.md](visual-fidelity.md).

- Source unique des matières : `src/lib/three/materials/` (27 presets, finitions, qualité LOW / MEDIUM / HIGH / ULTRA,
  graine déterministe par pack).
- Micro-surface en variantes, rugosité calibrée avec micro-rayures et traces (HD), aluminium anisotrope, verre
  physique (épaisseur, IOR, absorption, dispersion en HD), PEHD et PET distincts.
- Étiquettes physiques de 0,15 mm (face imprimée + chants et dos en papier), sur les bouteilles et les pots.
- Cyclorama en dégradé, ombre de contact serrée, profondeur de champ HD avec mise au point sur la face avant.
- Régressions corrigées : sachet TERRA (faces inversées), brique OKKO (contour, toit, crête).

| Planche | Contenu |
|---|---|
| `2B5-matrice-matieres.png` | les 27 matières sous l'éclairage premium (calibration des couleurs) |
| `2B5-avant-apres-hd.jpg` | SOLAR, TERRA, VERDANT, CROUNCH, MAISON LUNE, SOLÈNE : avant / après en gros plan, face, hero et ¾ |
| `2B5-gros-plans.jpg` | gros plans avant / après (brossé de la canette, papier, chant d'étiquette) |
| `2B5-verre.jpg` | PIMENTO (clair), LUMINA (ambré), MAISON LUNE (vert), SOLÈNE (parfum) |
| `2B5-17-packs-avant.jpg` / `2B5-17-packs-apres.jpg` | les 17 packs |
| `2B5-sachet-brique-repares.jpg` | TERRA, OKKO et CROUNCH après correction |

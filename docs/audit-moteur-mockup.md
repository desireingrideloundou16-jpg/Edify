# Audit du moteur de mockup 3D — Phase 1B

> Rapport interne, rédigé **avant toute modification** du moteur (règle n°1 de la directive).
> État du dépôt : commit `7cc396f` + phase 1. Aucun fichier 3D n'a été modifié pour ce rapport.

## 1. Vue d'ensemble

| Élément | État réel dans le code |
|---|---|
| Rendu | **100 % navigateur**, WebGL (Three.js 0.169). Aucun rendu serveur, aucun path tracing. |
| Bibliothèques | `three` (moteur), `@react-three/fiber` 9 + `@react-three/drei` 10 **uniquement** pour la visionneuse interactive du studio et la fenêtre AR. Les vignettes, le visuel pub et l'export AR utilisent Three.js directement. |
| Modèles 3D | **Aucun fichier** (pas de GLB/glTF, pas d'OBJ). Tous les emballages sont **générés en code** (procéduraux). |
| Définition paramétrique | Existe déjà : `ShapeRow` (`src/lib/catalog/shapeData.ts`, 119 contenants) + `PackagingSpec` `{ model, lengthMm, widthMm, heightMm, material }` + `PackagingDesign` (couleurs, polices, finition, textes, illustration, contenu visible). **À réutiliser** : c'est déjà la « Packaging Definition » demandée. |
| Shaders | Aucun shader personnalisé (`ShaderMaterial` / `onBeforeCompile` absents). |
| Textures externes / HDRI | Aucune. Environnements générés : `RoomEnvironment` (Three) ou `Lightformer` (drei). |
| Tests visuels | Aucun test de rendu 3D automatisé dans le dépôt. |

## 2. Réponses aux questions de la directive

### Quels modèles 3D existent ? Quels formats ?
24 familles procédurales (`ShapeModel`) : `box, mailer, rigid, pillow, tray, carton, bag, shopper, pouch, flatpouch, sachet, tube, can, tin, papertube, tub, cup, jar, jug` et 5 variantes de bouteilles (`bottle, wine, dropper, pump, spray`). Chaque entrée du catalogue (119) = une famille + dimensions en mm + matériau.
Construction (`src/lib/three/packagingModels.ts`, `buildModel`) :
- **Boîtes** : `RoundedBoxGeometry` (rayon ≈ 2 % de la plus petite dimension), 6 matériaux (un par face).
- **Bouteilles, bocaux, canettes** : `LatheGeometry` (profil de révolution, 96 segments) + étiquette = portion de cylindre ouvert.
- **Sachets, doypacks, sacs** : cylindre ou boîte **déformés sommet par sommet** (`deformY`) pour pincer les soudures.
- **Tubes, pots, gobelets** : cylindres (effilés pour pots et gobelets) + couvercles cylindriques.
- **Brique (carton)** : boîte + toit extrudé ; **cabas** : tores pour les anses.
Format de sortie : `THREE.Group` normalisé (plus grande dimension = 1 unité, posé sur y = 0). Export AR en GLB/USDZ à la volée (`arExport.ts`).

### Quels matériaux ?
`surfaceFromMaterial()` classe le matériau texte du catalogue en 7 surfaces : `paper, kraft, glass, plastic, clearplastic, metal, film`.
- `MeshPhysicalMaterial` : rugosité déduite du **nom** de la finition (« brillant » → 0,28, « soft touch / kraft / mat » → 0,82, sinon 0,55), `clearcoat` sur les finitions brillantes, `metalness` pour métal et film.
- **Verre** : `transmission 1`, IOR 1,5, teinte ambrée ou verte, `attenuationColor` ; **contenu visible** (jus, miel…) = volume intérieur opaque coloré.
- Plastique transparent : `transmission 0,95`.

**Manques** : aucune carte de normales, de relief ou de rugosité ; la « micro-texture » se limite à un grain de points dessiné dans la texture couleur (`paperGrain`). Les finitions du catalogue (dorure, vernis sélectif, gaufrage, holographique…) ne sont **que des noms** : elles ne changent que la rugosité globale, rien de localisé.

### Comment les textures sont-elles appliquées ?
Chaque face est dessinée dans un `<canvas>` par `drawFace()` / `drawWrap()` (`src/lib/artwork/draw.ts` et `compose.ts`), puis convertie en `CanvasTexture` (sRGB, anisotropie 8).
Résolution : 1 024 px pour la face avant, le dessus et le dos ; 512 px pour les côtés ; 1 536 px pour les étiquettes enveloppantes.

### Comment les dimensions sont-elles calculées ?
En millimètres réels (catalogue) pendant la construction, puis **mise à l'échelle** pour que la plus grande dimension vaille 1 unité. Conséquence : les proportions sont justes, mais deux produits côte à côte n'auraient pas leur taille relative réelle (sans importance tant qu'un seul pack est affiché).

### Comment le design 2D est-il projeté sur le packaging ?
Par **face logique** (avant / dos / côté / dessus / bandeau), avec les UV par défaut de chaque géométrie. Les emballages cylindriques reçoivent une étiquette enveloppante dont la zone « avant » est centrée face caméra.
**Point clé** : le PDF d'impression utilise un autre chemin, le **gabarit à plat** (`src/lib/print/layout.ts` : panneaux, contour de découpe, rainages, fonds perdus 3 mm) et `renderFlatArtwork`. Les deux chemins appellent la même fonction de dessin (le contenu est cohérent), mais **la 3D n'est pas dérivée du gabarit** : aucune garantie géométrique que ce qui est plié correspond au mm près, et le fond perdu n'existe pas en 3D.

### Comment la caméra est-elle configurée ?
- Studio : `PerspectiveCamera` fov 30°, 5 préréglages (`front, threeQuarter, back, top, bottom`) par vecteur de direction, cadrage automatique sur la sphère englobante, `OrbitControls` (distance min/max, amortissement).
- Vignettes : fov 28°, angle fixe. Visuel pub : fov 26° ou 32° selon le format, lacet aléatoire (graine), cible abaissée pour laisser la place au texte.
Pas de notion de focale (35 / 50 / 85 mm), pas de profondeur de champ.

### Comment les lumières sont-elles configurées ?
- Studio : `Environment` drei avec 6 `Lightformer` (panneaux lumineux procéduraux, résolution 256) + 1 lumière directionnelle + ambiance ; 3 préréglages (`studio, soft, warm`).
- Vignettes : `RoomEnvironment` (PMREM) + directionnelle.
- Visuel pub : `RoomEnvironment` + lumière principale, contre-jour et hémisphère ; lumière plus chaude sur décor photo.

### Comment les ombres sont-elles calculées ?
- Studio : `ContactShadows` (drei, 512 px, flou) ; pas d'ombre portée directionnelle.
- Visuel pub : **ombres VSM** (carte 2 048 px, flou) sur un plan « attrape-ombres » + texture d'occlusion de contact radiale sous le produit.
Pas d'occlusion ambiante (SSAO/GTAO), pas d'ombres douces physiques.

### Quel renderer ? Quel coût CPU/GPU ?
`WebGLRenderer`, tone mapping `Neutral`, exposition 1,05 à 1,12, `dpr` 1 à 2.
- **Studio** : à chaque modification (après 120 ms d'attente), **toute la géométrie et toutes les textures sont reconstruites** (dessin canvas des 6 faces + envoi au GPU). Suffisant aujourd'hui, mais c'est la première optimisation à faire avant d'ajouter des cartes de matière.
- **Mémoire GPU** (ordre de grandeur, textures non compressées) : une boîte ≈ 3 × 4 Mo + 3 × 1 Mo ≈ 15 Mo, plus les mipmaps.
- **Vignettes** : un seul contexte WebGL hors écran, mis en cache (400 entrées max).
- **Visuel pub** : un contexte créé puis détruit par rendu (jusqu'à 2 048 × 2 048), avec repli à 60 % si la carte graphique refuse.
Pas encore de mesure chiffrée : un banc d'essai est proposé en phase 2.1.

### Existe-t-il déjà des shaders ? Un système de scène ?
- Shaders : non.
- Scènes : oui, pour le **visuel pub** uniquement (`AD_SCENES` : podium, luxe, nature, minimal, pop) + décors photo IA optionnels (`AD_DECORS`, Cloudflare), avec étalonnage, vignettage et grain 2D.
- Le studio n'a que des préréglages de lumière, pas d'environnement (fond transparent).

## 3. Écart avec l'objectif « niveau professionnel mondial »

| # | Écart | Impact visuel | Effort | Coût API |
|---|---|---|---|---|
| G1 | Pas de micro-surface (fibres de papier, kraft, aluminium brossé, plastique) : surfaces « parfaites » | très fort | faible (cartes procédurales générées en canvas, mises en cache) | 0 |
| G2 | Finitions non rendues (dorure, vernis sélectif, gaufrage, débossage) | fort | moyen (masques par calque depuis `draw.ts` → métal / vernis / relief localisés) | 0 |
| G3 | Géométrie simplifiée : pas d'épaisseur de carton, rabats et rainages invisibles, soudures et zip de sachet schématiques, verre sans épaisseur intérieure | fort | moyen, **par modèle** | 0 |
| G4 | 3D non dérivée du gabarit (pas de correspondance garantie avec l'impression, pas de fond perdu, pas de pliage) | fort (fidélité) | élevé (UV depuis les panneaux du gabarit ; commencer par l'étui à rabats) | 0 |
| G5 | Éclairage : environnements génériques, peu de préréglages, pas de HDRI | moyen | faible (rigs `Lightformer` par préréglage + HDRI **CC0** optionnels, ex. Poly Haven) | 0 |
| G6 | Caméra : pas de focale ni de profondeur de champ, préréglages limités | moyen | faible | 0 |
| G7 | Qualité de rendu final : rasterisation seule (pas de réflexions ni ombres physiquement exactes) | fort pour le rendu HD | moyen (**path tracing progressif dans le navigateur**, ex. `three-gpu-pathtracer`, licence MIT, GPU du client) ; Blender Cycles côté serveur seulement si le banc d'essai le justifie (serveur GPU = coût) | 0 (navigateur) |
| G8 | Pas d'occlusion ambiante ni de post-traitement (AO, DOF léger) | moyen | faible (bibliothèque `postprocessing`, MIT) | 0 |
| G9 | Reconstruction complète à chaque retouche | performance | faible (ne redessiner que les faces modifiées, réutiliser la géométrie) | 0 |
| G10 | « Props flottants » du commit `c6e129f` : tores génériques sans lien avec le produit (le nom déduit par `deduceFloatingProps` n'est pas utilisé pour la forme) | négatif | faible (remplacer par des formes liées au produit, ou retirer) | 0 |
| G11 | Pas de pipeline d'assets (aucun manifeste de licence) — nécessaire seulement si l'on ajoute HDRI ou modèles | — | faible | 0 |

Conclusion : **pas de réécriture nécessaire**. L'architecture (définition paramétrique → géométrie procédurale → artwork par canvas → matériaux physiques → rendu WebGL) correspond déjà à la cible. Les gains viennent d'améliorations **ciblées** : micro-surface, finitions, détail géométrique, correspondance avec le gabarit, rendu final par path tracing. Tout cela sans API payante.

## 4. Proposition pour la phase 2 (à valider)

Chaque étape = un commit, testable seule, derrière le même rendu actuel par défaut.

1. **2.1 Banc d'essai** : 6 packs de référence (étui, doypack, bouteille verre, bocal, canette, sac kraft) rendus à angles fixes ; temps de rendu, mémoire GPU, captures comparatives avant / après.
2. **2.2 Micro-surface** : cartes de normales et de rugosité procédurales par surface (papier couché, kraft, carton, aluminium brossé, film métallisé, plastique, verre dépoli), mises en cache.
3. **2.3 Finitions localisées** : masques issus du dessin (logo, marque) → dorure (métal), vernis sélectif (clearcoat), gaufrage et débossage (relief).
4. **2.4 Géométrie de 4 modèles phares** : étui à rabats (épaisseur, rabat, rainages), doypack (soudures crantées, zip, encoche), bouteille verre (épaisseur, bague), canette (bord serti). Qualité avant quantité.
5. **2.5 Étui à rabats piloté par le gabarit** : UV calculés depuis `layout.ts`, fond perdu respecté ; base du futur pliage animé.
6. **2.6 Caméras et lumières** : préréglages `hero, front, three-quarter, side, top, close-up, ecommerce, luxury, editorial, minimal` (focales équivalentes) et `studio_soft, studio_contrast, luxury, ecommerce, natural_window, dramatic, minimal, dark_premium`.
7. **2.7 Rendu HD final** : path tracing progressif dans le navigateur, avec repli sur le rendu actuel si la carte graphique est trop faible.
8. **2.8 Scènes procédurales** : studio blanc, béton, marbre, bois, papier, luxe sombre… sans IA, avec HDRI CC0 seulement si le banc d'essai montre un gain net.

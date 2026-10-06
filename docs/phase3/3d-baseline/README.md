# PHASE 3D — BASELINE

État du moteur 3D **avant** toute modification de la Phase 3D : à quoi il ressemble et ce qu'il coûte.
Rien n'a été amélioré pour produire ces mesures. Toutes les valeurs dépendent de la machine (*machine-dependent*).

## 1. Commit de référence

`c0954fcfc540d89501f2fdd308fc739d723908d0` — *phase 3c: intelligent packaging resolver and design sync*
(enregistré dans `metrics.json` → `commit`). Mesures du 2026-10-05.

## 2. Conditions du benchmark

| Élément | Valeur |
|---|---|
| Machine | GPU **Intel UHD Graphics P630** (intégré), ANGLE Direct3D 11, Windows 10 |
| Navigateur | Chrome 154.0.8037.93, headless (`--headless=new`), GPU réel (pas SwiftShader) |
| Serveur | `npm run dev` (Next 15, mode développement, React StrictMode) |
| Page | `/dev-renders?mode=bench` (outil dev existant, complété : `src/app/dev-renders/bench3d.tsx`) |
| Pilote | `scripts/bench-3d.mjs` (protocole DevTools, WebSocket intégré à Node, aucune dépendance) |
| Taille de l'aperçu | 640 × 640 px (zone `#bench-stage`, canvas 638 px dans la bordure) |
| DPR | 1 (passe principale), 2 (passe « DPR 2 ») |
| Durée de mesure | 1,5 s de stabilisation puis **5 s** de rendu mesuré, par cas |
| Éclairage | `lighting="studio"` (= preset `premium`), celui de l'aperçu produit |
| Qualité | celle que le produit choisit lui-même (`chooseQuality("preview", caps)`) : **MEDIUM** sur cette machine ; **LOW** obtenu en émulant un appareil faible (`navigator.hardwareConcurrency = 2`, la règle du produit) ; **HIGH** = rendu HD (`renderHD`) |
| Fond | dégradé CSS du produit (`.st-3d` de `studio.css`, thème clair) |

Reproduire :

```bash
npm run dev
node --experimental-websocket scripts/bench-3d.mjs                # captures + métriques → metrics.json
node --experimental-websocket scripts/bench-3d.mjs --uncapped     # FPS sans vsync → metrics-uncapped.json
```

Options : `--url`, `--out`, `--chrome <chemin>`, `--size 640`, `--seconds 5`, `--headful`.
Durée : ~8 min (passe principale) + ~5 min (`--uncapped`).

### Instrumentation (outil dev uniquement, aucun code produit modifié)

- **Sonde de rendu** : enveloppe la méthode `render()` de *l'instance* `WebGLRenderer` créée par R3F pour l'aperçu
  (trouvée par le registre public `_roots` de `@react-three/fiber`). Elle appelle le `render` d'origine sans rien
  changer, puis relève `renderer.info` (draw calls, triangles, géométries, textures, programmes), la durée CPU de
  l'appel, la caméra et l'identité de l'objet packaging affiché.
- **Compteur de canvas** : `document.createElement("canvas")` est compté (indicateur de textures d'artwork dessinées).
- Les deux n'existent que dans la page `/dev-renders` (404 en production). Le viewer, le rig, les presets, les
  matériaux, la géométrie et l'export ne sont pas modifiés.

## 3. Panel de packaging

Formats **supportés** uniquement, aucun format refusé, catalogue inchangé.

| Famille | Format catalogue | Modèle | Matériau |
|---|---|---|---|
| pot | `cosmetic-jar` (Pot crème) | jar | Verre dépoli |
| bottle | `shampoo-bottle` (Bouteille shampoing) | bottle | PEHD |
| glass | `juice-bottle` (Bouteille de jus) | bottle | Verre transparent |
| metal | `beverage-can` (Canette 330 ml) | can | Aluminium |
| box | `folding-box-standard` (Boîte pliante) | box | Carton couché 350 g |
| pouch | `stand-up-pouch` (Doypack) | pouch | Kraft + PE |
| tube | `squeeze-tube` (Tube souple) | tube | PE |

**Design de référence, identique partout** : l'exemple *SOLAR — Bissap pétillant* (`SHOWCASE[0]` : textes, palette
jaune / noir / magenta / cyan, polices, illustration `/landing/art/00.webp`) + étiquette complète (ingrédients,
usage, code-barres EAN-13 valide, dates, prix) + un logo généré de façon déterministe (disque magenta, « S » blanc).

## 4. Conditions de rendu

- **Vues** : `front`, `threeQuarter`, `back`, les prises de vue existantes (`CAMERA_PRESETS`), passées au viewer par
  sa prop `view`. Rotation automatique désactivée pour les captures (`autoRotate={false}`, comme après un clic sur
  une vue dans le produit). Aucune modification de `CameraRig`.
- **Rotation** : la rotation automatique existante (`autoRotate`, vitesse 1,4), sans autre animation.
- **Captures** : capture d'écran de la zone `#bench-stage` (fond CSS + canvas), PNG, sans aucun traitement.
- **Planche** : `baseline-sheet.png` assemble les 21 captures MEDIUM (réduites à 320 px par `drawImage`, aucun
  autre traitement).

## 5. Résultats visuels

| Famille | Face | ¾ | Dos | ¾ LOW | HD ¾ (800 px) |
|---|---|---|---|---|---|
| pot | `pot/pot-front.png` | `pot/pot-three-quarter.png` | `pot/pot-back.png` | `pot/pot-three-quarter-low.png` | `pot/pot-hd-three-quarter.png` |
| bottle | `bottle/bottle-front.png` | `bottle/bottle-three-quarter.png` | `bottle/bottle-back.png` | `bottle/bottle-three-quarter-low.png` | `bottle/bottle-hd-three-quarter.png` |
| glass | `glass/glass-front.png` | `glass/glass-three-quarter.png` | `glass/glass-back.png` | `glass/glass-three-quarter-low.png` | `glass/glass-hd-three-quarter.png` |
| metal | `metal/metal-front.png` | `metal/metal-three-quarter.png` | `metal/metal-back.png` | `metal/metal-three-quarter-low.png` | `metal/metal-hd-three-quarter.png` |
| box | `box/box-front.png` | `box/box-three-quarter.png` | `box/box-back.png` | `box/box-three-quarter-low.png` | `box/box-hd-three-quarter.png` |
| pouch | `pouch/pouch-front.png` | `pouch/pouch-three-quarter.png` | `pouch/pouch-back.png` | `pouch/pouch-three-quarter-low.png` | `pouch/pouch-hd-three-quarter.png` |
| tube | `tube/tube-front.png` | `tube/tube-three-quarter.png` | `tube/tube-back.png` | `tube/tube-three-quarter-low.png` | `tube/tube-hd-three-quarter.png` |

Planche « BASELINE PHASE 3D — BEFORE » : `baseline-sheet.png`.
Caméra : `pot/camera-1-after-orbit.png`, `pot/camera-2-after-text.png`, `pot/camera-3-after-color.png`.

## 6. FPS

**Avec vsync (comportement réel du produit)** — 5 s, DPR 1, MEDIUM :

| Cas | FPS moyen | FPS min/s | FPS max/s | Frame time moyen | p95 | max |
|---|---:|---:|---:|---:|---:|---:|
| Statique, 7 familles × 3 vues | 60,0–60,1 | 60 | 60–61 | 16,6–16,7 ms | 17,1–18,1 ms | 17,9–20,0 ms |
| Rotation, 7 familles | 60,0–60,1 | 60 | 60 | 16,7 ms | 17,2–18,5 ms | 17,8–19,4 ms |
| Rotation DPR 2, 7 familles | 59,6–60,1 | 58–60 | 60 | 16,6–16,8 ms | 17,1–17,6 ms | 17,7–**52,3** ms (pot) |
| Statique LOW, 7 familles | 60,0–60,1 | 60 | 60 | 16,6–16,7 ms | 17,0–17,5 ms | 17,9–18,4 ms |

Sur cette machine, à 640 px, l'aperçu tient 60 FPS partout : le plafond vsync masque le coût. **Une scène
immobile est quand même redessinée 60 fois par seconde** (300 images en 5 s) : c'est le rendu continu.

**Sans vsync (`--uncapped`)** — coût réel par image, ¾, 5 s (frame time = durée d'une image, CPU+GPU, l'appel
`render()` attendant le GPU sous ANGLE) :

| Famille | Statique | Rotation | Rotation DPR 2 | Rotation LOW |
|---|---:|---:|---:|---:|
| pot (verre dépoli, transmission) | 235 FPS · 4,3 ms | 237 FPS · 4,2 ms | **71 FPS · 14,0 ms** | 532 FPS · 1,9 ms |
| bottle (PEHD) | 581 · 1,7 ms | 662 · 1,5 ms | 210 · 4,8 ms | 741 · 1,3 ms |
| glass (verre, transmission) | 263 · 3,8 ms | 254 · 3,9 ms | **82 · 12,3 ms** | 602 · 1,7 ms |
| metal (alu) | 412 · 2,4 ms | 420 · 2,4 ms | 114 · 8,8 ms | 480 · 2,1 ms |
| box (carton) | 751 · 1,3 ms | 779 · 1,3 ms | 217 · 4,6 ms | 864 · 1,2 ms |
| pouch (kraft) | 554 · 1,8 ms | 610 · 1,6 ms | 199 · 5,0 ms | 639 · 1,6 ms |
| tube (PE) | 629 · 1,6 ms | 627 · 1,6 ms | 216 · 4,6 ms | 640 · 1,6 ms |

Les p95 sans vsync sont irréguliers (9–56 ms à DPR 1, jusqu'à 111 ms à DPR 2 pour le pot) : sans plafond, Chrome
produit les images par rafales. À lire comme des coûts **relatifs**, pas comme des FPS atteignables.

## 7. Draw calls

Par image, relevés par `renderer.info.render.calls` (passe principale + transmission + ombre si recalculée) :

| pot | bottle | glass | metal | box | pouch | tube |
|---:|---:|---:|---:|---:|---:|---:|
| 11 (LOW 8) | 9 | 15 (LOW 11) | 8 | 9 | 7 | 6 |

Identiques dans les 3 vues et en rotation. La transmission ajoute 3–4 draw calls (pot, verre).

## 8. Triangles

| | pot | bottle | glass | metal | box | pouch | tube |
|---|---:|---:|---:|---:|---:|---:|---:|
| Par image (`renderer.info`) | 4 332 | 6 272 | 12 220 | 3 558 | 688 | 6 256 | 9 904 |
| Par image LOW | 3 368 | 6 272 | 10 192 | 3 558 | 688 | 6 256 | 9 904 |
| Modèle seul (maillages) | 2 116 | 6 172 | 6 060 | 3 458 | 588 | 6 156 | 9 804 |
| Maillages / matériaux | 3 / 4 | 5 / 4 | 5 / 4 | 5 / 3 | 1 / 6 | 2 / 4 | 3 / 3 |

Le nombre de triangles est négligeable pour un GPU, même intégré.

## 9. Textures

| | pot | bottle | glass | metal | box | pouch | tube |
|---|---:|---:|---:|---:|---:|---:|---:|
| Textures GPU vivantes (`info.memory.textures`), MEDIUM | 15 | 16 | 15 | 12 | 19 | 18 | 14 |
| idem, LOW | 8 | 8 | 8 | 8 | 13 | 10 | 8 |
| Sources du modèle MEDIUM (artwork + micro-surfaces) | 7 | 9 | 7 | 5 | 12 | 11 | 7 |
| Sources LOW (artwork seul) | 1 | 1 | 1 | 1 | 6 | 3 | 1 |
| Mémoire estimée MEDIUM (RGBA8 + mipmaps) | 4,2 Mo | 11,3 Mo | 10,7 Mo | 6,9 Mo | 9,2 Mo | 10,2 Mo | 12,0 Mo |
| idem LOW | 2,2 Mo | 8,6 Mo | 8,7 Mo | 5,6 Mo | 7,2 Mo | 7,5 Mo | 10,0 Mo |

La mémoire est une **estimation** calculée à partir de la taille des images. La mémoire GPU réelle n'est pas
mesurable avec l'instrumentation actuelle (three.js ne l'expose pas). Les textures de l'environnement, des ombres et de la
transmission ne sont pas incluses.

## 10. Temps de construction

Médiane de 3 constructions à chaud, hors viewer, même fonction `buildPackaging` (CPU) :

| | pot | bottle | glass | metal | box | pouch | tube |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1re construction (à froid, MEDIUM) | 43 ms | 96 ms | 77 ms | 36 ms | 39 ms | 61 ms | 48 ms |
| LOW | 2,7 ms | 3,5 ms | 3,9 ms | 6,9 ms | 3,2 ms | 7,3 ms | 4,0 ms |
| MEDIUM | 3,2 ms | 3,8 ms | 3,0 ms | 5,2 ms | 3,1 ms | 5,6 ms | 3,6 ms |
| HIGH | 3,3 ms | 3,6 ms | 2,9 ms | 7,0 ms | 3,0 ms | 5,3 ms | 3,5 ms |
| Canvas créés par construction L / M / H | 2/2/6 | 2/2/18 | 2/2/14 | 2/2/6 | 7/7/13 | 4/4/12 | 2/2/8 |

Mise en place, sur un renderer privé (mêmes classes que le viewer ; `gl.finish()` après chaque rendu = CPU+GPU) :

| | pot | bottle | glass | metal | box | pouch | tube |
|---|---:|---:|---:|---:|---:|---:|---:|
| `new StudioRig` + `attach` (environnement PMREM) | 16,9 ms | 15,8 | 15,7 | 15,8 | 16,1 | 16,4 | 15,0 |
| `rig.fit` (ombres de contact, carte d'ombre) | 15,6 ms | 16,9 | 18,8 | 16,6 | 27,0 | 39,7 | 65,7 |
| `frameShot` (cadrage) | 0,1 ms | 0,2 | 0,1 | 0,1 | 0,1 | 0,1 | 0,1 |
| 1er rendu (compilation des shaders + envoi des textures) | 100 ms | 76 | 136 | 61 | 57 | 62 | 34 |
| Rendu stable (médiane de 10) | 0,9 ms | 0,3 | 0,6 | 0,2 | 0,3 | 0,3 | 0,3 |
| Viewer : montage → 1re image avec le packaging (¾) | 251 ms | 211 | 241 | 199 | 211 | 226 | 223 |

**Rendu HD** (`renderHD`, 800 × 800, 48 échantillons, HIGH, fond du preset) : pot 1 534 ms · bottle 1 059 ·
glass 1 813 · metal 1 204 · box 839 · pouch 1 036 · tube 881.

Lecture : la construction CPU à chaud est rapide (3–7 ms), car le dessin des canvas 2D est accéléré et différé.
Le vrai coût apparaît au **premier rendu** (34–136 ms : compilation + envoi des textures), et la première construction
d'une session paie la génération des micro-surfaces (36–96 ms). La séparation « textures » / « matériaux » à
l'intérieur de `buildPackaging` n'est **pas mesurable** sans instrumenter `packagingModels.ts` (fichier protégé).
En HIGH, le nombre de canvas créés à chaque construction monte (6–18 contre 2–7) : les micro-surfaces avec
rayures et traces ne sont pas réutilisées d'une construction à l'autre (constat, non corrigé).

## 11. Reconstruction

Scénario contrôlé sur le pot (¾, statique) : changer le texte, puis une couleur, puis l'illustration.

| Changement | Reconstructions affichées | Délai jusqu'à l'image avec le nouveau packaging | Canvas créés | Construction directe | Mini-3D (440 px) |
|---|---:|---:|---:|---:|---:|
| Texte (`productName`) | 1 | 176 ms | 10 | 3,1 ms | 142 ms |
| Couleur (`palette[0]`) | 1 | 240 ms | 4 | 2,9 ms | 109 ms |
| Illustration (`art`) | 1 | 157 ms | 4 | 2,5 ms | 125 ms |

- Chaque modification reconstruit **tout** le packaging (géométrie, textures, matériaux), après le debounce de 120 ms.
- Le délai comprend ce debounce et une compilation éventuelle ; en mode dev, StrictMode peut doubler la
  construction mémorisée (le compteur de canvas inclut ces doublons ; une seule reconstruction est affichée).
- Dans l'onglet 2D, chaque modification relance aussi la **mini-3D** (`renderShowcase` 440 px) : 109–142 ms de
  plus, sur le contexte WebGL des miniatures.

## 12. Comportement caméra

Scénario : pot, vue ¾, orbite manuelle (glisser de −180 px, +40 px), puis texte, puis couleur.

| Moment | Position caméra | Direction |
|---|---|---|
| Départ (preset ¾) | (2,333 ; 1,706 ; 3,332) | (−0,546 ; −0,309 ; −0,779) |
| Après l'orbite manuelle | (2,234 ; 3,166 ; −2,359) | (−0,522 ; −0,650 ; 0,552) |
| Après le changement de **texte** | (2,333 ; 1,706 ; 3,332) | (−0,546 ; −0,309 ; −0,779) |
| Après le changement de **couleur** | (2,333 ; 1,706 ; 3,332) | (−0,546 ; −0,309 ; −0,779) |

**Caméra réinitialisée** : à chaque reconstruction, la caméra revient exactement au cadrage du preset et l'orbite de
l'utilisateur est perdue (preuve visuelle : `pot/camera-1-after-orbit.png` → `pot/camera-2-after-text.png`).
Mécanisme (audit Step A) : `CameraRig` dépend de `object`, qui est un nouvel objet à chaque reconstruction. La cible
des `OrbitControls` n'est pas observable de l'extérieur ; la direction de visée la remplace ici.

## 13. Transparent / verre

`glass/glass-*.png`, `glass/glass-three-quarter-low.png`, `glass/glass-hd-three-quarter.png` ; même constat sur le
pot en verre dépoli.

- **Aperçu MEDIUM** : la bouteille en « verre transparent » est rendue **blanche et opaque** (voile laiteux). On ne
  voit ni le fond, ni la réfraction, ni le contenu ; aucun reflet lisible sur le corps. Au dos, l'intérieur blanc
  de l'étiquette apparaît comme un aplat blanc. Cohérent avec la cause relevée à l'audit (passe de transmission
  remplie en blanc à 50 % quand le canvas est transparent) ; la cause n'est **pas** vérifiée ici, seul le résultat
  est documenté.
- **LOW** : verre à 32 % d'opacité, donc toujours blanchâtre ; l'ombre du sol se voit à travers le culot.
- **HD** : verre réellement transparent, réfraction et reflets crédibles. **L'écart aperçu → HD est le plus grand
  de tout le panel.**
- Coût : la transmission double ou triple le temps d'image (3,8–4,3 ms contre 1,3–1,7 ms en opaque, sans vsync),
  avec les pires pics (p95 50–56 ms) ; 14 ms par image à DPR 2.

## 14. Métal

`metal/metal-*.png`, `metal/metal-hd-three-quarter.png`.

- Aluminium brossé visible sous l'encre (micro-surface `brushed`), bords et couvercle métalliques crédibles.
- Reflets peu contrastés : on ne lit pas de bandes de lumière nettes sur le cylindre ; l'environnement réfléchi
  reste discret.
- Anisotropie : réduite de moitié en MEDIUM et absente en LOW (réglage du preset) ; peu perceptible à 640 px.
- HD : même lecture, ombres plus douces. Qualité générale correcte à bonne.

## 15. Background / environnement

- Fond visible = **dégradé CSS** du produit (blanc → `#e9ecf1`) ; le canvas est transparent, l'environnement 3D
  (studio sombre `premium` + panneaux lumineux) n'est visible que dans les reflets.
- Sur les objets opaques à cette taille, l'incohérence fond clair / studio sombre est **peu visible** (couvercles
  noirs brillants, bords de canette). Elle est surtout visible sur le verre (voile blanc).
- Sol : invisible, seulement l'ombre portée (vers la droite) et l'ombre de contact. Contact au sol propre, sans
  impression de flottement ; aucun reflet ni rebond de couleur au sol.
- HD : fond du preset (`#eceae6`) dans l'image, ce qui ne correspond pas exactement au dégradé de l'aperçu.

## 16. Qualité par famille

Notes de 1 (faible) à 5 (excellent), d'après les captures MEDIUM ¾ (et face / dos) réellement examinées.

| Famille | Matériau | Artwork | Lumière | Ombres | Contact sol | Profondeur | Reflets | Fond / env. | **Global** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| pot (verre dépoli) | 2 | 3 | 3 | 3 | 4 | 2 | 3 | 3 | **3** |
| bottle (PEHD) | 3 | 3 | 3 | 3 | 4 | 2 | 2 | 3 | **3** |
| glass (verre) | 1 | 3 | 2 | 3 | 3 | 1 | 1 | 2 | **1** |
| metal (alu) | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | **3** |
| box (carton) | 3 | 4 | 3 | 3 | 4 | 3 | 2 | 3 | **3** |
| pouch (kraft) | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 3 | **4** |
| tube (PE) | 3 | 3 | 3 | 3 | 4 | 3 | 2 | 3 | **3** |

Constantes : textes fins peu lisibles à 640 px (bouteille, tube, pot) ; éclairage plat sur les grandes faces ;
pas d'ombrage propre (bouchon/col, couvercle/pot). Le rendu HD est nettement meilleur pour le verre (≈ 4).

## 17. Principaux coûts

Classés d'après les mesures ci-dessus :

1. **Rendu continu** : une scène immobile est redessinée 60 fois par seconde (300 images en 5 s mesurées), aussi
   bien statique qu'en rotation. C'est le coût permanent n°1 (batterie, chaleur), invisible dans les FPS.
2. **DPR 2** : ×3 à ×3,7 sur le temps d'image (box 1,3 → 4,6 ms ; pot 4,2 → 14,0 ms ; verre 3,9 → 12,3 ms).
   Seul cas où le plafond de 60 FPS a été manqué (pot : 58 FPS min, une image à 52 ms).
3. **Transmission (verre, verre dépoli)** : ×2,5 à ×3 sur le temps d'image par rapport aux packs opaques, plus les
   pires pics ; supprimée en LOW (1,7–1,9 ms).
4. **Reconstruction complète à chaque modification** : 157–240 ms jusqu'à l'image mise à jour, plus la mini-3D
   (109–142 ms) dans l'onglet 2D, plus la caméra réinitialisée.
5. **Premier rendu / montage** : 34–136 ms de compilation et d'envoi des textures, 199–251 ms du montage à la
   première image ; payé à chaque remontage du canvas (bouton de vue, « Recentrer »).

Coûts mesurés et faibles : draw calls (6–15), triangles (0,7 k–12 k), construction à chaud (3–7 ms), cadrage
(0,1 ms), environnement (~16 ms par création du rig).

## 18. Limites de mesure

- **Machine-dependent** : un seul poste (Intel UHD P630). Ces chiffres ne valent pas pour un mobile réel ni pour
  un GPU dédié.
- **Mode développement** : React non minifié et StrictMode (double appel des `useMemo` et effets) ; les durées de
  montage et de reconstruction sont pessimistes. La page `/dev-renders` n'existe pas en production.
- **vsync** : la passe principale plafonne à 60 FPS ; la passe `--uncapped` donne les coûts relatifs (rafales,
  p95 bruités).
- **Temps GPU** : non mesurable avec l'instrumentation actuelle (pas de requêtes de timer GPU) ; le temps
  `render()` mesuré inclut l'attente GPU sous ANGLE.
- **Mémoire GPU** : non mesurable avec l'instrumentation actuelle ; seule une estimation à partir des images est donnée.
- **Textures vs matériaux** dans `buildPackaging` : non séparables sans toucher `packagingModels.ts` (protégé).
- **LOW** : émulé (`hardwareConcurrency = 2`), pas mesuré sur un vrai mobile. **DPR 2** : émulé par Chrome.
- **Captures** : prises dans la page de banc avec le vrai composant d'aperçu et le fond CSS du produit, mais pas
  dans la page `/create` complète (pas de compte, pas d'interface autour).
- **Cible OrbitControls** non observable de l'extérieur : remplacée par la direction de la caméra.
- **Compteur de canvas** : indicateur brut (inclut des canvas de mesure de texte et les doublons StrictMode).
- **Mobile, laptop haute densité, GPU faible réels** : non mesurés.

## 19. Baseline officielle

| Packaging | Vue | FPS moyen | FPS min | Draw calls | Triangles | Textures | Build (chaud / froid) | Qualité |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| pot | face / ¾ / dos | 60,1 | 60 | 11 | 4 332 | 15 | 3,2 / 43 ms | 3 |
| bottle | face / ¾ / dos | 60,0 | 60 | 9 | 6 272 | 16 | 3,8 / 96 ms | 3 |
| glass | face / ¾ / dos | 60,1 | 60 | 15 | 12 220 | 15 | 3,0 / 77 ms | 1 |
| metal | face / ¾ / dos | 60,1 | 60 | 8 | 3 558 | 12 | 5,2 / 36 ms | 3 |
| box | face / ¾ / dos | 60,1 | 60 | 9 | 688 | 19 | 3,1 / 39 ms | 3 |
| pouch | face / ¾ / dos | 60,1 | 60 | 7 | 6 256 | 18 | 5,6 / 61 ms | 4 |
| tube | face / ¾ / dos | 60,0–60,1 | 60 | 6 | 9 904 | 14 | 3,6 / 48 ms | 3 |

Valeurs MEDIUM, DPR 1, vsync actif, 640 px, Intel UHD P630. Coûts sans vsync : § 6. Détails complets, par vue et
par cas : `metrics.json` et `metrics-uncapped.json`. Toute sous-phase 3D-B… se compare à ce dossier, avec la même
commande sur la même machine.

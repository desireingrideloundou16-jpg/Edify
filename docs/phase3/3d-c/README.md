# PHASE 3D-C — Export HD

L'image 3D de l'export ZIP (`<projet>-apercu-3d.png`) est désormais un rendu HD dédié, indépendant du viewer
interactif. Référence : 3D-B (`docs/phase3/3d-b/`), commit `c0954fc`, même machine (Intel UHD P630, Chrome headless).

## Avant / après

| | Avant 3D-C | 3D-C |
|---|---|---|
| Source de l'image du ZIP | onglet 3D ouvert : capture du **canvas interactif** (caméra, taille et état laissés par l'utilisateur) ; sinon `renderShowcase` 1400 px | `renderExportPreview` → `renderHD` (son propre renderer et contexte WebGL), prise de vue fixe `heroPremium` |
| Taille | taille de l'écran ou 1400 px | 2048 × 2048 (bridé par `chooseQuality("hd")` sur appareil faible) |
| Antialiasing / ombres | 1 image (MSAA) | 48 images accumulées (anticrénelage, ombres douces, profondeur de champ du preset hero) |
| Fond | transparent | transparent (PNG RGBA, contrat inchangé) |
| Ombre portée | coupée par le bord selon le cadrage | cadrée en entier, pack centré |
| Effet sur le viewer | un `gl.render` sur le renderer interactif | aucun |

## Fichiers

| Fichier | Changement |
|---|---|
| `src/lib/three/hdExport.ts` (nouveau) | `HD_EXPORT` (heroPremium, 2048, transparent, `packAndShadow`) et `renderExportPreview` (repli `renderShowcase` 1400 px sans WebGL) |
| `src/lib/three/hdRender.ts` | polices du design chargées avant le dessin ; **toute** la préparation dans `try / finally` (renderer, rig, pack, cibles libérés même en cas d'erreur) ; option `frame: "packAndShadow"` + `packAndShadowBounds` (cadrage seulement, `frameShot` réutilisé). Défaut inchangé (`frame: "pack"`) |
| `src/components/workspace/EdifyWorkspace.tsx` | `handleDownloadZip` utilise `renderExportPreview(shape, spec, design)` ; même nom de fichier |
| `tests/unit/hd-export.test.ts` (nouveau) | 5 tests : contrat d'export, cadrage ombre, câblage ZIP, nettoyage |
| `src/app/dev-renders/bench3d.tsx`, `scripts/bench-3d.mjs` | suite `--suite 3dc` (banc 3D-A étendu) |

## Résolution (export, 48 échantillons)

| Côté | Verre (ms, 2 essais) | PNG | Boîte (ms) | PNG |
|---:|---|---:|---|---:|
| 1024 | 1 824 / 1 024 | 126 Ko | 965 / 772 | 220 Ko |
| 1600 | 1 454 / 1 674 | 273 Ko | 860 / 878 | 504 Ko |
| **2048** | **1 967 / 1 900** | **415 Ko** | **996 / 981** | **778 Ko** |
| 3072 | 3 223 / 3 172 | 842 Ko | 1 346 / 1 337 | 1 531 Ko |

2048 = valeur par défaut de `renderHD`. 3072 multiplie le temps par 1,4–1,7 et les cibles HalfFloat (3 × 3072² × 8 octets ≈ 225 Mo
de mémoire GPU, estimation) pour un gain limité.

## Sept formats (2048 px)

| Format | Export (froid / chaud / chaud) | PNG | Alpha transparent / opaque / partiel | Bord (alpha max) | Silhouette viewer vs HD (IoU) | Écart couleur sur le pack | Déterminisme |
|---|---|---:|---|---:|---:|---:|---|
| pot | 1 773 / 1 763 / 1 774 ms | 546 Ko | 87,0 / 8,4 / 4,7 % | 0 | 0,9942 | 1,47 | 0 % fort |
| bottle | 1 069 / 1 009 / 1 022 ms | 452 Ko | 89,8 / 8,7 / 1,5 % | 0 | 0,9980 | 1,64 | 0 % |
| glass | 1 905 / 1 971 / 1 875 ms | 414 Ko | 90,3 / 5,2 / 4,6 % | 0 | 0,9967 | 1,42 | 0 % |
| metal | 1 162 / 1 088 / 1 104 ms | 677 Ko | 86,4 / 11,8 / 1,8 % | 0 | 0,9971 | 9,67 | 0 % |
| box | 1 166 / 1 052 / 1 050 ms | 778 Ko | 84,1 / 13,7 / 2,1 % | 0 | 0,9990 | 0,79 | 0 % |
| pouch | 1 077 / 1 038 / 1 019 ms | 716 Ko | 86,6 / 12,2 / 1,3 % | 0 | 0,9982 | 1,04 | 0 % |
| tube | 994 / 965 / 986 ms | 465 Ko | 90,3 / 8,2 / 1,5 % | 0 | 0,9986 | 0,88 | 0 % |

- **Viewer vs HD** : même caméra (¾) et même taille ; silhouette identique à 0,994–0,999 près ; écart couleur moyen 0,8–1,6 / 255
  (métal 9,7 : matière HIGH en HD, anisotropie et rayures, contre MEDIUM dans le viewer). Pas de comparaison pixel exacte : ombres
  douces, anticrénelage et qualité matière diffèrent volontairement.
- **Déterminisme** : deux exports successifs, 0 % de pixels fortement différents (écart moyen ≤ 0,006 / 255 : grain papier
  aléatoire de l'artwork).

## Design courant

| Modification (pot) | Export vs export précédent | Export vs même design ré-exporté |
|---|---|---|
| Texte | 0,011 % de pixels forts | 0 % |
| Couleur | 0,457 % | 0 % |
| Illustration | 0,208 % | 0 % |
| Packaging (pot → bouteille de jus) | silhouette IoU 0,24 | — |

Chaque export montre le design courant ; jamais le précédent.

## Isolation du viewer et nettoyage

- Orbite → export → caméra du viewer **identique** (2,2423 ; 3,1635 ; −2,3535), même renderer (id 1), **0 image rendue par le viewer
  pendant l'export**, 0 image dans les 5 s d'inactivité qui suivent ; ensuite orbite, Face, ¾, Dos et Recentrer fonctionnent.
- 20 exports d'affilée (512 px, 706–1 017 ms) : 24 contextes WebGL créés et libérés au total, **aucun avertissement WebGL**
  (Chrome perd le contexte le plus ancien au-delà de 16 actifs : le viewer aurait été perdu), contexte du viewer intact.

## ZIP de bout en bout (vrai éditeur, compte de test supprimé)

`edify-nouveau-packaging.zip` : `-impression.pdf` (%PDF), `-apercu-3d.png` (**2048 × 2048, RGBA 8 bits**), `-modele-3d.glb` (glTF),
`fiche-technique.json`. Export complet en 10,3 s (PDF, GLB et preflight compris). Le viewer est identique au pixel près avant et après
l'export (même élément canvas) et tourne encore ensuite. Preuves : `zip-e2e/`.

## Reproduire

```bash
NEXT_DIST_DIR=.next-bench npx next dev -p 3000
node --experimental-websocket scripts/bench-3d.mjs --suite 3dc --tag run --out docs/phase3/3d-c
```

`metrics-3dc-pack-framing.json` : premier passage, cadrage « pack seul » (ombre coupée au bord sur les 7 formats).
`metrics-3db-regression-3dc.json` : suite 3D-B relancée après 3D-C. `regression-3da/` : banc 3D-A relancé (planche et métriques).

# PHASE 3D-D — Prise de vue, ombre, cadrage produit

Export HD (`renderExportPreview → renderHD`, PNG 2048 transparent) : le **produit** décide du cadrage, l'**ombre**
reçoit une part contrôlée du cadre et s'estompe au lieu d'être coupée, et la **prise de vue** vient de
`resolveShot()` à partir d'une requête facultative (par ex. `MasterDesignIntent → shotRequestFromIntent`).
Même machine et même banc que 3D-A/B/C. Référence : 3D-C (`docs/phase3/3d-c/`).

## Cause du pot trop petit (3D-C)

1. Le cadrage « ombre entière » (3D-C) donnait à l'ombre portée **toute** sa longueur : avec la lumière principale à
   58° (premium) un pot large projette ~0,5 de son côté, à 26° (dramatic) plus de 2 fois sa hauteur.
2. Pour garder le pack centré, cette longueur était reportée de l'autre côté (symétrie), puis enveloppée dans une
   boîte alignée sur les axes du monde : avec un pot large vu en biais, la boîte gonflait bien au-delà de l'ombre.
3. `frameShot` ne cadrait qu'une boîte : l'ombre et la visée étaient liées.

## Changements (minimaux, sur l'existant)

| Fichier | Changement |
|---|---|
| `src/lib/three/scenePresets.ts` | `frameShot(bounds, shot, aspect, include = [])` : points facultatifs à garder dans le champ **sans déplacer la visée**. Sans `include`, résultat identique (testé). |
| `src/lib/three/hdRender.ts` | `shadowReach` (portée de l'ombre, plafonnée par `allowance`) et `shadowFramePoints` remplacent `packAndShadowBounds` ; option `shadowAllowance` ; si l'ombre est plafonnée, `rig.setShadowFalloff`. Défaut inchangé (pas de plafond = 3D-C). |
| `src/lib/three/studioRig.ts` | `setShadowFalloff(start, end)` : estompage radial de l'ombre portée et des ombres de contact au sol. **Opt-in**, appelé seulement par l'export (le viewer, les vignettes et le rendu pub ne l'appellent pas). |
| `src/lib/three/hdExport.ts` | `renderExportPreview(…, { shot })` → `resolveExportShot` → `resolveShot()` ; `HD_EXPORT.defaultStyle = "heroPremium"` (contrat 3D-C quand aucun style n'est résolu) ; `HD_EXPORT.shadowAllowance = 0.25` ; le résultat rapporte la prise de vue utilisée. |
| `tests/unit/hd-export.test.ts` | cadrage 3D-D (portée, plafond, `frameShot` + points, réservé à l'export) — 8 tests |
| `tests/unit/shot-intent-export.test.ts` (nouveau) | PI-5 → `shotRequestFromIntent` → `resolveShot` → `renderHD` (espion) — 4 tests |
| `src/app/dev-renders/bench3d.tsx`, `scripts/bench-3d.mjs` | suite `--suite 3dd` (7 familles × 5 styles, avant / après, images libérées après analyse) |

Règle de cadrage : la visée reste celle du preset sur le **produit** (centré) ; l'ombre a droit, au-delà de l'empreinte
au sol du pack, à **25 % du plus grand côté du pack** (adaptatif : bouteille, pot, tube, boîte, sachet) ; si elle est
plus longue, elle s'estompe sur la partie extérieure de cette place (jamais coupée, jamais dominante) ; une ombre courte
n'est pas touchée.

## Avant / après (2048 px, occupation du produit en % du côté : largeur / hauteur)

| Famille | heroPremium | catalogEcommerce | naturalLifestyle | dramaticHero |
|---|---|---|---|---|
| pot | 38 / 32 → **51 / 43** | 46 / 40 → **56 / 49** | 28 / 29 → **48 / 48** | 20 / 16 → **47 / 40** |
| bottle | 17 / 59 → **23 / 81** | 21 / 71 → **23 / 81** | 10 / 36 → **23 / 82** | 6 / 20 → **23 / 81** |
| glass | 18 / 57 → **25 / 81** | 22 / 66 → **25 / 73** | 11 / 36 → **25 / 80** | 6 / 20 → **25 / 81** |
| metal | 26 / 48 → **39 / 73** | 37 / 68 → **38 / 70** | 18 / 33 → **40 / 75** | 10 / 19 → **39 / 74** |
| box | 25 / 58 → **35 / 84** | 31 / 74 → **34 / 82** | 17 / 38 → **38 / 84** | 9 / 20 → **35 / 84** |
| pouch | 28 / 47 → **43 / 75** | 41 / 68 → **43 / 71** | 17 / 33 → **40 / 76** | 11 / 18 → **43 / 75** |
| tube | 17 / 59 → **23 / 81** | 21 / 72 → **24 / 81** | 10 / 36 → **22 / 81** | 6 / 20 → **23 / 81** |

- Alpha maximal sur la bordure : **0** dans les 28 cas ci-dessus, avant comme après (ombre jamais coupée).
- `closeUpDetail` (zoom 2, marge 0 : gros plan qui recadre le pack par conception) touche le bord avant comme après.
- Silhouette du pack seul (recadrée sur lui-même) avant / après : IoU 0,975–0,998 → même géométrie, même angle ; l'écart
  résiduel vient de la perspective (caméra plus proche).
- Surface moyenne du produit (hors gros plan) : **10 % → 24 %** de l'image. Temps moyen par export 1 393 → 1 635 ms.

Images : `<famille>/<famille>-<style>-before.png` / `-after.png` (pot, bottle, box, pouch, tube × heroPremium,
catalogEcommerce). Métriques : `metrics-3dd-before.json`, `metrics-3dd-after.json`.

## Régressions

- 3D-C relancé (`regression-3dc/`) : 7 formats en RGBA 2048, déterminisme 0 %, viewer intact pendant / après l'export,
  20 exports sans avertissement WebGL.
- 3D-B relancé (`metrics-3db-regression-3dd.json`) : identique (caméra conservée, 1 renderer, 0 image au repos).
- 3D-A relancé (`regression-3da/`) : 35 captures, 0 % de pixels fortement différents vs 3D-B (viewer et HD par défaut
  inchangés).
- ZIP de bout en bout (`zip-e2e/`) : PDF, PNG 2048 RGBA, GLB, fiche technique ; viewer identique avant / après.

## Reproduire

```bash
NEXT_DIST_DIR=.next-bench npx next dev -p 3000
node --experimental-websocket scripts/bench-3d.mjs --suite 3dd --variant export --tag after --before docs/phase3/3d-d --out docs/phase3/3d-d
```

`--variant direct --tag before` reproduit l'état 3D-C (renderHD, cadrage « ombre entière ») — à lancer sur le code 3D-C.

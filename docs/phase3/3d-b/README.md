# PHASE 3D-B — Stabilité de l'aperçu, caméra persistante, rendu à la demande

Référence : baseline 3D-A (`docs/phase3/3d-baseline/`), commit `c0954fc`. Même machine (Intel UHD P630), même
Chrome headless, même panel, même design (SOLAR Bissap), même page de banc, 640 px, DPR 1, qualité MEDIUM.

## Ce qui change

| Fichier | Changement |
|---|---|
| `src/components/workspace/Packaging3DViewer.tsx` | `frameloop="demand"` ; `CameraRig` ne recadre plus à chaque reconstruction ; nouvelle prop `viewCommand` ; `AutoRotateFrames` |
| `src/components/studio/PreviewStage.tsx` | suppression de `key={viewKey}` (remontage du canvas) → `viewCommand` |
| `src/app/dev-renders/bench3d.tsx`, `scripts/bench-3d.mjs` | banc 3D-A complété (`--suite 3db`, `--label`) |

Inchangés : géométrie, `packagingModels.ts`, matériaux, presets d'éclairage et de caméra, environnement, rig,
rendu HD, miniatures, rendu publicitaire, export, PDF, `fullDesign`.

## Résultats (avant → après)

| Mesure | 3D-A | 3D-B |
|---|---|---|
| Images rendues, scène immobile, 5 s (7 packs × 3 vues) | 300–301 | **0** |
| idem, LOW | 300 | **0** |
| Rotation auto, FPS | 60,0–60,1 | 60,0–60,1 |
| Rotation auto DPR 2, FPS / pire image | 59,6–60,1 / 52,3 ms | 60,0–60,1 / 18,9 ms |
| Orbite à la souris (3 s), FPS | 60,1 | 60,1 |
| Zoom molette, images/s | 60,1 (boucle continue) | 18,5 = 20,5 crans/s envoyés (une image par cran) |
| Draw calls / triangles | 6–15 / 688–12 220 | identiques |
| Montage → 1re image | 194–274 ms | 203–260 ms |
| Reconstruction texte / couleur / illustration | 176 / 240 / 157 ms | 177 / 145 / 159 ms |
| Inactivité après orbite (5 s) | 301 | 60 (fin de l'amortissement, puis 0) |
| Inactivité après rotation auto coupée | 300 | 0 |
| Redimensionnement 640 → 480 px : images 2 s après | 120 | 0 (aspect 0,749, pack visible) |

### Caméra (pot, ¾ ; positions)

| Étape | 3D-A | 3D-B |
|---|---|---|
| Après orbite manuelle | (2,234 ; 3,166 ; −2,359) | (2,243 ; 3,163 ; −2,353) |
| Après texte | **(2,333 ; 1,706 ; 3,332)** = preset | (2,241 ; 3,164 ; −2,354) conservée |
| Après couleur | preset | (2,240 ; 3,164 ; −2,355) conservée |
| Après illustration | preset | (2,238 ; 3,165 ; −2,356) conservée |
| Après changement de packaging (bouteille, boîte, canette) | recadrée | conservée, pack visible (8/8 coins) |

Dérive résiduelle ≤ 0,006 unité : c'est l'élan amorti de l'orbite de l'utilisateur, qui s'écoule à chaque
image rendue.

### Boutons de vue (vrai `PreviewStage`)

| | 3D-A | 3D-B |
|---|---|---|
| Renderers créés (Face, ¾, Recentrer, Dos) | 5 (ids 1–5) | **1** |
| Contextes WebGL de la page | 8 | 4 (aucun nouveau) |
| Face | (0 ; 0,805 ; 4,004) | (0 ; 0,805 ; 4,004) |
| ¾ | (2,397 ; 1,742 ; 3,423) | (2,397 ; 1,742 ; 3,423) |
| Recentrer après orbite | (2,397 ; 1,742 ; 3,423) | (2,397 ; 1,742 ; 3,423) |
| Dos | (−1,405 ; 1,258 ; −3,861) | (−1,405 ; 1,258 ; −3,861) |

### Artwork périmé

Textures affichées comparées à une construction fraîche du design courant et du précédent (pixels fortement
différents) : texte 0 / 489, couleur 0 / 286 491, illustration 0 / 6 247. **Toujours le design courant.**

### Non-régression visuelle

35 captures 3D-A comparées à 3D-B (`after/`) : écart moyen ≤ 0,022 / 255 par canal, 0 % de pixels fortement
différents, 0–2,6 % de pixels à ±1 (grain papier aléatoire de l'artwork). Mêmes cadrages, mêmes images.

## Reproduire

```bash
npm run dev
node --experimental-websocket scripts/bench-3d.mjs --suite 3db --tag after --out docs/phase3/3d-b
node --experimental-websocket scripts/bench-3d.mjs --out docs/phase3/3d-b/after --label "PHASE 3D-B — AFTER"
```

`metrics-3db-before.json` a été produit avec le même banc sur le viewer 3D-A (avant modification).

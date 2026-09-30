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

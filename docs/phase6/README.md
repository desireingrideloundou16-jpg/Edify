# PI-6 — Master Design Intent in production (shadow mode)

The Master Design Intent (contract **PI-5.0**, unchanged) now runs in the real `/api/design` flow, in
shadow mode. It observes; it does not design. Its only operational output is the export shot.

```
POST /api/design
  ├─ existing pipeline ─→ spec (unchanged, byte for byte) ─→ client applySpec ─→ 2D / viewer
  └─ shadowMasterDesignIntent (once) ─→ validateMasterDesignIntent
        ├─ log MASTER_DESIGN_INTENT_SHADOW (decisions, codes, counts — no brief, no user text)
        └─ response.intent = { version: "PI-5.0", shotStyle }   (optional, isolated field)
client export (EdifyWorkspace.handleDownloadZip)
  └─ renderExportPreview(shape, spec, design, { shot: { style: shotStyle } })
        → resolveExportShot → resolveShot → renderHD   (3D-D path; heroPremium when no style)
```

## Rules

- Built **once per generation, server-side** (`src/lib/intelligence/intent/production.ts`); the client only
  transports the decided style (kept with the project, `SavedProject.exportShot`), it never builds an intent.
- **Never throws**: an unexpected failure is logged (`generated: false, failure`) and the product goes on.
- **Export shot rule** (observe first): the style is handed to the export only when the intent is valid, its
  shot resolved to a canonical `SHOT_STYLES` id, at confidence `medium` or `high`. Otherwise (no intent,
  invalid, unresolved, unspecified, low confidence) the export keeps its `heroPremium` default. The log says
  why (`exportShotReason`).
- The design (spec) is identical with or without the intent; nothing in the 2D, the viewer, the PDF, the
  GLB or the ZIP layout changes.

## Switches

| Variable | Effect |
|---|---|
| `EDIFY_INTENT_SHADOW=off` | The intent is not built (no log, no `intent` field, export heroPremium). |
| `EDIFY_INTENT_EXPORT_SHOT=off` | Built and logged, but no style handed to the export. |
| `EDIFY_REFERENCE_SHADOW=off` | PI-4 references disabled inside the intent too (`referenceMode: "disabled"`). |

## Evidence

- `tests/unit/intent-production.test.ts` (adapter, real route with mocked I/O, export propagation to
  `renderHD`, design invariance, no user text in logs, fail-safe).
- `docs/phase6/visual/`: real export renders (`renderExportPreview({ shot })`, 7 families × 5 styles,
  2048 px transparent); `heroPremium` and `catalogEcommerce` silhouettes identical (IoU 1) to 3D-D's.
- Cost: intent ≈ 2 ms per generation (median), route +2 ms (median, provider mocked).

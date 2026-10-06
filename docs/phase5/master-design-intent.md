# PI-5 — Master Design Intent

**Contract:** `MasterDesignIntent`, version `PI-5.0` — `src/lib/intelligence/intent/`.

## Goal

Answer one question, as structured data: *which coherent visual direction must this product follow?*
The intent is the central visual decision of Edify. It is **not** a renderer, a camera, a layout engine,
an image generator or a structure resolver: it hands a canonical shot style to `resolveShot()` and
directions to the (future) 2D engine. The text brief is derived from it, never the source of truth.

```
brief + explicit intent
  → PI-1 product intelligence → PI-2 design grammar → PI-3 category knowledge → PI-4 evidence
  → packaging resolver (read-only)
  → MasterDesignIntent ─┬→ 2D directions (hierarchy, density, composition, type, colour, imagery, avoid)
                        ├→ shotIntent.style → resolveShot({ style }) → renderHD()
                        └→ toDesignBrief() (derived text)
```

## Input (`MasterDesignIntentInput`)

`brief` (free text, never copied to the output), `content` (the designer's `CurrentDesign` fields the user
gave), `styles` (explicit style words), `directives` (PI-2 `DesignDirectives`), `brandTraits`, `claims`
(`substantiated` when the brand holds the proof), `prohibitedClaims`, `marketCountries` (the only source of
jurisdiction), `shapeId` (packaging already decided), `shot` (`purpose` or `style`), `references`
(`"active"` | `"disabled"`).

## Output (main fields)

| Field | Content |
|---|---|
| `product`, `brand` | Explicit facts or `"unknown"` (never invented); positioning explicit vs inferred; market and jurisdictions. |
| `packaging` | The decided structure (resolver authority), dimensions, material, what the resolver recognised (phrase specificity). |
| `visual` | Territory, style, mood, sophistication, visual density, colour / typography / imagery / composition directions — all from PI-2, no RGB, no font file. |
| `hierarchy` | Primary / secondary / tertiary / supporting engine roles (`ElementRole`), with the user's content or `"notProvided"`. |
| `shotIntent` | Purpose + canonical `SHOT_STYLES` id, or `unresolved` / `unspecified`. |
| `references` | Mode, active evidence (verified, in scope), influences, rejected references with the reason. |
| `claims` | Product claims (explicit / validated / uncertain / prohibited) and PI-3 knowledge with PI-4 status. |
| `constraints` | Structural, mandatory, regulatory (indicative, with disclaimer), prohibited. |
| `negativeDirections` | Contextual pitfalls and avoidances (PI-2, PI-3). |
| `conflicts` | Values, winner, suppressed signal, attenuation, priority, reason. |
| `confidence`, `provenance`, `dataNeeds`, `rationale` | PI-1 confidence levels; PI-1 provenance records; what is missing; short reasons. |

Every decision is an `IntentValue`: **value, status, source, priority, confidence, rationale, refs**.

## Priority model

`hardConstraint > userRequirement > mandatoryProductInfo > validatedClaim > packagingStructure >
referenceIntelligence > brandIdentity > positioning > audience > creativeInference`. A lower source never
overrides a higher one. Statuses: `explicit`, `validated` (substantiated user claim only), `supported`
(verified, in-scope reference), `inferred`, `uncertain` (pending / out of scope / outdated / sensitive
claim without proof), `conflicted`, `prohibited`. *Inferred never becomes validated; a reference supports
knowledge, it never validates it.*

## Conflicts

- Explicit vs inferred positioning: the explicit side wins, the other stays an attenuated influence
  (PI-2's named resolution, e.g. premium + playful → refined playful).
- Two explicit requests of equal priority (minimal + maximalist): the more restrained value is kept — it
  preserves the legibility of mandatory information. Same rule in normalisation and in PI-2's ties.
- A category convention suspended by an explicit request (PI-3 `overriddenByUser`) is recorded.
- The decided structure beats the product's usual packaging family.

## Reuse (no parallel system)

PI-1 vocabularies and provenance; PI-2 lexicon (`designDirectivesFromBrief`) for normalisation and the
grammar for every visual decision; phrase specificity through `resolvePackaging`; PI-3 knowledge; PI-4
evidence; `CurrentDesign` for content; `ElementRole` for hierarchy; `SHOT_STYLES` / `resolveShot` for
shots (unchanged). PI-5 adds only its contract, priorities, statuses, visual density, sophistication and
shot purposes.

## Shot integration

`shotIntent.style` is a `SHOT_STYLES` id or `null`. Case and separators are normalised
(`catalog-ecommerce` → `catalogEcommerce`); anything else (`catalogue`, `ecommerceCatalog`) stays
`unresolved`. Purposes: hero/presentation → `heroPremium` (`dramaticHero` for bold territories),
ecommerce/catalog → `catalogEcommerce`, detail → `closeUpDetail`, lifestyle → `naturalLifestyle`; social and
technical have no existing style and stay unresolved. `shotRequestFromIntent(intent)` gives
`resolveShot` only a resolved canonical style; otherwise `resolveShot` keeps its own default.

## Validation (`validateMasterDesignIntent`)

Errors: `VERSION_MISSING`, `PRODUCT_MISSING`, `STRUCTURE_UNSUPPORTED`, `UNRESOLVED_CONFLICT`,
`PROHIBITED_CLAIM_ACTIVE`, `UNVERIFIED_AS_VALIDATED`, `DISABLED_REFERENCE_USED`, `SHOT_STYLE_UNKNOWN`,
`MANDATORY_INFO_MISSING`, `HIERARCHY_DUPLICATE`, `HIERARCHY_EMPTY`, `PROVENANCE_MISSING`,
`CONFIDENCE_INCOHERENT`, `NOT_NORMALIZED`. Warnings: product / brand name or personality not provided,
market unknown, unrecognised styles, packaging undecided (the resolver asks the user), shot unresolved,
references disabled, conflicting evidence.

## Tests

`tests/unit/master-design-intent.test.ts`: the 12 unit cases, explicit decisions and sources, and the
integration PI-3 → PI-4 → PI-5 → shotIntent → `resolveShot()` plus the 3D compatibility check (no camera,
renderer, viewer, material or model touched).

## Limitations

- Not wired into production yet: no design, layout, 2D, 3D or export reads the intent (next phase).
- Only five shot styles exist: social and technical purposes cannot resolve.
- Territory is often `unknown` for products whose signals match no named territory.
- The sensitive-claim detector is a short keyword list; it flags, it never validates.
- References disabled is an input flag (`references: "disabled"`); the caller maps its environment to it.

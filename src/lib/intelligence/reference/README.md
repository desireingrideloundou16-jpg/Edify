# PI-4 — Reference Intelligence

The evidence layer of Edify Packaging Intelligence. PI-3 says what a category knows; PI-4 says **why
Edify knows it, where it holds, and how sure it is**. It is local, versioned
(`REFERENCE_DATASET_VERSION`), deterministic and read-only: nothing in production depends on it.

```
PI-1 Product → PI-2 Grammar → PI-3 Category knowledge ← PI-4 references / claims / evidence
```

## Three objects

| Object | Meaning | File |
|---|---|---|
| **Reference** | A source: title, publisher, *source family*, type, jurisdiction, scope, status, how it was verified. | `sources.ts` |
| **Claim** | What a reference says, in a short summary of our own, about one PI-3 knowledge id (or a whole category), with its type, relation (supports / partially supports / contextualizes / contradicts), jurisdiction, evidence kind and validity period. | `claims.ts` |
| **Evidence** | What the claims establish for a piece of knowledge **in a context** (market jurisdictions, product category, date). | `evidence.ts` |

A reference supports many claims; a piece of knowledge collects many claims. PI-3 is not changed: claims
point to its existing ids.

## How a source is validated

- `verified` only when an **official page of the publisher was actually read** (`verification.method =
  "officialPageRead"`, with its date). Only verified references count as evidence.
- A URL is stored only if that exact page was read. Unknown author, date or revision stay `undefined`.
- Sources that could not be read (blocked domain, unreadable page, secondary summary only) are kept as
  `pendingVerification`: they document what remains to check and are never presented as certain.

## Evidence rules (`getEvidenceForKnowledge`)

- Per claim: quality of the source **for that claim type** (a regulation is strong for a labelling
  requirement, weak for aesthetics), capped by the evidence kind (a secondary summary is at most
  "medium"), the scope (in scope / international reference / unconfirmed market) and the relation.
- `corroborated` needs two independent **source families** (FAO, WHO and the Codex are one family). The
  number of sources alone never makes a claim true. A claim whose jurisdiction is unconfirmed is
  reported but never corroborates.
- `conflicting` only when two verified sources contradict each other in the same scope and period; an
  apparent contradiction across jurisdictions or periods is recorded as such, not as a conflict.
- Otherwise: `supported`, `singleSource`, `outOfScope`, `outdated`, `pending`, `unsupported`.
- Maturity is derived (`inferred`, `internal`, `observed`, `supported`, `stronglySupported`).
- `dataNeeds` say what is missing (`missingJurisdiction`, `missingRegulatoryContext`, `pendingVerification`,
  `insufficientEvidence`…): Edify prefers "insufficient information" to an invention.
- Regulatory evidence carries a disclaimer: the source *indicates*; Edify never guarantees compliance.

Jurisdictions come only from an explicit market country (PI-1 `marketCountry`), never from a region or a
culture.

## Adding a source

1. Read the publisher's official page; note the date.
2. Add a `Reference` (stable id `ref.<publisher>.<name>`, `sourceFamily`, jurisdiction, scope); leave
   anything you could not confirm `undefined`.
3. Add short `ReferenceClaim`s that point to existing PI-3 ids, with the claim type and jurisdiction the
   source really covers. No long quotation.
4. `datasetIssues()` must stay empty (tests enforce it: vocabularies, duplicates, unread URLs, PI-3 ids).

## Shadow mode

`shadowReferenceEvidence(brief)` logs `REFERENCE_SHADOW` from `/api/design` (evidence status of the PI-3
knowledge that applies, no brief). Disable with `EDIFY_REFERENCE_SHADOW=off`.

## Limits (dataset 2026-10-06)

Four references verified (Codex CXS 1-1985 identity and 2024 revision, FAO, WHO, EU Your Europe food
labelling). Five pending: Regulation (EU) 1169/2011 text, UN GHS, Regulation (EC) 1223/2009,
Directive 2002/46/EC, Cameroonian standard NC 04:2000-20. No market, retailer, benchmark, academic or
expert source yet: category conventions remain internal knowledge.

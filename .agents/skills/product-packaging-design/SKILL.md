---
name: product-packaging-design
description: "Design physical product packaging concepts and production briefs. Use for packaging structure, dielines, labels, materials, print finishes, product variants, packaging mockups, or packaging workflows in Edify."
---

# Product Packaging Design

Create packaging that balances brand recognition, shelf communication, product protection, usability, manufacturing constraints, and end-of-life considerations. Separate visual concept work from production engineering.

## Gather the Brief

Use information already present in the conversation or project. Ask only for missing details that materially affect the design:

- Product contents, dimensions, weight, fragility, and required protection.
- Primary and secondary packaging, distribution channel, shipping needs, and opening experience.
- Audience, brand identity, positioning, product variants, and competitive context.
- Target markets, required language, regulated claims, mandatory copy, and certification evidence.
- Material preferences, sustainability constraints, expected quantities, budget tier, and supplier capabilities.

Do not invent product facts, legal declarations, certifications, or safety claims. Mark unknowns as open questions.

## Develop the Concept

1. Recommend a structure and explain how it protects, stores, ships, opens, and presents the product.
2. Define the visual direction using the brand's existing identity or a small, coherent proposed system of colors, typography, graphics, and finishes.
3. Specify information hierarchy by face: brand, product, primary benefit, quantity, instructions, ingredients or contents, warnings, traceability, and disposal information as applicable.
4. For product families, state which elements remain consistent and how variants are distinguished.
5. Describe a mockup or image-generation prompt as a concept visualization; do not present it as a production dieline.

## Production Brief

State units and distinguish confirmed inputs from estimates. Include, when known:

- Package type, internal and external dimensions, closure, inserts, and component materials.
- Substrate, thickness or grammage, finish, coatings, and joining method, each marked for supplier confirmation where appropriate.
- Artwork surfaces, panel hierarchy, barcode area, safe area, bleed, cut paths, folds, and any special finishing layer.
- Required artwork format, color profile or spot colors, print process, and proofing needs supplied or confirmed by the printer.
- Structural and usability checks: fit, protection, opening, transport, legibility, accessibility, recyclability, and SKU consistency.

Never invent a manufacturer's dieline, cut/fold geometry, press tolerances, material performance, or regulatory compliance. Request the supplier's current dieline and specifications, and identify when a packaging engineer, printer, or regulatory specialist must approve the result.

## Edify Implementation

When changing this repository, inspect existing packaging types, shape presets, dimensions, and export functions first. Reuse the established data model and units. Keep the distinction between the 2D dieline, 3D mockup, and production artwork explicit; a successful SVG/PDF export is not by itself proof of manufacturing readiness.
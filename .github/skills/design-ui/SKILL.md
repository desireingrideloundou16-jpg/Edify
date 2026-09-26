---
name: design-ui
description: "Concevoir et améliorer des interfaces web. À utiliser pour le design UI, les layouts, la typographie, les couleurs, l’accessibilité et le responsive."
---

# Design UI

Use this skill when designing, implementing, or reviewing Edify's workspace, dashboard, studio, or packaging-related interface.

## Workflow

1. Identify the user's main task and the information or action they need first.
2. Inspect the existing component, styles, and nearby interaction before changing the UI. Preserve established patterns unless the request calls for a deliberate redesign.
3. Make visual decisions that fit packaging design: materials, print workflows, dielines, brand identity, and production constraints. Avoid generic SaaS decoration.
4. Keep controls functional and use the existing component, icon, and styling conventions. Maintain keyboard access, visible focus, readable contrast, and reduced-motion support.
5. Check the result at desktop and narrow mobile widths. Verify that panels, labels, controls, and canvas content do not overlap or become unreachable.

## Edify Constraints

- Keep the workspace's existing 2D/3D editing, upload, generation, and export behaviors intact when changing presentation.
- Reuse types and domain data in `src/types/packaging.ts`, `src/components/workspace/Modals.tsx`, and `src/lib/export/`; do not invent production dimensions or printing claims.
- Treat generated mockups as visual concepts, not certified manufacturing artwork. Flag measurements, legal copy, material suitability, tolerances, and color profiles for supplier or specialist verification.
- Prefer small, local changes that fit the current Next.js and Tailwind codebase.

## Validation

- Run `npx tsc --noEmit` after React or TypeScript changes.
- When changing a visible workspace, inspect desktop and mobile browser screenshots and test the affected interaction.
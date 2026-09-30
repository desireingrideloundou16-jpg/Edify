import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", ".next-test/**", "node_modules/**", "ai-engine/**", "public/**", "next-env.d.ts", ".agents/**", ".claude/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Pre-existing plain <a href="/"> links (full reload to the home page, not a bug).
      // Kept as warnings until the UI refactor phase converts them to next/link.
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

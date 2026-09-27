import type { Metadata } from "next";
import { Suspense } from "react";
import { EdifyWorkspace } from "@/components/workspace/EdifyWorkspace";

export const metadata: Metadata = {
  title: "Studio",
  description: "Concevez votre packaging avec l'IA : forme, design, textes, aperçu 3D et PDF prêt à imprimer.",
  robots: { index: false },
};

export default function CreatePage() {
  return (
    <Suspense>
      <EdifyWorkspace />
    </Suspense>
  );
}

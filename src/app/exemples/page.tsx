import type { Metadata } from "next";
import { ExamplesGallery } from "@/components/landing/ExamplesGallery";

export const metadata: Metadata = {
  title: "Exemples de packagings conçus par l'IA",
  description: "17 briefs d'entrepreneurs et les packagings livrés par Edify : design sur mesure, maquette 3D et image publicitaire, prêts à imprimer.",
  alternates: { canonical: "/exemples" },
};

export default function ExamplesPage() {
  return <ExamplesGallery />;
}

import type { Metadata } from "next";
import { StartWizard } from "@/components/start/StartWizard";
import { getLang } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  return getLang() === "fr"
    ? { title: "Commencez votre packaging", description: "Répondez à quelques questions : l'IA d'Edify conçoit votre packaging complet." }
    : { title: "Start your packaging", description: "Answer a few questions: Edify's AI designs your complete packaging." };
}

export default function Page() {
  return <StartWizard />;
}

import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Créer un compte", description: "Inscrivez-vous gratuitement sur Edify et concevez votre packaging avec l'IA." };

export default function Page() {
  return <AuthShell mode="signup" />;
}

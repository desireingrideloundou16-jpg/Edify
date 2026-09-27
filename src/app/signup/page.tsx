import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Créer un compte", description: "Créez votre compte Edify et concevez votre packaging avec l'IA." };

export default function Page() {
  return <AuthShell mode="signup" />;
}

import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default function Page() {
  return <AuthShell mode="login" />;
}

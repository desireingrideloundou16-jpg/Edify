import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Décrivez votre produit, l'IA d'Edify conçoit son packaging : forme, design, textes, maquette 3D et PDF prêt à imprimer, en quelques minutes et sans graphiste.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Edify — Créez votre packaging avec l'IA en quelques minutes",
    template: "%s · Edify",
  },
  description: DESCRIPTION,
  applicationName: "Edify",
  keywords: [
    "packaging IA",
    "créer un packaging",
    "design d'emballage",
    "étiquette produit",
    "maquette 3D packaging",
    "PDF prêt à imprimer",
    "générateur de packaging",
    "Edify",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Edify — Votre packaging conçu par l'IA",
    description: DESCRIPTION,
    type: "website",
    locale: "fr_FR",
    siteName: "Edify",
  },
  twitter: { card: "summary_large_image", title: "Edify — Votre packaging conçu par l'IA", description: DESCRIPTION },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-white text-slate-900 font-sans antialiased selection:bg-purple-100 selection:text-purple-900">
        {children}
      </body>
    </html>
  );
}

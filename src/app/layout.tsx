import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edify Studio — Packaging Design & Mockup 3D IA",
  description:
    "Créez, prévisualisez et exportez vos packagings en format Print-Ready CMJN avec des mockups 3D ultra-réalistes générés par IA.",
  keywords: [
    "packaging design",
    "mockup 3D",
    "CMJN",
    "print-ready",
    "dépouille",
    "étiquette",
    "dieline",
    "IA créative",
  ],
  authors: [{ name: "Edify Studio" }],
  openGraph: {
    title: "Edify Studio — Packaging Design & Mockup 3D IA",
    description: "SaaS de packaging design print-ready avec aperçu 3D en temps réel",
    type: "website",
  },
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
      <body className="bg-white text-slate-900 font-sans antialiased selection:bg-purple-100 selection:text-purple-900 overflow-hidden">
        {children}
      </body>
    </html>
  );
}

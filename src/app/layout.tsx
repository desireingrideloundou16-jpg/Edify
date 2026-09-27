import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n/server";
import { LangProvider } from "@/components/i18n/LangProvider";
import { THEME_BOOT } from "@/lib/theme";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const META = {
  fr: {
    title: "Edify — Créez votre packaging avec l'IA en quelques minutes",
    short: "Edify — Votre packaging conçu par l'IA",
    description:
      "Répondez à quelques questions, l'IA d'Edify conçoit votre packaging : forme, design, mentions obligatoires FR/EN, maquette 3D et PDF prêt à imprimer. Paiement Mobile Money.",
    keywords: ["packaging IA", "créer un packaging", "étiquette produit Cameroun", "design d'emballage", "maquette 3D packaging", "PDF prêt à imprimer", "Edify"],
    locale: "fr_CM",
  },
  en: {
    title: "Edify — Design your packaging with AI in minutes",
    short: "Edify — Your packaging, designed by AI",
    description:
      "Answer a few questions and Edify's AI designs your packaging: shape, artwork, bilingual FR/EN label information, 3D mockup and print-ready PDF. Pay with Mobile Money.",
    keywords: ["AI packaging", "packaging design", "product label Cameroon", "packaging mockup 3D", "print-ready PDF", "Edify"],
    locale: "en_CM",
  },
};

export function generateMetadata(): Metadata {
  const m = META[getLang()];
  return {
    metadataBase: new URL(SITE),
    title: { default: m.title, template: "%s · Edify" },
    description: m.description,
    applicationName: "Edify",
    keywords: m.keywords,
    alternates: { canonical: "/" },
    openGraph: { title: m.short, description: m.description, type: "website", locale: m.locale, siteName: "Edify" },
    twitter: { card: "summary_large_image", title: m.short, description: m.description },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* Theme before first paint (system by default, or the visitor's choice). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Self-hosted fonts: preload the two faces used above the fold. */}
        <link rel="preload" href="/fonts/syne-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/dm-sans-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="bg-white text-slate-900 font-sans antialiased selection:bg-purple-100 selection:text-purple-900">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}

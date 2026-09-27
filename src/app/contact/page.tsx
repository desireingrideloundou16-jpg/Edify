import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";
import { ContactForm } from "@/components/landing/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Une question sur Edify, une démonstration ou une offre entreprise ? Écrivez-nous." };

export default function ContactPage() {
  return (
    <SitePage title="Contactez-nous" intro="Une question, une démonstration pour votre équipe ou une offre sur mesure ? Laissez-nous un message.">
      <ContactForm />
    </SitePage>
  );
}

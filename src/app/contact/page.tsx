import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { SitePage } from "@/components/landing/SiteChrome";
import { ContactForm } from "@/components/landing/ContactForm";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Contact", description: "Une question sur Edify, une démonstration ou une offre entreprise ? Écrivez-nous." };

export default function ContactPage() {
  return (
    <SitePage title="Contactez-nous" intro="Une question, une démonstration pour votre équipe ou une offre sur mesure ? Laissez-nous un message, ou écrivez-nous directement sur WhatsApp.">
      <p className="lp-contact-whatsapp">
        <a href={LEGAL.whatsappUrl} target="_blank" rel="noreferrer" className="lp-btn lp-btn-ink">
          <MessageCircle className="w-4 h-4" /> WhatsApp : {LEGAL.phone}
        </a>
        <span>Réponse en général dans la journée, du lundi au samedi.</span>
      </p>
      <ContactForm />
    </SitePage>
  );
}

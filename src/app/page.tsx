import { LandingPage } from "@/components/landing/LandingPage";
import { getLang } from "@/lib/i18n/server";

export default async function HomePage() {
  return <LandingPage lang={await getLang()} />;
}

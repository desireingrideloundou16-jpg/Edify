import { LandingPage } from "@/components/landing/LandingPage";
import { getLang } from "@/lib/i18n/server";

export default function HomePage() {
  return <LandingPage lang={getLang()} />;
}

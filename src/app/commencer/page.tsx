import type { Metadata } from "next";
import { StartWizard } from "@/components/start/StartWizard";
import { serverCopy } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  const m = serverCopy("meta");
  return { title: m.start, description: m.startDescription };
}

export default function Page() {
  return <StartWizard />;
}

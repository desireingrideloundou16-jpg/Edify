import type { Metadata } from "next";
import { PaymentReturn } from "@/components/billing/PaymentReturn";

export const metadata: Metadata = { title: "Paiement", robots: { index: false } };

export default async function Page({ searchParams: searchParamsPromise }: { searchParams: Promise<{ p?: string }> }) {
  const searchParams = await searchParamsPromise;
  return <PaymentReturn paymentId={searchParams.p ?? ""} />;
}

import type { Metadata } from "next";
import { PaymentReturn } from "@/components/billing/PaymentReturn";

export const metadata: Metadata = { title: "Paiement", robots: { index: false } };

export default function Page({ searchParams }: { searchParams: { p?: string } }) {
  return <PaymentReturn paymentId={searchParams.p ?? ""} />;
}

import type { Metadata } from "next";
import { BillingPage } from "@/components/billing/BillingPage";
import { isPlan } from "@/lib/billing/plans";
import { serverCopy } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  return { title: serverCopy("meta").plans, robots: { index: false } };
}

export default function Page({ searchParams }: { searchParams: { plan?: string } }) {
  return <BillingPage initialPlan={isPlan(searchParams.plan) ? searchParams.plan : "pro"} />;
}

import type { Metadata } from "next";
import { BillingPage } from "@/components/billing/BillingPage";
import { isPlan } from "@/lib/billing/plans";
import { serverCopy } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverCopy("meta")).plans, robots: { index: false } };
}

export default async function Page({ searchParams: searchParamsPromise }: { searchParams: Promise<{ plan?: string }> }) {
  const searchParams = await searchParamsPromise;
  return <BillingPage initialPlan={isPlan(searchParams.plan) ? searchParams.plan : "pro"} />;
}

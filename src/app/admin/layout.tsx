import type { Metadata } from "next";
import { getAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin Edify" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) {
    return (
      <div className="lp ad-denied">
        <a href="/" className="lp-logo">
          <span className="lp-logo-badge">E</span>
          <span>Edify</span>
        </a>
        <h1>Accès réservé aux administrateurs</h1>
        <p>Ce compte n&apos;a pas les droits d&apos;administration.</p>
        <a href="/create" className="lp-btn lp-btn-ink">Retour au studio</a>
      </div>
    );
  }
  const { count } = await createAdminClient().from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new");
  return (
    <AdminShell admin={admin} newMessages={count ?? 0}>
      {children}
    </AdminShell>
  );
}

// Server-only: the signed-in user if (and only if) their profile has role = 'admin'.
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
}

/** Memoised per request: pages and the data layer can all check without extra queries. */
export const getAdmin = cache(async function getAdmin(): Promise<AdminUser | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  const { data } = await createAdminClient().from("profiles").select("role, full_name, suspended").eq("id", user.id).single();
  if (data?.role !== "admin" || data.suspended) return null;
  return { id: user.id, email: user.email ?? null, name: data.full_name ?? null };
});

/**
 * Admin pages: a layout check alone is NOT enough (the page still runs and its data is sent,
 * and RSC navigations skip layouts). Every admin page calls this first.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** Admin data layer: refuses to read anything outside an admin request (defence in depth). */
export async function assertAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new Error("forbidden");
  return admin;
}

/** For admin API routes: the admin, or a ready-made 403 response. */
export async function requireAdmin(): Promise<AdminUser | Response> {
  const admin = await getAdmin();
  return admin ?? Response.json({ error: "forbidden" }, { status: 403 });
}

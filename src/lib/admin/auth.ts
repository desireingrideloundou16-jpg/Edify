// Server-only: the signed-in user if (and only if) their profile has role = 'admin'.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
}

export async function getAdmin(): Promise<AdminUser | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  const { data } = await createAdminClient().from("profiles").select("role, full_name, suspended").eq("id", user.id).single();
  if (data?.role !== "admin" || data.suspended) return null;
  return { id: user.id, email: user.email ?? null, name: data.full_name ?? null };
}

/** For admin API routes: the admin, or a ready-made 403 response. */
export async function requireAdmin(): Promise<AdminUser | Response> {
  const admin = await getAdmin();
  return admin ?? Response.json({ error: "forbidden" }, { status: 403 });
}

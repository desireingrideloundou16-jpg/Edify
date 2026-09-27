// Server-only usage and audit logs (never block the user if logging fails).
import { createAdminClient } from "@/lib/supabase/admin";

export async function logAiEvent(userId: string | null, kind: "design" | "suggest" | "image", engine: string, success = true) {
  try {
    await createAdminClient().from("ai_events").insert({ user_id: userId, kind, engine, success });
  } catch {
    // logging is best-effort
  }
}

export async function audit(admin: { id: string; email?: string | null }, action: string, target: string | null, details: Record<string, unknown> = {}) {
  try {
    await createAdminClient().from("admin_audit").insert({ admin_id: admin.id, admin_email: admin.email ?? null, action, target, details });
  } catch {
    // logging is best-effort
  }
}

import React from "react";
import { createClient } from "@/lib/supabase/server";

/** Site-wide banner written from the admin board (Paramètres). Server component. */
export async function AnnouncementBar() {
  try {
    const { data } = await createClient().from("app_settings").select("value").eq("key", "announcement").maybeSingle();
    const a = data?.value as { enabled?: boolean; text?: string; link?: string; tone?: string } | undefined;
    if (!a?.enabled || !a.text) return null;
    return (
      <div className={`lp-announce is-${a.tone ?? "info"}`} role="note">
        {a.link ? <a href={a.link}>{a.text}</a> : <span>{a.text}</span>}
      </div>
    );
  } catch {
    return null;
  }
}

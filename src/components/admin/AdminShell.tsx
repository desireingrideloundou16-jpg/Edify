"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, ExternalLink, FolderOpen, LayoutDashboard, LogOut, Mail, Menu, ScrollText, Settings, Sparkles, Users, X } from "lucide-react";
import { ThemeToggle } from "@/components/i18n/SiteToggles";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/paiements", label: "Paiements", icon: CreditCard },
  { href: "/admin/projets", label: "Projets", icon: FolderOpen },
  { href: "/admin/messages", label: "Messages", icon: Mail, badge: "messages" },
  { href: "/admin/ia", label: "Intelligence artificielle", icon: Sparkles },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
  { href: "/admin/journal", label: "Journal d'activité", icon: ScrollText },
] as const;

export function AdminShell({ admin, newMessages, children }: { admin: { email: string | null; name: string | null }; newMessages: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="lp ad">
      <aside className={`ad-side ${open ? "is-open" : ""}`}>
        <div className="ad-side-top">
          <Link href="/admin" className="lp-logo">
            <span className="lp-logo-badge">E</span>
            <span>Edify</span>
          </Link>
          <span className="ad-tag">Admin</span>
          <button type="button" className="ad-close" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="ad-nav" aria-label="Administration">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={isActive(n.href) ? "is-active" : ""} aria-current={isActive(n.href) ? "page" : undefined}>
              <n.icon className="w-[18px] h-[18px]" />
              <span>{n.label}</span>
              {"badge" in n && newMessages > 0 && <em>{newMessages}</em>}
            </Link>
          ))}
        </nav>
        <div className="ad-side-foot">
          <a href="/" target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /> Voir le site</a>
          <a href="/create"><Sparkles className="w-4 h-4" /> Ouvrir le studio</a>
          <form action="/auth/signout" method="post">
            <button type="submit"><LogOut className="w-4 h-4" /> Se déconnecter</button>
          </form>
        </div>
      </aside>
      {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}

      <div className="ad-main">
        <header className="ad-top">
          <button type="button" className="ad-burger" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="ad-top-right">
            <ThemeToggle />
            <span className="ad-me">
              <i>{(admin.name || admin.email || "A").charAt(0).toUpperCase()}</i>
              <span>
                <strong>{admin.name || "Administrateur"}</strong>
                <small>{admin.email}</small>
              </span>
            </span>
          </div>
        </header>
        <main className="ad-content">{children}</main>
      </div>
    </div>
  );
}

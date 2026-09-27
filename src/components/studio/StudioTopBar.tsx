"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileDown, Megaphone, Archive, Smartphone, Link2, Loader2, LogOut, Sparkles, Pencil, CreditCard, LayoutDashboard, FolderOpen, Package, Plus } from "lucide-react";
import { ThemeToggle } from "@/components/i18n/SiteToggles";

export type ExportAction = "pdf" | "ad" | "zip" | "ar" | "share";

interface StudioTopBarProps {
  projectName: string;
  onRename: (name: string) => void;
  saveState: "idle" | "saving" | "saved" | "error";
  credits: number | null;
  onCredits: () => void;
  account: { name: string; email: string; avatar: string | null; isAdmin?: boolean } | null;
  busy: ExportAction | null;
  onExport: (a: ExportAction) => void;
  /** The user's packagings (projects), newest first. */
  projects: { id: string; name: string; updated_at: string; counted: boolean }[];
  currentProjectId: string | null;
  onOpenProject: (id: string) => void;
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const EXPORTS: { id: ExportAction; icon: React.ElementType; label: string; hint: string }[] = [
  { id: "pdf", icon: FileDown, label: "PDF pour l'imprimeur", hint: "Fonds perdus, traits de coupe, tracé de découpe" },
  { id: "ad", icon: Megaphone, label: "Image publicitaire", hint: "Votre produit mis en scène, formats réseaux sociaux" },
  { id: "zip", icon: Archive, label: "Tout le projet (.zip)", hint: "PDF, aperçu 3D, modèle 3D et fiche technique" },
  { id: "ar", icon: Smartphone, label: "Modèle 3D / réalité augmentée", hint: "Fichiers GLB et USDZ à taille réelle" },
  { id: "share", icon: Link2, label: "Copier le lien de partage", hint: "Le design s'ouvre tel quel chez la personne" },
];

export function StudioTopBar({ projectName, onRename, saveState, credits, onCredits, account, busy, onExport, projects, currentProjectId, onOpenProject }: StudioTopBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const [menu, setMenu] = useState<"export" | "account" | "projects" | null>(null);
  const projectsRef = useDismiss(menu === "projects", () => setMenu(null));
  const exportRef = useDismiss(menu === "export", () => setMenu(null));
  const accountRef = useDismiss(menu === "account", () => setMenu(null));

  const commit = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  const status =
    saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Non enregistré" : saveState === "saved" ? "Enregistré" : "";

  return (
    <header className="st-top">
      <a href="/" className="st-logo" title="Accueil Edify">
        <span className="edify-brand-badge">E</span>
        <span className="st-logo-text">Edify</span>
      </a>

      <div className="st-project">
        {editing ? (
          <input
            autoFocus
            className="st-project-input"
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Nom du projet"
          />
        ) : (
          <button
            type="button"
            className="st-project-name"
            onClick={() => {
              setDraft(projectName);
              setEditing(true);
            }}
            title="Renommer le projet"
          >
            <span className="truncate">{projectName || "Sans titre"}</span>
            <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        )}
        <div className="st-menu-wrap" ref={projectsRef}>
          <button type="button" className="st-projects-btn" aria-haspopup="menu" aria-expanded={menu === "projects"} onClick={() => setMenu(menu === "projects" ? null : "projects")} title="Mes packagings">
            <FolderOpen className="w-4 h-4" />
            <span>Mes packagings</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {menu === "projects" && (
            <div className="st-menu st-menu-projects" role="menu">
              <a href="/commencer" role="menuitem" className="st-menu-link st-menu-new">
                <span className="st-menu-icon"><Plus className="w-4 h-4" /></span>
                <span>
                  <strong>Nouveau packaging</strong>
                  <small>Répondez à quelques questions, l&apos;IA le conçoit</small>
                </span>
              </a>
              <div className="st-projects-list">
                {projects.length === 0 && <p className="st-projects-empty">Aucun packaging enregistré pour l&apos;instant.</p>}
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    className={p.id === currentProjectId ? "is-current" : ""}
                    onClick={() => {
                      setMenu(null);
                      onOpenProject(p.id);
                    }}
                  >
                    <span className="st-menu-icon"><Package className="w-4 h-4" /></span>
                    <span>
                      <strong>{p.name || "Sans titre"}</strong>
                      <small>
                        {new Date(p.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        {p.counted ? " · compté dans votre abonnement" : " · brouillon"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {status && (
          <span className={`st-save ${saveState}`} role="status">
            <span className="st-save-dot" /> {status}
          </span>
        )}
      </div>

      <div className="st-top-actions">
        <ThemeToggle className="st-theme" />
        <button type="button" className="st-credits" onClick={onCredits} title="Packagings restants dans votre abonnement">
          <Sparkles className="w-4 h-4" />
          {credits === null ? "…" : `${credits} packaging${credits > 1 ? "s" : ""}`}
        </button>

        <div className="st-menu-wrap" ref={exportRef}>
          <button type="button" className="st-download" aria-haspopup="menu" aria-expanded={menu === "export"} onClick={() => setMenu(menu === "export" ? null : "export")}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Télécharger</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {menu === "export" && (
            <div className="st-menu" role="menu">
              {EXPORTS.map(({ id, icon: Icon, label, hint }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  disabled={busy === id}
                  onClick={() => {
                    setMenu(null);
                    onExport(id);
                  }}
                >
                  <span className="st-menu-icon">{busy === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}</span>
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {account && (
          <div className="st-menu-wrap" ref={accountRef}>
            <button type="button" className="st-avatar" aria-haspopup="menu" aria-expanded={menu === "account"} onClick={() => setMenu(menu === "account" ? null : "account")} title={account.name}>
              {account.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{account.name.charAt(0).toUpperCase()}</span>
              )}
            </button>
            {menu === "account" && (
              <div className="st-menu st-menu-account" role="menu">
                <div className="st-account">
                  <strong>{account.name}</strong>
                  <small>{account.email}</small>
                </div>
                <a href="/abonnement" role="menuitem" className="st-menu-link">
                  <span className="st-menu-icon"><CreditCard className="w-4 h-4" /></span>
                  <span><strong>Mon abonnement</strong></span>
                </a>
                {account.isAdmin && (
                  <a href="/admin" role="menuitem" className="st-menu-link">
                    <span className="st-menu-icon"><LayoutDashboard className="w-4 h-4" /></span>
                    <span><strong>Administration</strong></span>
                  </a>
                )}
                <form action="/auth/signout" method="post">
                  <button type="submit" role="menuitem">
                    <span className="st-menu-icon"><LogOut className="w-4 h-4" /></span>
                    <span><strong>Se déconnecter</strong></span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileDown, Megaphone, Archive, Smartphone, Link2, Loader2, LogOut, Sparkles, Pencil } from "lucide-react";

export type ExportAction = "pdf" | "ad" | "zip" | "ar" | "share";

interface StudioTopBarProps {
  projectName: string;
  onRename: (name: string) => void;
  saveState: "idle" | "saving" | "saved" | "error";
  credits: number | null;
  onCredits: () => void;
  account: { name: string; email: string; avatar: string | null } | null;
  busy: ExportAction | null;
  onExport: (a: ExportAction) => void;
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

export function StudioTopBar({ projectName, onRename, saveState, credits, onCredits, account, busy, onExport }: StudioTopBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const [menu, setMenu] = useState<"export" | "account" | null>(null);
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
        {status && (
          <span className={`st-save ${saveState}`} role="status">
            <span className="st-save-dot" /> {status}
          </span>
        )}
      </div>

      <div className="st-top-actions">
        <button type="button" className="st-credits" onClick={onCredits} title="Crédits IA restants">
          <Sparkles className="w-4 h-4" />
          {credits === null ? "…" : `${credits} crédit${credits > 1 ? "s" : ""}`}
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

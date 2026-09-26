"use client";

import React, { useState } from "react";
import {
  Settings,
  Building2,
  Sliders,
  KeyRound,
  Users,
  ShieldCheck,
  Save,
  CheckCircle2,
  Printer,
  FileCode,
  Globe
} from "lucide-react";
import { Unit } from "@/types/packaging";

type SettingsTab = "profile" | "prepress" | "integrations" | "team";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile Form
  const [studioName, setStudioName] = useState("Atelier Packaging Studio");
  const [contactEmail, setContactEmail] = useState("contact@atelier-packaging.fr");
  const [siret, setSiret] = useState("849 203 104 00021");
  const [website, setWebsite] = useState("https://atelier-packaging.fr");

  // Prepress Preferences
  const [defaultUnit, setDefaultUnit] = useState<Unit>("mm");
  const [defaultBleed, setDefaultBleed] = useState<number>(3);
  const [defaultSafety, setDefaultSafety] = useState<number>(4);
  const [colorProfile, setColorProfile] = useState<string>("fogra39");
  const [exportStandard, setExportStandard] = useState<string>("pdf-x4");

  // API Integrations
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const [aiApiKey, setAiApiKey] = useState("sk-replicate-demo-packaging-key");
  const [webhookUrl, setWebhookUrl] = useState("https://api.imprimerie-partenaire.com/v1/webhook");

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = () => {
    setToast("✓ Vos préférences ont été enregistrées avec succès !");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-studio-950 text-slate-100 font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-2xl border border-brand-400/40 animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Header */}
      <div className="flex-shrink-0 border-b border-studio-800 bg-studio-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-studio-800 border border-studio-700 flex items-center justify-center text-brand-400">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Paramètres du Studio</h1>
            <p className="text-xs text-studio-500">Configuration de l'atelier, des tolérances prépresse et des clés d'accès</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/20 transition-all active:scale-95"
        >
          <Save className="w-3.5 h-3.5" />
          Enregistrer les modifications
        </button>
      </div>

      {/* Settings Navigation & Main Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sub-Nav */}
        <div className="w-64 border-r border-studio-800 bg-studio-900/30 p-4 space-y-1 flex-shrink-0">
          {[
            { id: "profile", label: "Profil & Studio", icon: Building2 },
            { id: "prepress", label: "Tolérances Prépresse & CAO", icon: Sliders },
            { id: "integrations", label: "Intégrations & Clés API", icon: KeyRound },
            { id: "team", label: "Gestion de l'Équipe", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-studio-800 text-white border border-studio-700 font-semibold shadow-sm"
                    : "text-studio-400 hover:text-slate-200 hover:bg-studio-850"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-brand-400" : "text-studio-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
          {/* TAB 1: Profile */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Identité de l'Atelier / Agence</h2>
                <p className="text-xs text-studio-400">Ces informations figurent sur vos cartouches techniques et fiches de spécification BAT.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nom de l'atelier</label>
                  <input
                    type="text"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email professionnel</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Numéro SIRET / TVA</label>
                  <input
                    type="text"
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Site Web</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Prepress Preferences */}
          {activeTab === "prepress" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Normes Prépresse & Cotation</h2>
                <p className="text-xs text-studio-400">Paramètres appliqués par défaut à tout nouveau projet ou gabarit de dépouille.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Unité de mesure</label>
                    <select
                      value={defaultUnit}
                      onChange={(e) => setDefaultUnit(e.target.value as Unit)}
                      className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="mm">Millimètres (mm)</option>
                      <option value="cm">Centimètres (cm)</option>
                      <option value="in">Pouces (in)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fond perdu par défaut (mm)</label>
                    <input
                      type="number"
                      value={defaultBleed}
                      onChange={(e) => setDefaultBleed(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Zone tranquille (mm)</label>
                    <input
                      type="number"
                      value={defaultSafety}
                      onChange={(e) => setDefaultSafety(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Profil colorimétrique CMJN par défaut</label>
                  <select
                    value={colorProfile}
                    onChange={(e) => setColorProfile(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="fogra39">ISO Coated v2 300% (ECI) / Fogra39 (Standard Européen)</option>
                    <option value="gracol2013">GRACoL 2013 Uncoated (Standard US)</option>
                    <option value="japanColor">Japan Color 2011 Coated (Standard Asie)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Norme d'exportation PDF</label>
                  <select
                    value={exportStandard}
                    onChange={(e) => setExportStandard(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="pdf-x4">PDF/X-4:2010 (Recommandé avec calques spot et transparence)</option>
                    <option value="pdf-x1a">PDF/X-1a:2001 (Aplatissement complet)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Integrations & APIs */}
          {activeTab === "integrations" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Clés API & Passerelles Imprimerie</h2>
                <p className="text-xs text-studio-400">Gérez vos connexions cloud et connecteurs de tables de découpe.</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-studio-900 border border-studio-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Stockage Cloud Supabase</div>
                      <div className="text-[11px] text-studio-400">Synchronisation des gabarits et historiques de versions</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Connecté
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Clé API Replicate / IA Packaging</label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Webhook de transmission Imprimeur</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                  <p className="mt-1 text-[10px] text-studio-500">
                    Déclenché automatiquement lors de l'export d'un BAT PDF ou DXF validé.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Team */}
          {activeTab === "team" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white mb-1">Membres de l'Équipe</h2>
                  <p className="text-xs text-studio-400">Collaborateurs ayant accès à vos gabarits et validations BAT.</p>
                </div>
                <button
                  onClick={() => handleSave()}
                  className="px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-slate-200 text-xs font-semibold border border-studio-700 transition-colors"
                >
                  + Inviter un membre
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { name: "Marie Dupont", role: "Directrice Artistique & Admin", email: "marie@atelier-packaging.fr", initials: "MD" },
                  { name: "Lucas Bernard", role: "Ingénieur Packaging CAO", email: "lucas@atelier-packaging.fr", initials: "LB" },
                  { name: "Opérateur Atelier", role: "Conducteur Table Zünd", email: "prepresse@atelier-packaging.fr", initials: "OA" },
                ].map((member) => (
                  <div key={member.email} className="p-3 rounded-xl bg-studio-900 border border-studio-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-300 border border-brand-500/30 flex items-center justify-center font-bold text-xs">
                        {member.initials}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{member.name}</div>
                        <div className="text-[10px] text-studio-500">{member.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-studio-800 text-studio-400 border border-studio-700">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

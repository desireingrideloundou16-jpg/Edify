"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<AuthMode, { title: string; sub: string; cta: string }> = {
  login: { title: "Bon retour sur Edify", sub: "Connectez-vous pour retrouver vos packagings.", cta: "Se connecter" },
  signup: { title: "Créez votre compte", sub: "10 crédits offerts pour concevoir vos premiers packagings.", cta: "Créer mon compte" },
  forgot: { title: "Mot de passe oublié", sub: "Indiquez votre e-mail, nous vous envoyons un lien pour en choisir un nouveau.", cta: "Envoyer le lien" },
  reset: { title: "Nouveau mot de passe", sub: "Choisissez un mot de passe d'au moins 8 caractères.", cta: "Enregistrer le mot de passe" },
};

function frenchError(message: string, code?: string) {
  const key = `${code ?? ""} ${message}`.toLowerCase();
  if (key.includes("invalid_credentials") || key.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (key.includes("email_not_confirmed") || key.includes("not confirmed")) return "Confirmez d'abord votre adresse : cliquez sur le lien reçu par e-mail.";
  if (key.includes("user_already_exists") || key.includes("already registered")) return "Un compte existe déjà avec cet e-mail. Connectez-vous plutôt.";
  if (key.includes("weak_password") || key.includes("at least")) return "Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.";
  if (key.includes("rate") && key.includes("limit")) return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  if (key.includes("same_password")) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (key.includes("network") || key.includes("fetch")) return "Connexion impossible. Vérifiez votre accès à Internet.";
  return message;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/create";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/create";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const copy = COPY[mode];

  const callback = (target: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  const onGoogle = async () => {
    setError(null);
    setBusy("google");
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next), queryParams: { prompt: "select_account" } },
    });
    if (err) {
      setError(frenchError(err.message, err.code));
      setBusy(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) return setError("Supabase n'est pas configuré (voir .env.local).");
    if ((mode === "signup" || mode === "reset") && password.length < 8) {
      return setError("Le mot de passe doit contenir au moins 8 caractères.");
    }
    setBusy("form");
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace(next);
        router.refresh();
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: callback(next) },
        });
        if (err) throw err;
        // Supabase returns a user without identities when the e-mail is already registered.
        if (data.user && data.user.identities?.length === 0) {
          throw Object.assign(new Error("already registered"), { code: "user_already_exists" });
        }
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setSentTo(email);
        }
      } else if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/auth/nouveau-mot-de-passe") });
        if (err) throw err;
        setSentTo(email);
      } else {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        router.replace("/create");
        router.refresh();
      }
    } catch (err) {
      const e2 = err as { message?: string; code?: string };
      setError(frenchError(e2.message ?? "Une erreur est survenue.", e2.code));
    } finally {
      setBusy(null);
    }
  };

  if (sentTo) {
    return (
      <div className="au-card" role="status">
        <span className="au-sent-icon"><MailCheck className="w-6 h-6" /></span>
        <h1 className="au-title">Vérifiez votre boîte mail</h1>
        <p className="au-sub">
          {mode === "signup"
            ? <>Nous avons envoyé un lien de confirmation à <strong>{sentTo}</strong>. Cliquez dessus pour activer votre compte et ouvrir le studio.</>
            : <>Si un compte existe pour <strong>{sentTo}</strong>, vous allez recevoir un lien pour choisir un nouveau mot de passe.</>}
        </p>
        <p className="au-hint">Rien reçu après quelques minutes ? Regardez dans les courriers indésirables.</p>
        <a href="/login" className="au-link-strong">Retour à la connexion</a>
      </div>
    );
  }

  const nextQuery = next !== "/create" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="au-card">
      <h1 className="au-title">{copy.title}</h1>
      <p className="au-sub">{copy.sub}</p>

      {(mode === "login" || mode === "signup") && (
        <>
          <button type="button" className="au-google" onClick={onGoogle} disabled={!!busy}>
            {busy === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            Continuer avec Google
          </button>
          <div className="au-divider"><span>ou avec votre e-mail</span></div>
        </>
      )}

      <form onSubmit={onSubmit} className="au-form" noValidate>
        {mode === "signup" && (
          <label className="au-field">
            <span>Votre nom</span>
            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Camille Martin" />
          </label>
        )}
        {mode !== "reset" && (
          <label className="au-field">
            <span>Adresse e-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </label>
        )}
        {mode !== "forgot" && (
          <label className="au-field">
            <span className="au-field-row">
              {mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}
              {mode === "login" && <a href="/mot-de-passe-oublie" className="au-link">Mot de passe oublié ?</a>}
            </span>
            <span className="au-password">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "login" ? undefined : 8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "login" ? "Votre mot de passe" : "8 caractères minimum"}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
        )}

        {error && <p className="au-error" role="alert">{error}</p>}

        <button type="submit" className="au-submit" disabled={!!busy}>
          {busy === "form" && <Loader2 className="w-4 h-4 animate-spin" />}
          {copy.cta}
        </button>
      </form>

      <p className="au-switch">
        {mode === "login" && <>Pas encore de compte ? <a href={`/signup${nextQuery}`} className="au-link-strong">Créer un compte</a></>}
        {mode === "signup" && <>Déjà inscrit ? <a href={`/login${nextQuery}`} className="au-link-strong">Se connecter</a></>}
        {(mode === "forgot" || mode === "reset") && <a href="/login" className="au-link-strong">Retour à la connexion</a>}
      </p>
      {mode === "signup" && (
        <p className="au-legal">En créant un compte, vous acceptez les conditions d&apos;utilisation d&apos;Edify.</p>
      )}
    </div>
  );
}

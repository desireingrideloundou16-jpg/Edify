"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useLang } from "@/components/i18n/LangProvider";
import type { Lang } from "@/lib/i18n/config";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Lang, Record<AuthMode, { title: string; sub: string; cta: string }>> = {
  fr: {
    login: { title: "Bon retour sur Edify", sub: "Connectez-vous pour retrouver vos packagings.", cta: "Se connecter" },
    signup: { title: "Créez votre compte", sub: "Vos réponses sont gardées : l'IA conçoit votre packaging juste après.", cta: "Créer mon compte" },
    forgot: { title: "Mot de passe oublié", sub: "Indiquez votre e-mail, nous vous envoyons un lien pour en choisir un nouveau.", cta: "Envoyer le lien" },
    reset: { title: "Nouveau mot de passe", sub: "Choisissez un mot de passe d'au moins 8 caractères.", cta: "Enregistrer le mot de passe" },
  },
  en: {
    login: { title: "Welcome back to Edify", sub: "Log in to find your packaging projects.", cta: "Log in" },
    signup: { title: "Create your account", sub: "Your answers are saved: the AI designs your pack right after.", cta: "Create my account" },
    forgot: { title: "Forgot your password", sub: "Enter your email and we'll send you a link to choose a new one.", cta: "Send the link" },
    reset: { title: "New password", sub: "Choose a password with at least 8 characters.", cta: "Save the password" },
  },
};

const T = {
  fr: {
    google: "Continuer avec Google", or: "ou avec votre e-mail", name: "Votre nom", namePh: "Ex. Awa Nkoulou", email: "Adresse e-mail", emailPh: "vous@exemple.com",
    password: "Mot de passe", newPassword: "Nouveau mot de passe", forgot: "Mot de passe oublié ?", passPh: "Votre mot de passe", passNewPh: "8 caractères minimum",
    show: "Afficher le mot de passe", hide: "Masquer le mot de passe", noAccount: "Pas encore de compte ?", create: "Créer un compte", already: "Déjà inscrit ?", login: "Se connecter",
    back: "Retour à la connexion", legal: "En créant un compte, vous acceptez les conditions d'utilisation d'Edify.", checkMail: "Vérifiez votre boîte mail",
    sentSignup: (e: string) => <>Nous avons envoyé un lien de confirmation à <strong>{e}</strong>. Cliquez dessus pour activer votre compte et ouvrir le studio.</>,
    sentReset: (e: string) => <>Si un compte existe pour <strong>{e}</strong>, vous allez recevoir un lien pour choisir un nouveau mot de passe.</>,
    spam: "Rien reçu après quelques minutes ? Regardez dans les courriers indésirables.",
    notConfigured: "Supabase n'est pas configuré (voir .env.local).", short: "Le mot de passe doit contenir au moins 8 caractères.", generic: "Une erreur est survenue.",
  },
  en: {
    google: "Continue with Google", or: "or with your email", name: "Your name", namePh: "E.g. Awa Nkoulou", email: "Email address", emailPh: "you@example.com",
    password: "Password", newPassword: "New password", forgot: "Forgot password?", passPh: "Your password", passNewPh: "At least 8 characters",
    show: "Show password", hide: "Hide password", noAccount: "No account yet?", create: "Create an account", already: "Already registered?", login: "Log in",
    back: "Back to log in", legal: "By creating an account, you accept Edify's terms of use.", checkMail: "Check your inbox",
    sentSignup: (e: string) => <>We sent a confirmation link to <strong>{e}</strong>. Click it to activate your account and open the studio.</>,
    sentReset: (e: string) => <>If an account exists for <strong>{e}</strong>, you'll receive a link to choose a new password.</>,
    spam: "Nothing after a few minutes? Check your spam folder.",
    notConfigured: "Supabase isn't configured (see .env.local).", short: "The password must be at least 8 characters.", generic: "Something went wrong.",
  },
};

function authError(message: string, code: string | undefined, lang: Lang) {
  const key = `${code ?? ""} ${message}`.toLowerCase();
  const fr = lang === "fr";
  if (key.includes("invalid_credentials") || key.includes("invalid login")) return fr ? "E-mail ou mot de passe incorrect." : "Wrong email or password.";
  if (key.includes("email_not_confirmed") || key.includes("not confirmed")) return fr ? "Confirmez d'abord votre adresse : cliquez sur le lien reçu par e-mail." : "Confirm your address first: click the link we emailed you.";
  if (key.includes("user_already_exists") || key.includes("already registered")) return fr ? "Un compte existe déjà avec cet e-mail. Connectez-vous plutôt." : "An account already exists with this email. Log in instead.";
  if (key.includes("weak_password") || key.includes("at least")) return fr ? "Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres." : "Password too weak: at least 8 characters, with letters and numbers.";
  if (key.includes("rate") && key.includes("limit")) return fr ? "Trop de tentatives. Patientez quelques minutes avant de réessayer." : "Too many attempts. Wait a few minutes and try again.";
  if (key.includes("same_password")) return fr ? "Le nouveau mot de passe doit être différent de l'ancien." : "The new password must differ from the old one.";
  if (key.includes("network") || key.includes("fetch")) return fr ? "Connexion impossible. Vérifiez votre accès à Internet." : "Can't connect. Check your internet access.";
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
  const { lang } = useLang();
  const t = T[lang];
  const rawNext = params.get("next") ?? "/create";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/create";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const copy = COPY[lang][mode];

  const callback = (target: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  const onGoogle = async () => {
    setError(null);
    setBusy("google");
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next), queryParams: { prompt: "select_account" } },
    });
    if (err) {
      setError(authError(err.message, err.code, lang));
      setBusy(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) return setError(t.notConfigured);
    if ((mode === "signup" || mode === "reset") && password.length < 8) {
      return setError(t.short);
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
      setError(authError(e2.message ?? t.generic, e2.code, lang));
    } finally {
      setBusy(null);
    }
  };

  if (sentTo) {
    return (
      <div className="au-card" role="status">
        <span className="au-sent-icon"><MailCheck className="w-6 h-6" /></span>
        <h1 className="au-title">{t.checkMail}</h1>
        <p className="au-sub">
          {mode === "signup" ? t.sentSignup(sentTo) : t.sentReset(sentTo)}
        </p>
        <p className="au-hint">{t.spam}</p>
        <a href="/login" className="au-link-strong">{t.back}</a>
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
            {t.google}
          </button>
          <div className="au-divider"><span>{t.or}</span></div>
        </>
      )}

      <form onSubmit={onSubmit} className="au-form" noValidate>
        {mode === "signup" && (
          <label className="au-field">
            <span>{t.name}</span>
            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} />
          </label>
        )}
        {mode !== "reset" && (
          <label className="au-field">
            <span>{t.email}</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} />
          </label>
        )}
        {mode !== "forgot" && (
          <label className="au-field">
            <span className="au-field-row">
              {mode === "reset" ? t.newPassword : t.password}
              {mode === "login" && <a href="/mot-de-passe-oublie" className="au-link">{t.forgot}</a>}
            </span>
            <span className="au-password">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "login" ? undefined : 8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "login" ? t.passPh : t.passNewPh}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t.hide : t.show}>
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
        {mode === "login" && <>{t.noAccount} <a href={`/signup${nextQuery}`} className="au-link-strong">{t.create}</a></>}
        {mode === "signup" && <>{t.already} <a href={`/login${nextQuery}`} className="au-link-strong">{t.login}</a></>}
        {(mode === "forgot" || mode === "reset") && <a href="/login" className="au-link-strong">{t.back}</a>}
      </p>
      {mode === "signup" && (
        <p className="au-legal">{t.legal}</p>
      )}
    </div>
  );
}

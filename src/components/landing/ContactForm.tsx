"use client";

import React, { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const SUBJECTS = ["Question", "Démonstration", "Offre entreprise", "Partenariat", "Signaler un problème"];

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) || form.message.trim().length < 5) {
      setError("Indiquez votre nom, une adresse e-mail valide et un message.");
      return;
    }
    setState("sending");
    const { error: err } = await createClient().from("contact_messages").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject,
      message: form.message.trim(),
    });
    if (err) {
      setState("error");
      setError("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
      return;
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div className="lp-contact-done" role="status">
        <CheckCircle2 className="w-7 h-7" />
        <div>
          <strong>Message envoyé, merci !</strong>
          <p>Nous vous répondons par e-mail à {form.email}, en général sous 48 heures ouvrées.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="lp-contact" onSubmit={submit} noValidate>
      <div className="lp-contact-row">
        <label>
          <span>Votre nom</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={120} required />
        </label>
        <label>
          <span>Adresse e-mail</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" maxLength={200} required />
        </label>
      </div>
      <label>
        <span>Sujet</span>
        <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>
        <span>Message</span>
        <textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={4000} required />
      </label>
      {error && <p className="au-error" role="alert">{error}</p>}
      <button type="submit" className="lp-btn lp-btn-magenta" disabled={state === "sending"}>
        {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Envoyer le message
      </button>
    </form>
  );
}

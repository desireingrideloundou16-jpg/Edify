-- Messages envoyés depuis le formulaire de contact de la landing.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  subject text not null default 'Question' check (char_length(subject) <= 80),
  message text not null check (char_length(message) between 5 and 4000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Tout le monde peut envoyer un message ; personne ne peut les relire depuis le site
-- (consultation dans Supabase > Table Editor).
drop policy if exists "Envoi de messages de contact" on public.contact_messages;
create policy "Envoi de messages de contact"
  on public.contact_messages for insert to anon, authenticated with check (true);

revoke select, update, delete on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;

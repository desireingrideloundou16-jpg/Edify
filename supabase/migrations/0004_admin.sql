-- ─── Administration ─────────────────────────────────────────────────────────
-- Rôles, suspension, journal d'usage de l'IA, journal des actions admin, statut des
-- messages de contact et paramètres du site. Toutes les lectures/écritures admin passent
-- par le serveur (clé service_role) après vérification du rôle.

alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));
exception when duplicate_object then null; end $$;

-- L'e-mail est recopié dans le profil (recherche et affichage dans l'admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is distinct from u.email;

-- Le premier compte (propriétaire d'Edify) est administrateur.
update public.profiles set role = 'admin' where email = 'desireingrideloundou16@gmail.com';

-- Usage de l'IA (designs, suggestions, décors photo) : écrit par le serveur uniquement.
create table if not exists public.ai_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('design', 'suggest', 'image')),
  engine text,
  success boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ai_events_created_idx on public.ai_events (created_at desc);
alter table public.ai_events enable row level security;

-- Journal des actions des administrateurs.
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  admin_email text,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;

-- Messages de contact : suivi.
alter table public.contact_messages add column if not exists status text not null default 'new';
alter table public.contact_messages add column if not exists handled_at timestamptz;
do $$ begin
  alter table public.contact_messages add constraint contact_status_check check (status in ('new', 'handled', 'archived'));
exception when duplicate_object then null; end $$;

-- Paramètres du site (bandeau d'annonce, maintenance…), lisibles par tous, écrits par le serveur.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Paramètres publics" on public.app_settings;
create policy "Paramètres publics" on public.app_settings for select to anon, authenticated using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;

-- Un compte suspendu ne peut plus dépenser de crédit.
create or replace function public.consume_credit()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
     set credits = credits - 1, last_seen_at = now()
   where id = auth.uid() and credits > 0 and plan_expires_at > now() and not suspended
  returning credits into remaining;
  return coalesce(remaining, -1);
end;
$$;
revoke all on function public.consume_credit() from public, anon;
grant execute on function public.consume_credit() to authenticated;

-- Le propriétaire ne peut pas modifier lui-même son rôle ni sa suspension (colonnes non accordées).
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

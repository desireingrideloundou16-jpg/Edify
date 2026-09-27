-- Edify — schéma initial : profils, projets, crédits.
-- À exécuter une fois dans Supabase > SQL Editor.

-- ─── Profils ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  credits integer not null default 10 check (credits >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profil visible par son propriétaire" on public.profiles;
create policy "Profil visible par son propriétaire"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Profil modifiable par son propriétaire" on public.profiles;
create policy "Profil modifiable par son propriétaire"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Les crédits ne se modifient que via consume_credit() : seules les colonnes nom et photo restent modifiables.
revoke insert, update, delete on public.profiles from authenticated, anon;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Création automatique du profil à l'inscription (e-mail ou Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profils des comptes déjà existants.
insert into public.profiles (id, full_name, avatar_url)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'), raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ─── Crédits : décompte atomique côté serveur ───────────────────────────────
create or replace function public.consume_credit()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
     set credits = credits - 1
   where id = auth.uid() and credits > 0
  returning credits into remaining;
  return coalesce(remaining, -1); -- -1 : plus de crédit (ou non connecté)
end;
$$;

revoke all on function public.consume_credit() from public, anon;
grant execute on function public.consume_credit() to authenticated;

-- ─── Projets ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Nouveau projet',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "Projets du propriétaire" on public.projects;
create policy "Projets du propriétaire"
  on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

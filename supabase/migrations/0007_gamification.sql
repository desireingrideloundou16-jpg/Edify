-- ─── Gamification : XP, niveaux, série de jours, badges, missions du jour ────────
create table if not exists public.gamification (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_active date,
  badges jsonb not null default '[]'::jsonb,
  counters jsonb not null default '{}'::jsonb,
  daily jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.gamification enable row level security;
drop policy if exists "Progression visible par son propriétaire" on public.gamification;
create policy "Progression visible par son propriétaire" on public.gamification for select to authenticated using (user_id = auth.uid());
-- Écriture par le serveur uniquement (règles, plafonds anti-abus).
revoke insert, update, delete on public.gamification from authenticated, anon;

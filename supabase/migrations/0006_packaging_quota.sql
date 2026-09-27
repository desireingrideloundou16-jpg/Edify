-- ─── Quota par packaging ─────────────────────────────────────────────────────
-- Les abonnements comptent des packagings complets (design + maquette 3D + image publicitaire).
-- profiles.credits = packagings restants. Un projet est « compté » la première fois que l'IA le
-- conçoit ou qu'il est téléchargé ; ensuite retouches, régénérations (plafonnées) et exports
-- sont illimités pour ce packaging.

alter table public.projects add column if not exists counted boolean not null default false;
alter table public.projects add column if not exists ai_generations integer not null default 0;

-- Le client ne peut écrire que le nom et le contenu de ses projets : le comptage est fait
-- uniquement par le serveur (clé service_role).
revoke insert, update on public.projects from authenticated;
grant insert (name, data) on public.projects to authenticated;
grant update (name, data) on public.projects to authenticated;

-- Réserve un packaging pour un projet (idempotent) : renvoie les packagings restants,
-- ou -1 si aucun packaging n'est disponible (pas d'abonnement actif, quota épuisé).
create or replace function public.claim_packaging(p_project uuid, p_user uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  proj public.projects;
  remaining integer;
begin
  select * into proj from public.projects where id = p_project and user_id = p_user for update;
  if not found then
    return -1;
  end if;
  if proj.counted then
    select credits into remaining from public.profiles where id = p_user;
    return coalesce(remaining, 0);
  end if;
  update public.profiles
     set credits = credits - 1, last_seen_at = now()
   where id = p_user and credits > 0 and plan_expires_at > now() and not suspended
  returning credits into remaining;
  if remaining is null then
    return -1;
  end if;
  update public.projects set counted = true where id = p_project;
  return remaining;
end;
$$;
revoke all on function public.claim_packaging(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_packaging(uuid, uuid) to service_role;

-- Date à laquelle le packaging a été compté (règle « satisfait ou remboursé »).
alter table public.projects add column if not exists counted_at timestamptz;
create or replace function public.claim_packaging(p_project uuid, p_user uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  proj public.projects;
  remaining integer;
begin
  select * into proj from public.projects where id = p_project and user_id = p_user for update;
  if not found then
    return -1;
  end if;
  if proj.counted then
    select credits into remaining from public.profiles where id = p_user;
    return coalesce(remaining, 0);
  end if;
  update public.profiles
     set credits = credits - 1, last_seen_at = now()
   where id = p_user and credits > 0 and plan_expires_at > now() and not suspended
  returning credits into remaining;
  if remaining is null then
    return -1;
  end if;
  update public.projects set counted = true, counted_at = now() where id = p_project;
  return remaining;
end;
$$;
revoke all on function public.claim_packaging(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_packaging(uuid, uuid) to service_role;

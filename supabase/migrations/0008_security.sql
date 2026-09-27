-- ─── Durcissement (audit de sécurité) ────────────────────────────────────────
-- 1. Un client ne peut plus supprimer ses packagings : la suppression faussait la règle
--    « satisfait ou remboursé » (packagings comptés effacés → remboursement indu).
revoke delete on public.projects from authenticated;
-- 2. Le rôle anonyme n'a rien à faire sur les tables privées (défense en profondeur, en plus du RLS).
revoke all on public.projects from anon;
revoke all on public.ai_events, public.admin_audit from anon, authenticated;
-- 3. Ancienne fonction de crédits, plus utilisée par l'application.
revoke execute on function public.consume_credit() from authenticated;

-- 4. Compteur indélébile des packagings comptés (base de la règle de remboursement).
alter table public.profiles add column if not exists packagings_used integer not null default 0;
update public.profiles p
   set packagings_used = sub.n
  from (select user_id, count(*)::int n from public.projects where counted group by user_id) sub
 where sub.user_id = p.id and p.packagings_used < sub.n;

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
     set credits = credits - 1, packagings_used = packagings_used + 1, last_seen_at = now()
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

-- 5. Formulaire de contact : plus d'écriture directe depuis le navigateur (spam, statut
--    falsifié) ; les messages passent par /api/contact (validation + limite de débit).
drop policy if exists "Envoi de messages de contact" on public.contact_messages;
revoke insert on public.contact_messages from anon, authenticated;

-- ─── Abonnements payés par Mobile Money (SasPay) ─────────────────────────────
-- Pas d'offre gratuite : les nouveaux comptes démarrent sans crédit, un plan actif est
-- nécessaire pour générer avec l'IA. Les périodes sont prépayées (1, 3 ou 12 mois).

alter table public.profiles add column if not exists plan text not null default 'none';
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles alter column credits set default 0;
do $$ begin
  alter table public.profiles add constraint profiles_plan_check check (plan in ('none', 'essentiel', 'pro', 'entreprise'));
exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('essentiel', 'pro', 'entreprise')),
  months integer not null check (months in (1, 3, 12)),
  amount integer not null check (amount > 0),
  credits integer not null check (credits > 0),
  currency text not null default 'XAF',
  provider text not null default 'saspay',
  session_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_pending_idx on public.payments (status, created_at) where status = 'pending';

alter table public.payments enable row level security;
drop policy if exists "Paiements visibles par leur propriétaire" on public.payments;
create policy "Paiements visibles par leur propriétaire"
  on public.payments for select to authenticated using (user_id = auth.uid());
-- Écriture réservée au serveur (clé service_role), après vérification auprès de SasPay.
revoke insert, update, delete on public.payments from authenticated, anon;

-- Activation atomique et idempotente : un paiement ne crédite le compte qu'une seule fois.
create or replace function public.activate_payment(p_payment uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  pay public.payments;
begin
  update public.payments
     set status = 'paid', paid_at = now()
   where id = p_payment and status = 'pending'
  returning * into pay;
  if not found then
    return false;
  end if;
  update public.profiles
     set plan = pay.plan,
         plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + make_interval(months => pay.months),
         credits = credits + pay.credits
   where id = pay.user_id;
  return true;
end;
$$;
revoke all on function public.activate_payment(uuid) from public, anon, authenticated;
grant execute on function public.activate_payment(uuid) to service_role;

-- Un crédit IA ne se dépense qu'avec un abonnement en cours.
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
   where id = auth.uid() and credits > 0 and plan_expires_at > now()
  returning credits into remaining;
  return coalesce(remaining, -1); -- -1 : pas d'abonnement actif, plus de crédit ou non connecté
end;
$$;
revoke all on function public.consume_credit() from public, anon;
grant execute on function public.consume_credit() to authenticated;

-- ─── Observabilité IA : statuts détaillés et agrégation en base (phase 1, complément) ──
-- Statuts :
--   success   appel fournisseur réussi
--   error     échec du fournisseur (HTTP, réponse invalide…)
--   timeout   délai dépassé
--   cancelled appel interrompu (requête annulée)
--   fallback  le client a reçu le repli déterministe d'Edify (aucun appel payant)
alter table public.ai_usage drop constraint if exists ai_usage_status_check;
alter table public.ai_usage add constraint ai_usage_status_check
  check (status in ('success', 'error', 'timeout', 'cancelled', 'fallback'));

-- Requêtes du tableau admin : par période, puis par fournisseur.
create index if not exists ai_usage_provider_idx on public.ai_usage (provider, created_at desc);

-- Agrégats calculés par la base (le serveur ne rapatrie pas chaque ligne).
-- SECURITY INVOKER + exécution réservée au service_role (tableau admin côté serveur).
create or replace function public.ai_usage_stats(p_since timestamptz)
returns table (
  operation text,
  provider text,
  model text,
  status text,
  calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  images bigint,
  cost_micros bigint,
  unpriced bigint,
  avg_latency_ms integer,
  p95_latency_ms integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    operation,
    provider,
    coalesce(model, '?') as model,
    status,
    count(*) as calls,
    coalesce(sum(input_tokens), 0)::bigint as input_tokens,
    coalesce(sum(output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(images_generated), 0)::bigint as images,
    coalesce(sum(estimated_cost_usd_micros), 0)::bigint as cost_micros,
    count(*) filter (where status = 'success' and estimated_cost_usd_micros is null) as unpriced,
    coalesce(round(avg(latency_ms)), 0)::integer as avg_latency_ms,
    coalesce(round(percentile_cont(0.95) within group (order by latency_ms)), 0)::integer as p95_latency_ms
  from public.ai_usage
  where created_at >= p_since
  group by operation, provider, coalesce(model, '?'), status;
$$;

revoke all on function public.ai_usage_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_usage_stats(timestamptz) to service_role;

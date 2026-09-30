-- ─── Observabilité IA (phase 1) ──────────────────────────────────────────────
-- Une ligne par appel à un fournisseur d'IA (chaque tentative, y compris les replis) :
-- opération, fournisseur, modèle, tokens, images, coût ESTIMÉ, latence, statut, erreur.
-- Purement informatif : ne sert ni aux quotas, ni aux crédits, ni à la facturation
-- (les plafonds quotidiens restent sur ai_events).
-- Jamais stockés : clés d'API, en-têtes, cookies, prompts, réponses, fichiers utilisateur.

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  operation text not null check (operation in ('suggest.generate', 'design.generate', 'image.illustration', 'image.scene', 'voice.generate')),
  provider text not null check (char_length(provider) <= 40),
  model text check (char_length(model) <= 120),
  status text not null check (status in ('success', 'error')),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  total_tokens integer check (total_tokens >= 0),
  images_generated integer not null default 0 check (images_generated >= 0),
  -- Estimation au tarif public documenté (src/lib/ai/costs.ts), en micro-dollars entiers.
  -- NULL = tarif inconnu. Jamais une donnée comptable.
  estimated_cost_usd_micros bigint check (estimated_cost_usd_micros >= 0),
  latency_ms integer check (latency_ms >= 0),
  error_code text check (char_length(error_code) <= 60),
  error_message text check (char_length(error_message) <= 300),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_operation_idx on public.ai_usage (operation, created_at desc);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

-- RLS activé sans aucune policy : aucune lecture ni écriture possible avec les clés
-- publiques ; seul le serveur (service_role) écrit et le tableau admin lit.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

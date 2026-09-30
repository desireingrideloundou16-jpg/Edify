# Observabilité IA et AI Gateway (phase 1 — mode shadow)

Edify enregistre **chaque appel à un fournisseur d'IA** pour mesurer la consommation réelle avant d'introduire
un système de crédits. Cette couche est **purement observatrice** : elle ne change ni les réponses, ni les
crédits (`profiles.credits`), ni les quotas, ni les accès. Si l'enregistrement échoue, la génération réussit
quand même.

```
route API ──► trackAiCall (AI Gateway) ──► appel fournisseur ──► résultat inchangé
                     │
                     └──► ai_usage (après la réponse, jamais bloquant)
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/ai/gateway.ts` | **AI Gateway** : `trackAiCall()` (mesure un appel), `recordAiFallback()` (repli déterministe), parseurs d'usage `geminiTokens()` et `claudeTokens()` |
| `src/lib/ai/usage.ts` | **AI Usage Service** : validation, nettoyage des secrets, écriture dans `ai_usage` via `after()` de Next |
| `src/lib/ai/costs.ts` | **Cost Calculator** : grille tarifaire centralisée et documentée, `calculateAiCost()` |
| `src/lib/log.ts` | Logs serveur structurés (JSON, codes stables) |
| `supabase/migrations/0010_ai_usage.sql` | Table `ai_usage`, index, RLS |
| `supabase/migrations/0011_ai_usage_statuses_stats.sql` | Statuts détaillés, fonction d'agrégation `ai_usage_stats()` |
| `src/lib/admin/data.ts` (`aiUsageStats`) et `src/app/admin/ia/page.tsx` | Vue admin « AI Usage » |

Les dossiers suivent la convention existante du dépôt (`src/lib/...`), pas un nouveau `src/server/`.

## Opérations et fournisseurs

| Opération | Route | Fournisseur(s) | Modèles (dans l'ordre de repli) |
|---|---|---|---|
| `suggest.generate` | `/api/suggest` | Gemini | `gemini-flash-lite-latest` → `gemini-flash-latest` → suggestions locales |
| `design.generate` | `/api/design` | Claude (si clé), puis Gemini | `claude-opus-5` → `gemini-3.8-flash` → `gemini-flash-latest` → `gemini-3.5-flash` → `gemini-flash-lite-latest` (2e passe sur les deux premiers) → designer hors ligne |
| `image.illustration` | `/api/ai-image` (`mode: "art"`) | Cloudflare Workers AI | `@cf/black-forest-labs/flux-1-schnell` (+ 1 relance adoucie si le filtre bloque à tort) |
| `image.scene` | `/api/ai-image` (décor) | Cloudflare Workers AI | idem |
| `voice.generate` | `/api/voice` | Gemini (audio) | `gemini-flash-latest` → `gemini-3.5-flash` → `gemini-flash-lite-latest` |

Chaque **tentative** est une ligne (`fallbackFrom` indique le fournisseur/modèle essayé juste avant). Quand le
client reçoit le résultat déterministe d'Edify (designer hors ligne, suggestions locales), une ligne
`provider = edify`, `status = fallback`, coût 0, `metadata.reason` est ajoutée.

Le **modèle réel** est enregistré : pour Gemini, la valeur `modelVersion` renvoyée par l'API remplace l'alias
demandé (`gemini-flash-lite-latest` → par exemple `gemini-3.5-flash-lite`).

## Table `ai_usage`

| Colonne | Contenu |
|---|---|
| `user_id` | utilisateur (NULL pour les suggestions du questionnaire, ouvertes aux visiteurs) |
| `operation`, `provider`, `model` | voir ci-dessus |
| `status` | `success`, `error`, `timeout`, `cancelled`, `fallback` |
| `input_tokens`, `output_tokens`, `total_tokens` | tels que renvoyés par le fournisseur (Gemini `usageMetadata`, Claude `usage`) ; NULL si non fournis — jamais inventés |
| `images_generated` | nombre d'images réellement renvoyées |
| `estimated_cost_usd_micros` | coût **estimé** en micro-dollars entiers (1 $ = 1 000 000) ; NULL si tarif inconnu |
| `latency_ms` | mesurée côté serveur (`performance.now()`) |
| `error_code`, `error_message` | code HTTP / `timeout` / `aborted` ; message tronqué et nettoyé des secrets |
| `metadata` | petites valeurs plates uniquement (étape, langue, tentative, `fallbackFrom`, `costBasis`…) |

**Sécurité** : RLS activé, **aucune policy** et aucun droit pour `anon` / `authenticated` : un utilisateur ne peut
ni lire ni écrire. Seul le serveur (clé `service_role`, jamais exposée au navigateur) écrit, et le tableau admin
lit via la fonction `ai_usage_stats()` (exécutable par `service_role` uniquement) après vérification du rôle
admin.

**Jamais enregistré** : clés d'API, en-têtes `Authorization`, cookies, prompts, réponses de l'IA, fichiers
(logo, audio, images), secrets Supabase ou SasPay. Les messages d'erreur passent par `scrubSecrets()`.

## Calcul des coûts

- Tarifs publics **copiés depuis les pages officielles** avec leur date de relevé (`PRICING_SOURCES`) :
  Gemini (prix par million de tokens, entrée / audio / sortie, avec le changement du 1er janvier 2027 pour les
  modèles 3.x Flash) et Cloudflare FLUX schnell (prix par tuile 512×512 et par pas de diffusion).
- **Estimation au tarif payant**, hors offres gratuites, remises et cache : **jamais une donnée comptable**.
- Modèle ou fournisseur sans tarif documenté (alias non résolu, Claude) → `null` (« sans tarif » dans l'admin).
- Conversion FCFA : uniquement à l'affichage, si `AI_COST_USD_TO_XAF` est défini (voir `.env.example`).

## Logs structurés

Une ligne JSON par événement : `AI_USAGE_RECORD_FAILED`, `AI_PROVIDER_ERROR`, `AI_COST_CALCULATION_ERROR`,
`AI_FALLBACK_USED`. Aucun secret, prompt ni contenu utilisateur.

## Ajouter une opération IA

1. Ajouter son nom à `AiOperation` et `AI_OPERATIONS` (`src/lib/ai/usage.ts`).
2. Créer une migration qui ajoute le nom à la contrainte `ai_usage_operation_check`.
3. Envelopper l'appel fournisseur :

```ts
const result = await trackAiCall(
  { operation: "mon.operation", provider: "gemini", model, userId: user.id, fallbackFrom: previous },
  async (t) => {
    const res = await fetch(/* appel existant, inchangé */);
    const json = await res.json();
    t.model(json?.modelVersion);          // modèle réel
    const usage = geminiTokens(json);     // tokens réels
    if (usage) t.tokens(usage);
    if (!res.ok) t.fail(res.status);      // échec géré par un repli, sans exception
    return json;                          // exactement ce que la route utilisait
  }
);
```

4. Ajouter le libellé dans `OPERATION` (`src/app/admin/ia/page.tsx`) et un test.

## Ajouter un fournisseur

1. Ajouter son nom à `AiProviderName` (`gateway.ts`).
2. Écrire un parseur d'usage qui ne lit **que** les champs réellement renvoyés (comme `claudeTokens`).
3. Ajouter sa grille dans `costs.ts` avec `PRICING_SOURCES` (URL + date). Sans tarif vérifié : ne rien ajouter,
   le coût restera `null`.
4. Tests : parseur, calcul de coût, et un test de route avec l'insertion `ai_usage` en échec.

## Évolutions prévues (non actives)

La Gateway est le point d'entrée unique qui accueillera plus tard : quotas, crédits (`credit_ledger`),
feature flags, kill switches, politique de repli, retries, cache et contrôle des coûts.

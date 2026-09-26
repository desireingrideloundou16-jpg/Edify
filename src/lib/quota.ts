// ─── Quota Enforcement ────────────────────────────────────────────────────────
// Pure utility functions for checking plan quotas.
// In Phase 1, operates on mock data. In Phase 2, calls Supabase.

import { QuotaUsage } from '@/types/subscription';
import { MOCK_SUBSCRIPTION } from '@/types/subscription';

export class QuotaExceededError extends Error {
  constructor(resource: string) {
    super(`QUOTA_EXCEEDED:${resource}`);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Get current quota usage (mock in Phase 1, Supabase in Phase 2).
 */
export async function getQuotaUsage(_userId: string): Promise<QuotaUsage> {
  // TODO Phase 2: replace with Supabase query
  return MOCK_SUBSCRIPTION;
}

/**
 * Check if the user can create a new project.
 * Throws QuotaExceededError if limit is reached.
 */
export async function checkProjectQuota(userId: string): Promise<void> {
  const quota = await getQuotaUsage(userId);
  const { plan, projects_used } = quota;

  if (plan.max_projects !== -1 && projects_used >= plan.max_projects) {
    throw new QuotaExceededError('projects');
  }
}

/**
 * Check if the user can perform an AI generation.
 */
export async function checkAICredits(userId: string): Promise<void> {
  const quota = await getQuotaUsage(userId);
  const { plan, ai_credits_used } = quota;

  if (plan.ai_logo_credits !== -1 && ai_credits_used >= plan.ai_logo_credits) {
    throw new QuotaExceededError('ai_credits');
  }
}

/**
 * Get a human-readable quota summary string.
 * e.g. "1/1 Projet utilisé · Plan Starter"
 */
export function formatQuotaSummary(quota: QuotaUsage): string {
  const { plan, projects_used } = quota;
  const max = plan.max_projects === -1 ? '∞' : String(plan.max_projects);
  const label = plan.max_projects === 1 ? 'Projet' : 'Projets';
  return `${projects_used}/${max} ${label} utilisé${projects_used > 1 ? 's' : ''} · Plan ${plan.name}`;
}

/**
 * Returns a 0–1 fill ratio for a gauge UI element.
 * Returns 0.99 for unlimited plans (visually full).
 */
export function getQuotaRatio(used: number, max: number): number {
  if (max === -1) return 0.99;
  if (max === 0) return 1;
  return Math.min(used / max, 1);
}

// ─── Plans ────────────────────────────────────────────────────────────────────
export type PlanId = 'starter' | 'pro' | 'studio';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price_usd: number;          // monthly, 0 = free
  price_annual_usd: number;   // annual/month price
  max_projects: number;       // -1 = unlimited
  max_exports_per_month: number;
  ai_logo_credits: number;    // per month
  features: PlanFeature[];
  highlight: boolean;         // featured / most popular
  badge?: string;
}

export interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

// ─── User Subscription ────────────────────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  expires_at?: string;
  created_at: string;
}

// ─── Usage Quota State (runtime) ─────────────────────────────────────────────
export interface QuotaUsage {
  plan: Plan;
  projects_used: number;
  exports_used: number;
  ai_credits_used: number;
}

// ─── Plan Definitions ─────────────────────────────────────────────────────────
export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Pour découvrir le packaging IA',
    price_usd: 0,
    price_annual_usd: 0,
    max_projects: 1,
    max_exports_per_month: 3,
    ai_logo_credits: 5,
    highlight: false,
    features: [
      { label: '1 projet actif', included: true },
      { label: 'Éditeur 2D Dépouille', included: true },
      { label: 'Aperçu 3D basique (CSS)', included: true },
      { label: '3 exports / mois (SVG, PDF)', included: true },
      { label: '5 crédits IA logo / mois', included: true },
      { label: 'Export PDF CMJN Print-Ready', included: false, note: 'Plan Pro+' },
      { label: 'Mockup 3D HD (WebGL)', included: false, note: 'Plan Pro+' },
      { label: 'Modèles personnalisés', included: false },
      { label: 'Accès prioritaire support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pour les designers et marques actives',
    price_usd: 29,
    price_annual_usd: 23,
    max_projects: 10,
    max_exports_per_month: 50,
    ai_logo_credits: 50,
    highlight: true,
    badge: 'Le plus populaire',
    features: [
      { label: '10 projets actifs', included: true },
      { label: 'Éditeur 2D Dépouille avancé', included: true },
      { label: 'Viewer 3D WebGL (OrbitControls)', included: true },
      { label: '50 exports / mois (SVG, PDF, DXF)', included: true },
      { label: '50 crédits IA logo / mois', included: true },
      { label: 'Export PDF CMJN Print-Ready ✓', included: true },
      { label: 'Mockup 3D HD (PNG/RGB)', included: true },
      { label: 'Matériaux : Mat, Brillant, Métallisé', included: true },
      { label: 'Accès prioritaire support', included: false },
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'Pour les agences et imprimeries',
    price_usd: 79,
    price_annual_usd: 63,
    max_projects: -1,
    max_exports_per_month: -1,
    ai_logo_credits: 200,
    highlight: false,
    badge: 'Illimité',
    features: [
      { label: 'Projets illimités', included: true },
      { label: 'Éditeur 2D Dépouille avancé', included: true },
      { label: 'Viewer 3D WebGL (OrbitControls)', included: true },
      { label: 'Exports illimités (tous formats)', included: true },
      { label: '200 crédits IA logo / mois', included: true },
      { label: 'Export PDF CMJN Print-Ready ✓', included: true },
      { label: 'Mockup 3D HD + Fond transparent', included: true },
      { label: 'Modèles gabarits personnalisés', included: true },
      { label: 'Support prioritaire dédié', included: true },
    ],
  },
];

// ─── Mock current user subscription ──────────────────────────────────────────
export const MOCK_SUBSCRIPTION: QuotaUsage = {
  plan: PLANS[0], // Starter
  projects_used: 1,
  exports_used: 1,
  ai_credits_used: 2,
};

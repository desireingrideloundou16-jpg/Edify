// ─── AI Asset Types ───────────────────────────────────────────────────────────
export type AIAssetType = 'logo' | 'texture' | 'pattern';
export type AIProvider = 'openai' | 'replicate' | 'stability';

export interface AIAsset {
  id: string;
  project_id: string;
  type: AIAssetType;
  prompt?: string;
  storage_url: string;
  provider?: AIProvider;
  created_at: string;
}

// ─── Logo Generation Request ──────────────────────────────────────────────────
export type LogoStyle =
  | 'minimalist'
  | 'luxe'
  | 'vintage'
  | 'bold'
  | 'organic'
  | 'tech'
  | 'playful'
  | 'artisanal';

export type BrandSector =
  | 'cosmétiques'
  | 'alimentaire'
  | 'mode'
  | 'tech'
  | 'santé'
  | 'maison'
  | 'sport'
  | 'bijoux'
  | 'enfants'
  | 'autre';

export type ColorMood =
  | 'sombre & luxueux'
  | 'pastel & doux'
  | 'vif & énergique'
  | 'naturel & terreux'
  | 'monochrome'
  | 'multicolore';

export interface LogoGenerationRequest {
  brand_name: string;
  sector: BrandSector;
  style: LogoStyle;
  color_mood: ColorMood;
  keywords: string[];
  project_id?: string;
}

// ─── Generation Result ────────────────────────────────────────────────────────
export interface GenerationResult {
  id: string;
  image_url: string;
  prompt_used: string;
  provider: AIProvider;
  selected?: boolean;
}

// ─── Mock Generated Logos ─────────────────────────────────────────────────────
// Placeholder gradient SVGs used while API is not wired
export const MOCK_LOGO_PLACEHOLDERS = [
  { id: 'gen-1', gradient: 'from-violet-600 to-pink-500', label: 'Variant A' },
  { id: 'gen-2', gradient: 'from-amber-500 to-rose-600', label: 'Variant B' },
  { id: 'gen-3', gradient: 'from-emerald-500 to-cyan-500', label: 'Variant C' },
  { id: 'gen-4', gradient: 'from-blue-600 to-indigo-700', label: 'Variant D' },
];

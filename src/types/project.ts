import { BoxDimensions, LayerVisibility, PackagingTemplateId } from './packaging';

// ─── Project Status ───────────────────────────────────────────────────────────
export type ProjectStatus = 'draft' | 'cmyk_exported' | 'mockup_ready';

// ─── Project ──────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  user_id: string;
  name: string;
  status: ProjectStatus;
  thumbnail?: string;
  template_id: PackagingTemplateId;
  created_at: string;
  updated_at: string;
}

// ─── Dieline Asset (2D Canvas State) ─────────────────────────────────────────
export type ColorProfile = 'rgb' | 'cmyk';

export interface DielineAsset {
  id: string;
  project_id: string;
  canvas_json?: Record<string, unknown>; // Fabric.js serialized state
  dimensions: BoxDimensions;
  color_profile: ColorProfile;
  layers_config?: LayerVisibility;
  updated_at: string;
}

// ─── 3D Viewport Config ───────────────────────────────────────────────────────
export type LightingPreset = 'studio' | 'outdoor' | 'product';
export type MaterialFinish = 'matte' | 'gloss' | 'metallic' | 'kraft';

export interface Viewport3DConfig {
  id: string;
  project_id: string;
  material_id: string;
  lighting_preset: LightingPreset;
  camera_state?: {
    rotX: number;
    rotY: number;
    zoom: number;
  };
  updated_at: string;
}

// ─── Export File ──────────────────────────────────────────────────────────────
export type ExportType = 'pdf_cmyk' | 'png_mockup_hd' | 'svg' | 'dxf' | 'json';

export interface ExportFile {
  id: string;
  project_id: string;
  type: ExportType;
  storage_url: string;
  file_size_kb?: number;
  created_at: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    user_id: 'user-demo',
    name: 'Sérum Éclat Luxe — Coffret Premium',
    status: 'mockup_ready',
    thumbnail: undefined,
    template_id: 'reverse-tuck',
    created_at: '2026-09-10T09:00:00Z',
    updated_at: '2026-09-12T14:23:00Z',
  },
  {
    id: 'proj-002',
    user_id: 'user-demo',
    name: 'BrewMaster Cold Brew — Boîte Postale',
    status: 'cmyk_exported',
    thumbnail: undefined,
    template_id: 'mailer-box',
    created_at: '2026-09-08T11:00:00Z',
    updated_at: '2026-09-11T16:45:00Z',
  },
  {
    id: 'proj-003',
    user_id: 'user-demo',
    name: 'Bijoux Soleil — Fourreau Coulissant',
    status: 'draft',
    thumbnail: undefined,
    template_id: 'sleeve-tray',
    created_at: '2026-09-13T10:00:00Z',
    updated_at: '2026-09-13T10:00:00Z',
  },
  {
    id: 'proj-004',
    user_id: 'user-demo',
    name: 'TechBolt Accessoires — Fond Automatique',
    status: 'cmyk_exported',
    thumbnail: undefined,
    template_id: 'crash-lock',
    created_at: '2026-09-05T08:30:00Z',
    updated_at: '2026-09-09T12:00:00Z',
  },
  {
    id: 'proj-005',
    user_id: 'user-demo',
    name: 'NaturaMiel Confiture — Étiquette',
    status: 'draft',
    thumbnail: undefined,
    template_id: 'reverse-tuck',
    created_at: '2026-09-13T11:00:00Z',
    updated_at: '2026-09-13T11:00:00Z',
  },
];

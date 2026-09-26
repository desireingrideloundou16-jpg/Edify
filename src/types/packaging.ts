export type PackagingTemplateId = 
  | 'reverse-tuck' 
  | 'mailer-box' 
  | 'sleeve-tray' 
  | 'crash-lock';

export interface PackagingTemplate {
  id: PackagingTemplateId;
  name: string;
  code: string;
  category: string;
  description: string;
  defaultDimensions: BoxDimensions;
}

export interface BoxDimensions {
  length: number;      // L (mm)
  width: number;       // W (mm)
  height: number;      // H / Profondeur (mm)
  caliper: number;     // Epaisseur matière (mm)
  glueFlap: number;    // Patte de collage (mm)
  bleed: number;       // Fond perdu (mm)
  safetyMargin: number;// Zone tranquille (mm)
  tuckFlap: number;    // Profondeur rabat rentrant (mm)
}

export interface MaterialOption {
  id: string;
  name: string;
  family: string;
  grammage: number; // gsm
  caliperMm: number;
  color: string;
  texture: string;
  foldLossFactor: number;
}

export interface LayerVisibility {
  cut: boolean;         // ThruCut Magenta
  crease: boolean;      // Rainage Blue
  bleed: boolean;       // Fond perdu Green
  safety: boolean;      // Zone tranquille Amber
  dimensions: boolean;  // Lignes de cotation
  labels: boolean;      // Noms des panneaux
  artwork: boolean;     // Graphisme / Visuels
}

export type ActiveTool = 'select' | 'pan' | 'measure' | 'cut' | 'crease';
export type ActiveView = '2d' | '3d' | 'split';
export type Unit = 'mm' | 'in' | 'cm';

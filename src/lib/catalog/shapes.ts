import {
  PackagingShape,

  type ShapeModel,
  IllustrationFoldingBox,
  IllustrationRigidBox,
  IllustrationDropperBottle,
  IllustrationCosmeticJar,
  IllustrationDoypack,
  IllustrationMailerBox,
  IllustrationPumpBottle,
  IllustrationSqueezeTube,
  IllustrationCanette,
  IllustrationCylinderTube,
} from "@/components/workspace/Modals";
import { SHAPE_CATEGORIES, SHAPE_ROWS } from "./shapeData";

export { SHAPE_CATEGORIES };

const CATEGORY_LABEL = Object.fromEntries(SHAPE_CATEGORIES.map((c) => [c.id, c.label])) as Record<string, string>;

// Flat 2D illustration kept for legacy UI; the sidebar uses 3D thumbnails.
const ILLUSTRATION: Record<ShapeModel, () => React.ReactNode> = {
  box: IllustrationFoldingBox, pillow: IllustrationFoldingBox, tray: IllustrationMailerBox,
  mailer: IllustrationMailerBox, rigid: IllustrationRigidBox, carton: IllustrationFoldingBox,
  bottle: IllustrationPumpBottle, wine: IllustrationPumpBottle, jug: IllustrationPumpBottle,
  dropper: IllustrationDropperBottle, pump: IllustrationPumpBottle, spray: IllustrationPumpBottle,
  jar: IllustrationCosmeticJar, tin: IllustrationCosmeticJar, tub: IllustrationCosmeticJar,
  pouch: IllustrationDoypack, flatpouch: IllustrationDoypack, sachet: IllustrationDoypack,
  bag: IllustrationDoypack, shopper: IllustrationMailerBox,
  tube: IllustrationSqueezeTube, papertube: IllustrationCylinderTube,
  can: IllustrationCanette, cup: IllustrationCylinderTube,
};

export const ALL_CATALOG_SHAPES: PackagingShape[] = SHAPE_ROWS.map(
  ([id, name, category, model, l, w, h, material, keywords]) => ({
    id,
    name,
    category,
    categoryLabel: CATEGORY_LABEL[category] ?? category,
    dimensions: `${l}×${w}×${h} mm`,
    material,
    description: `${name} — ${material}.`,
    lengthMm: l,
    widthMm: w,
    heightMm: h,
    renderIllustration: ILLUSTRATION[model],
    model,
    keywords: keywords.split(" "),
  })
);

/** Accent-insensitive search on name, category, material and keywords. */
export function searchShapes(query: string, category: string): PackagingShape[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = norm(query).split(/\s+/).filter(Boolean);
  return ALL_CATALOG_SHAPES.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (!terms.length) return true;
    const hay = norm([s.name, s.categoryLabel, s.material, ...(s.keywords ?? [])].join(" "));
    return terms.every((t) => hay.includes(t));
  });
}

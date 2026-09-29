/**
 * Industrial Product Mockup & Advertising Prompt Engine for Edify.
 * Generates photorealistic commercial 3D render prompts with dynamic secondary elements,
 * floating props, realistic micro-textures, and regulatory packaging typography.
 */
import type { PackagingDesign } from "@/lib/artwork/draw";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import { colorName } from "@/lib/ai/colorNames";

export interface MockupProductConfig {
  type: string;
  brand: string;
  name: string;
}

export interface MockupCompositionConfig {
  background_color: string;
  lighting: string;
  surface: string;
}

export interface MockupPackagingDetailsConfig {
  texture: string;
  transparent_window: boolean;
  visible_contents: string;
}

export interface MockupTypographyConfig {
  logo_effect: string;
  text_style: string;
  elements_included: string[];
}

export interface MockupSecondaryElementsConfig {
  floating_props: string[];
  layout: string;
  color_palette: string;
}

export interface MockupConfig {
  project?: string;
  version?: string;
  target_style?: string;
  parameters: {
    product: MockupProductConfig;
    composition: MockupCompositionConfig;
    packaging_details: MockupPackagingDetailsConfig;
    typography_and_branding: MockupTypographyConfig;
    dynamic_secondary_elements: MockupSecondaryElementsConfig;
    quality_modifiers: string[];
  };
}

/**
 * Generates a high quality photorealistic mockup prompt based on a structured configuration.
 * (Direct TypeScript implementation of Edify's prompt specification)
 */
export function generateMockupPrompt(productConfig: MockupConfig["parameters"]): string {
  const p = productConfig;
  const propsList = p.dynamic_secondary_elements.floating_props.length > 0
    ? p.dynamic_secondary_elements.floating_props.join(", ")
    : "subtle floating brand accents and ambient particles";

  const windowText = p.packaging_details.transparent_window
    ? `with a die-cut clear transparent window showing authentic ${p.packaging_details.visible_contents || "contents"} inside, `
    : "";

  const prompt = (
    `A professional photorealistic 3D render of a ${p.product.type} ` +
    `for the brand '${p.product.brand}', featuring '${p.product.name}'. ` +
    `Presented on a vibrant solid ${p.composition.background_color} background with ` +
    `${p.composition.lighting}, resting on a ${p.composition.surface}. ` +
    `The packaging features a realistic texture (${p.packaging_details.texture}), ` +
    `${windowText}` +
    `clean modern typography (${p.typography_and_branding.text_style}), ` +
    `a prominent logo with ${p.typography_and_branding.logo_effect}, ` +
    `${p.typography_and_branding.elements_included.join(", ")}. ` +
    `Dynamic secondary elements like ${propsList} ` +
    `float realistically around the product with a ${p.dynamic_secondary_elements.color_palette} color palette ` +
    `in a ${p.dynamic_secondary_elements.layout}. ` +
    `Style: ${p.quality_modifiers.join(", ")}.`
  );

  return prompt;
}

/**
 * Intelligent helper to deduce dynamic floating props from product name and art subject.
 */
export function deduceFloatingProps(productName: string, artSubject?: string): { props: string[]; palette: string } {
  const text = `${productName} ${artSubject || ""}`.toLowerCase();

  if (/chip|snack|plantain|crisp|biscuit|popcorn/.test(text)) {
    return {
      props: ["flying crisp wavy chips", "flying fiery red chilies", "fresh garlic cloves", "spice bowl with chili powder sprinkles"],
      palette: "vivid and saturated warm coral, sunny yellow and spice red",
    };
  }
  if (/cafe|coffee|arabica|robusta|espresso/.test(text)) {
    return {
      props: ["floating roasted coffee beans", "cinnamon sticks", "aromatic coffee steam particles", "delicate cocoa dust"],
      palette: "rich roasted amber, warm cream and deep espresso bronze",
    };
  }
  if (/the|tea|tisane|infusion|hibiscus|bissap|foler/.test(text)) {
    return {
      props: ["flying deep red hibiscus flowers", "fresh mint leaves with glistening water droplets", "floating whole dried cloves"],
      palette: "saturated magenta hibiscus, botanical emerald and golden amber",
    };
  }
  if (/miel|honey/.test(text)) {
    return {
      props: ["dripping golden honey dipper", "floating chamomile flowers", "delicate honey bees", "honeycomb chunks"],
      palette: "luminous golden amber, royal ivory and beeswax yellow",
    };
  }
  if (/jus|juice|soda|boisson|ginger|gingembre|citron|lemon|orange/.test(text)) {
    return {
      props: ["explosive crystal cold water splash", "floating sliced juicy fruits with pulp", "fresh green mint leaves", "effervescent condensation beads"],
      palette: "vivid citrus orange, lime green and sparkling water crystal",
    };
  }
  if (/sauce|piment|shito|epice|pepper|masala|curry/.test(text)) {
    return {
      props: ["flying whole red chili peppers", "star anise", "cracked black peppercorns", "floating spice spoons"],
      palette: "fiery crimson, deep saffron orange and charcoal black",
    };
  }
  if (/riz|rice|gari|farine|grain|cereal/.test(text)) {
    return {
      props: ["flying raw rice grains", "floating miniature ceramic bowl of steaming rice", "golden wheat stalks"],
      palette: "pure porcelain white, royal purple and harvest gold",
    };
  }
  if (/creme|serum|huile|karite|savon|cosmet|lotion|shampo|parfum/.test(text)) {
    return {
      props: ["floating delicate flower petals", "pure cosmetic botanical oil droplets", "aloe vera cuts", "golden light motes"],
      palette: "soft ivory, sage green and radiant champagne gold",
    };
  }

  return {
    props: ["flying aromatic ingredients", "delicate botanical leaves", "subtle floating spice particles"],
    palette: "harmonious brand-matching tones with high saturation",
  };
}

/**
 * Maps packaging model type and finishing to realistic physical texture descriptor.
 */
export function deducePackagingTexture(spec?: PackagingSpec): { texture: string; window: boolean; contents: string } {
  if (!spec) {
    return {
      texture: "slightly wrinkled matte metallized plastic with realistic crimped heat seals",
      window: false,
      contents: "",
    };
  }

  const mat = (spec.material || "").toLowerCase();
  const model = (spec.model || "").toLowerCase();

  if (model.includes("pouch") || model.includes("sachet") || mat.includes("film") || mat.includes("métallisé")) {
    return {
      texture: "slightly wrinkled metallized plastic foil with micro-creases and crisp heat-sealed zig-zag edges",
      window: mat.includes("transparent") || mat.includes("fenêtre"),
      contents: "crisp fresh contents",
    };
  }
  if (model.includes("can") || mat.includes("alu") || mat.includes("fer blanc")) {
    return {
      texture: "brushed cold aluminum covered in realistic fizzy water droplets and crisp condensation beads",
      window: false,
      contents: "",
    };
  }
  if (model.includes("bottle") || model.includes("jar") || model.includes("pot") || mat.includes("verre")) {
    return {
      texture: "flawless thick glass with realistic specular refractions and premium tactile paper label with spot UV varnish",
      window: true,
      contents: "rich organic liquid contents",
    };
  }
  if (mat.includes("kraft")) {
    return {
      texture: "tactile natural unbleached ribbed kraft paper with embossed metallic foil accents",
      window: mat.includes("fenêtre"),
      contents: "natural grains",
    };
  }

  return {
    texture: "premium 350gsm folding boxboard with soft-touch matte lamination and raised spot UV gloss elements",
    window: false,
    contents: "",
  };
}

import type { DesignSpec } from "@/lib/ai/designSpec";

/**
 * Builds a complete MockupConfig from an Edify PackagingDesign or DesignSpec and optional PackagingSpec.
 */
export function buildMockupConfigFromDesign(
  design: PackagingDesign | DesignSpec | (Partial<PackagingDesign> & { brandName: string; productName: string; palette?: any }),
  spec?: PackagingSpec
): MockupConfig {
  const { props, palette } = deduceFloatingProps(design.productName, design.artSubject);
  const { texture, window, contents } = deducePackagingTexture(spec);
  
  const rawBg = Array.isArray(design.palette)
    ? design.palette[0]
    : (design.palette && typeof design.palette === "object" && "background" in design.palette
      ? (design.palette as { background: string }).background
      : "#ffffff");
  const bgColor = colorName(rawBg) || "pure studio white";

  return {
    project: "Edify AI Packaging Engine",
    version: "2.0",
    target_style: "Professional Product Photography & Photorealistic 3D Render",
    parameters: {
      product: {
        type: spec?.model ? `${spec.model} packaging` : "premium consumer packaging",
        brand: design.brandName || "Brand",
        name: design.productName || "Product",
      },
      composition: {
        background_color: bgColor,
        lighting: "soft directional studio lighting, crisp highlights on metallic/glossy packaging, realistic drop shadow beneath the base for volume and weight",
        surface: "clean matte studio podium surface",
      },
      packaging_details: {
        texture,
        transparent_window: window,
        visible_contents: contents,
      },
      typography_and_branding: {
        logo_effect: "Prominent, subtle embossing with premium foil accents",
        text_style: "Clean, modern, highly legible typography conforming to international FMCG standards",
        elements_included: ["Nutritional facts table", "Scannable EAN-13 barcode", "Recycling & regulatory icons", "Technical labels"],
      },
      dynamic_secondary_elements: {
        floating_props: props,
        layout: "Dynamic and realistic motion or floating effect around the main product with depth-of-field blur",
        color_palette: palette,
      },
      quality_modifiers: [
        "High-resolution professional product photography",
        "Photorealistic 3D render",
        "8k resolution",
        "Commercial studio softbox lighting",
        "Hasselblad medium format fidelity",
      ],
    },
  };
}

/**
 * Convenience function to generate the final prompt string directly from a design.
 */
export function generateMockupPromptFromDesign(
  design: PackagingDesign | DesignSpec | (Partial<PackagingDesign> & { brandName: string; productName: string; palette?: any }),
  spec?: PackagingSpec
): string {
  const config = buildMockupConfigFromDesign(design, spec);
  return generateMockupPrompt(config.parameters);
}

/**
 * Edify gamification: XP, levels, daily streak, missions and badges. Rewards are about using
 * the product well (designing, finishing, printing, sharing), never free packagings.
 * Shared by the server (rules, caps) and the studio (display).
 */

export const EVENTS = {
  visit: { xp: 10, daily: 1, label: "Visite du jour" },
  ai_design: { xp: 50, daily: 10, label: "Design par l'IA" },
  voice_note: { xp: 20, daily: 10, label: "Note vocale" },
  download_pdf: { xp: 30, daily: 10, label: "PDF d'impression" },
  ad_visual: { xp: 25, daily: 10, label: "Image publicitaire" },
  view_3d: { xp: 5, daily: 5, label: "Vue 3D" },
  view_back: { xp: 5, daily: 2, label: "Dos du packaging" },
  share: { xp: 20, daily: 5, label: "Partage" },
  logo_upload: { xp: 20, daily: 3, label: "Logo importé" },
  barcode_valid: { xp: 15, daily: 2, label: "Code-barres valide" },
  edit_text: { xp: 2, daily: 20, label: "Retouche" },
  change_layout: { xp: 5, daily: 10, label: "Nouvelle mise en page" },
  new_packaging: { xp: 40, daily: 10, label: "Nouveau packaging" },
} as const;
export type GameEvent = keyof typeof EVENTS;
export const isGameEvent = (v: unknown): v is GameEvent => typeof v === "string" && v in EVENTS;

export const LEVELS = [
  { xp: 0, name: "Apprenti" },
  { xp: 100, name: "Créateur" },
  { xp: 300, name: "Designer" },
  { xp: 600, name: "Designer confirmé" },
  { xp: 1000, name: "Directeur artistique" },
  { xp: 1600, name: "Stratège de marque" },
  { xp: 2400, name: "Maître du packaging" },
  { xp: 3500, name: "Expert du rayon" },
  { xp: 5000, name: "Icône du design" },
  { xp: 7000, name: "Légende du packaging" },
];

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  return {
    level: i + 1,
    name: cur.name,
    xpInLevel: xp - cur.xp,
    xpForNext: next ? next.xp - cur.xp : 0,
    nextName: next?.name ?? null,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  };
}

export const BADGES: { id: string; name: string; hint: string; emoji: string }[] = [
  { id: "premier-design", name: "Premier design", hint: "Faites concevoir un packaging par l'IA", emoji: "✨" },
  { id: "voix-d-or", name: "Voix d'or", hint: "Dictez une note vocale au studio", emoji: "🎙️" },
  { id: "pret-a-imprimer", name: "Prêt à imprimer", hint: "Téléchargez un PDF d'impression", emoji: "🖨️" },
  { id: "publicitaire", name: "Publicitaire", hint: "Créez une image publicitaire", emoji: "📣" },
  { id: "explorateur-3d", name: "Explorateur 3D", hint: "Regardez votre packaging de dos en 3D", emoji: "🧊" },
  { id: "code-barres", name: "En règle", hint: "Ajoutez un code-barres EAN-13 valide", emoji: "🏷️" },
  { id: "identite", name: "Identité de marque", hint: "Importez votre logo", emoji: "🎨" },
  { id: "ambassadeur", name: "Ambassadeur", hint: "Partagez 3 designs", emoji: "🤝" },
  { id: "perfectionniste", name: "Perfectionniste", hint: "Faites 30 retouches", emoji: "🔍" },
  { id: "collectionneur", name: "Collectionneur", hint: "Essayez 5 mises en page différentes", emoji: "🧩" },
  { id: "gamme", name: "Une vraie gamme", hint: "Créez 5 packagings", emoji: "📦" },
  { id: "flamme-7", name: "Flamme de 7 jours", hint: "Revenez 7 jours d'affilée", emoji: "🔥" },
  { id: "flamme-30", name: "Flamme de 30 jours", hint: "Revenez 30 jours d'affilée", emoji: "🏆" },
];

/** Missions of the day: 3 per day, same for everyone that day. */
export const MISSIONS: { id: string; event: GameEvent; label: string }[] = [
  { id: "m-design", event: "ai_design", label: "Faites concevoir un design par l'IA" },
  { id: "m-voice", event: "voice_note", label: "Dictez une note vocale" },
  { id: "m-ad", event: "ad_visual", label: "Créez une image publicitaire" },
  { id: "m-layout", event: "change_layout", label: "Essayez une nouvelle mise en page" },
  { id: "m-back", event: "view_back", label: "Regardez votre packaging de dos en 3D" },
  { id: "m-share", event: "share", label: "Partagez un design" },
  { id: "m-pdf", event: "download_pdf", label: "Téléchargez un PDF d'impression" },
  { id: "m-edit", event: "edit_text", label: "Peaufinez un texte de votre packaging" },
];
export const MISSION_BONUS_XP = 50;

export function missionsFor(day: string) {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = [...MISSIONS];
  const out: typeof MISSIONS = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(h % pool.length, 1)[0]), (h = (h * 1103515245 + 12345) >>> 0);
  return out;
}

export interface GameState {
  xp: number;
  streak: number;
  bestStreak: number;
  badges: string[];
  missions: { id: string; label: string; done: boolean }[];
  missionsBonus: boolean;
}

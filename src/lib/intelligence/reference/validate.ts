/**
 * PI-4 — normalisation and validation of the reference dataset: controlled vocabularies, no URL that was
 * not read, "verified" only after an official page was read, coherent dates, short claims (summaries,
 * never long quotations), claims bound to existing PI-3 ids, no duplicate reference, and every source an
 * earlier layer cites (PI-3 provenance) resolvable here.
 */
import { CATEGORY_KNOWLEDGE } from "@/lib/intelligence/category";
import { isProductCategory, provenanceIssues, inVocabulary } from "@/lib/intelligence/taxonomy";
import { REFERENCE_DATASET, knowledgeById, toProvenance, type ReferenceDataset } from "./evidence";
import type { Reference, ReferenceClaim } from "./types";
import {
  CLAIM_RELATIONS, CLAIM_TYPES, EVIDENCE_KINDS, JURISDICTIONS, REFERENCE_SOURCE_TYPES, REFERENCE_STATUSES, VERIFICATION_METHODS,
} from "./vocabulary";

/** Canonical URL: https, lowercase host, no trailing slash, no tracking parameters, no fragment. */
export function normalizeUrl(url: string): string {
  const u = new URL(url.trim());
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k);
  return u.toString().replace(/\/(?=$|\?)/, "");
}
export const normalizeText = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** Pairs of references that are the same source under two ids (same URL, or same title + publisher). */
export function duplicateReferences(refs: readonly Reference[]): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Map<string, string>();
  for (const r of refs) {
    const keys = [`t:${normalizeText(r.title)}|${normalizeText(r.publisher)}`, ...(r.url ? [`u:${normalizeUrl(r.url)}`] : []), ...(r.officialId ? [`o:${normalizeText(r.officialId)}`] : [])];
    for (const k of keys) {
      const prev = seen.get(k);
      if (prev && prev !== r.id && !out.some(([a, b]) => a === prev && b === r.id)) out.push([prev, r.id]);
      else seen.set(k, r.id);
    }
  }
  return out;
}

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export function referenceIssues(r: Reference): string[] {
  const at = `reference(${r.id})`;
  const issues: string[] = [];
  if (!/^ref(\.[a-z0-9_]+)+$/.test(r.id)) issues.push(`${at}.id: "ref.<publisher>.<name>" in lowercase expected`);
  for (const k of ["title", "publisher", "sourceFamily", "scope"] as const) if (!r[k]?.trim()) issues.push(`${at}.${k}: required`);
  if (!inVocabulary(REFERENCE_SOURCE_TYPES, r.sourceType)) issues.push(`${at}.sourceType: invalid`);
  if (!inVocabulary(REFERENCE_STATUSES, r.status)) issues.push(`${at}.status: invalid`);
  if (!inVocabulary(JURISDICTIONS, r.jurisdiction)) issues.push(`${at}.jurisdiction: invalid`);
  if (!inVocabulary(VERIFICATION_METHODS, r.verification?.method)) issues.push(`${at}.verification.method: invalid`);
  if (!r.verification?.note?.trim()) issues.push(`${at}.verification.note: say how (or why not) it was checked`);
  if (r.status === "verified" && (r.verification.method !== "officialPageRead" || !r.verification.checkedAt)) issues.push(`${at}: "verified" requires an official page read, with its date`);
  if (r.url) {
    if (r.verification.method !== "officialPageRead") issues.push(`${at}.url: only a URL that was actually read is recorded`);
    try { if (normalizeUrl(r.url) !== r.url.replace(/\/$/, "")) issues.push(`${at}.url: not normalised`); } catch { issues.push(`${at}.url: invalid`); }
  }
  for (const k of ["publicationDate", "lastRevision", "validFrom", "validUntil"] as const) if (r[k] !== undefined && !DATE.test(r[k]!)) issues.push(`${at}.${k}: ISO date or year expected`);
  if (r.verification.checkedAt && !DATE.test(r.verification.checkedAt)) issues.push(`${at}.verification.checkedAt: ISO date expected`);
  if (r.validFrom && r.validUntil && r.validUntil < r.validFrom) issues.push(`${at}: validUntil before validFrom`);
  if ((r.sourceType === "internal" || r.sourceType === "inferred") && r.status === "verified") issues.push(`${at}: an internal note is not an external verified reference`);
  issues.push(...provenanceIssues(toProvenance(r, "medium"), `${at}.provenance`));
  return issues;
}

const PI3_CATEGORY_IDS = new Set(CATEGORY_KNOWLEDGE.map((k) => k.id));

export function claimIssues(c: ReferenceClaim, ds: ReferenceDataset = REFERENCE_DATASET): string[] {
  const at = `claim(${c.id})`;
  const issues: string[] = [];
  if (!/^claim(\.[a-zA-Z0-9]+)+$/.test(c.id)) issues.push(`${at}.id: "claim.<category>.<name>" expected`);
  if (!ds.references.some((r) => r.id === c.referenceId)) issues.push(`${at}.referenceId: unknown reference "${c.referenceId}"`);
  if (c.knowledgeId !== undefined) {
    const k = knowledgeById(c.knowledgeId);
    if (!k) issues.push(`${at}.knowledgeId: "${c.knowledgeId}" is not a PI-3 knowledge id`);
    else if (!c.categoryIds.includes(k.categoryId)) issues.push(`${at}.categoryIds: must include the knowledge's category "${k.categoryId}"`);
  }
  if (!c.categoryIds.length) issues.push(`${at}.categoryIds: at least one`);
  for (const id of c.categoryIds) if (!PI3_CATEGORY_IDS.has(id)) issues.push(`${at}.categoryIds: "${id}" is not a PI-3 category`);
  if (!c.productCategories.length || !c.productCategories.every(isProductCategory)) issues.push(`${at}.productCategories: invalid`);
  if (!inVocabulary(CLAIM_TYPES, c.claimType)) issues.push(`${at}.claimType: invalid`);
  if (!inVocabulary(CLAIM_RELATIONS, c.relation)) issues.push(`${at}.relation: invalid`);
  if (!inVocabulary(JURISDICTIONS, c.jurisdiction)) issues.push(`${at}.jurisdiction: invalid`);
  if (!inVocabulary(EVIDENCE_KINDS, c.evidence?.kind) || !c.evidence.note?.trim()) issues.push(`${at}.evidence: kind and note required`);
  if (!c.claim?.trim()) issues.push(`${at}.claim: required`);
  if (c.claim.length > 320) issues.push(`${at}.claim: a short summary, not a quotation (max 320 characters)`);
  for (const k of ["validFrom", "validUntil"] as const) if (c[k] !== undefined && !DATE.test(c[k]!)) issues.push(`${at}.${k}: ISO date expected`);
  const ref = ds.references.find((r) => r.id === c.referenceId);
  if (ref && ref.jurisdiction !== "global" && c.jurisdiction !== ref.jurisdiction) issues.push(`${at}.jurisdiction: wider than its reference (${ref.jurisdiction})`);
  return issues;
}

export function datasetIssues(ds: ReferenceDataset = REFERENCE_DATASET): string[] {
  const issues: string[] = [];
  const ids = [...ds.references.map((r) => r.id), ...ds.claims.map((c) => c.id)];
  for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) issues.push(`duplicate id ${id}`);
  for (const [a, b] of duplicateReferences(ds.references)) issues.push(`references ${a} and ${b} are the same source`);
  issues.push(...ds.references.flatMap(referenceIssues), ...ds.claims.flatMap((c) => claimIssues(c, ds)));
  // migration: every source PI-3 cites by provenance is a reference here
  for (const k of CATEGORY_KNOWLEDGE) for (const it of k.items) {
    if (it.provenance.sourceType === "regulatory" && !ds.references.some((r) => r.legacyIds?.includes(it.provenance.sourceId ?? ""))) {
      issues.push(`PI-3 ${it.id} cites "${it.provenance.sourceId}", which no reference resolves`);
    }
  }
  return issues;
}

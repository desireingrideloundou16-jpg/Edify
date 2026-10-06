/**
 * PI-4 — Reference Intelligence shadow mode: READ-ONLY observation of how well the PI-3 knowledge that
 * applies to a brief is backed by references (supported, single source, pending, unsupported,
 * conflicting, out of scope, outdated). It decides nothing and changes nothing; the brief is never part
 * of the result. Same contract as the PI-1.5 / PI-2 / PI-3 shadows.
 */
import { inferCategoryKnowledge } from "@/lib/intelligence/category";
import { inferProductIntelligence } from "@/lib/intelligence/taxonomy";
import { contextFromProductIntelligence, getEvidenceForKnowledge } from "./evidence";
import { EVIDENCE_STATUSES, REFERENCE_DATASET_VERSION, type EvidenceStatus, type ReferenceDataNeed } from "./vocabulary";

export interface ReferenceShadow {
  source: "referenceShadow";
  datasetVersion: string;
  archetypeId: string | null;
  categories: string[];
  jurisdictionKnown: boolean;
  items: { knowledgeId: string; evidenceStatus: EvidenceStatus; confidence: string }[];
  counts: Record<EvidenceStatus, number>;
  dataNeeds: ReferenceDataNeed[];
}

export function shadowReferenceEvidence(brief: string): ReferenceShadow {
  const { intelligence, archetypeId } = inferProductIntelligence(brief);
  const knowledge = inferCategoryKnowledge(intelligence);
  const ctx = contextFromProductIntelligence(intelligence);
  const ids = [...knowledge.conventions, ...knowledge.trustSignals, ...knowledge.informationPriorities.items, ...knowledge.regulatory, ...knowledge.pitfalls,
    ...knowledge.differentiation, ...knowledge.opportunities, ...knowledge.shelfBehavior].map((x) => x.id);
  const evidence = [...new Set(ids)].sort().map((id) => getEvidenceForKnowledge(id, ctx));
  const counts = Object.fromEntries(EVIDENCE_STATUSES.map((s) => [s, evidence.filter((e) => e.evidenceStatus === s).length])) as Record<EvidenceStatus, number>;
  return {
    source: "referenceShadow",
    datasetVersion: REFERENCE_DATASET_VERSION,
    archetypeId,
    categories: knowledge.matched.map((m) => m.id),
    jurisdictionKnown: !!ctx.jurisdictions?.length,
    // only knowledge that has references is listed; the rest is counted as unsupported
    items: evidence.filter((e) => e.evidenceStatus !== "unsupported").map((e) => ({ knowledgeId: e.knowledgeId, evidenceStatus: e.evidenceStatus, confidence: e.confidence })),
    counts,
    dataNeeds: [...new Set(evidence.flatMap((e) => e.dataNeeds))].sort(),
  };
}

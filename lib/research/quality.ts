import type {
  CandidateGap, ClaimStatus, Competitor, Evidence, ResearchCoverage, SearchAngle,
  SourceType, StopDecision, TraceableClaim,
} from "./types.ts";
import { stableId } from "./utils.ts";

const SOURCE_FAMILIES: Record<string, SourceType[]> = {
  competitor: ["official_company", "pricing", "documentation", "product_directory", "app_marketplace", "marketplace"],
  user_voice: ["reddit", "forum", "review", "github", "app_marketplace"],
  technical: ["documentation", "github", "research", "patent"],
  institutional: ["regulator", "research", "patent", "industry_publication"],
  failed_attempt: ["industry_publication", "github", "forum", "product_directory"],
  commercial: ["pricing", "job_posting", "marketplace", "review"],
};

export function independentEvidenceCount(ids: string[], evidence: Evidence[]): number {
  const wanted = new Set(ids);
  return new Set(evidence.filter((item) => wanted.has(item.id)).map((item) => item.sourceAssessment.independenceGroup)).size;
}

export function classifyClaim(evidenceIds: string[], evidence: Evidence[]): ClaimStatus {
  const records = evidence.filter((item) => evidenceIds.includes(item.id));
  if (records.length === 0) return "UNKNOWN";
  const independent = new Set(records.map((item) => item.sourceAssessment.independenceGroup)).size;
  const authoritative = records.some((item) => item.sourceAssessment.isPrimary && item.sourceAssessment.overallWeight >= .78);
  return independent >= 2 && records.some((item) => item.sourceAssessment.directness >= .7) || authoritative ? "VERIFIED" : "INFERRED";
}

export function traceableClaim(claim: string, evidenceIds: string[], evidence: Evidence[], rationale: string): TraceableClaim {
  return { id: stableId("claim", `${claim}:${evidenceIds.join(":")}`), claim, status: classifyClaim(evidenceIds, evidence), evidenceIds: [...new Set(evidenceIds)], rationale };
}

export function assessCoverage(input: {
  angles: SearchAngle[]; successfulAngleIds: string[]; evidence: Evidence[]; regulatedMarket: boolean;
  counterevidenceBudgetExhausted?: boolean;
}): ResearchCoverage {
  const relevantEvidence = input.evidence.filter((item) => item.relevanceAssessment.acceptedForMarket);
  const types = [...new Set(relevantEvidence.map((item) => item.sourceType))];
  const familyCoverage = Object.fromEntries(Object.entries(SOURCE_FAMILIES).map(([family, accepted]) => [
    family, relevantEvidence.filter((item) => accepted.includes(item.sourceType)
      && !(family === "competitor" && (!item.pageIdentity.entityEligible || item.sourceAssessment.discoveryOnly))).length,
  ])) as ResearchCoverage["sourceFamilyCoverage"];
  const missing: string[] = [];
  if (familyCoverage.competitor === 0) missing.push("competitor");
  if (familyCoverage.user_voice < 2) missing.push("user_voice");
  if (familyCoverage.commercial === 0) missing.push("commercial");
  if (input.regulatedMarket && familyCoverage.institutional === 0) missing.push("institutional/regulatory");
  const independent = new Set(relevantEvidence.map((item) => item.sourceAssessment.independenceGroup)).size;
  const successRatio = input.angles.length ? input.successfulAngleIds.length / input.angles.length : 0;
  const weighted = relevantEvidence.reduce((sum, item) => sum + item.sourceAssessment.overallWeight, 0);
  const duplicateClaimsCollapsed = input.evidence.reduce((sum, item) => sum + item.duplicateSourceUrls.length, 0);
  const kindsForFamily: Record<keyof ResearchCoverage["sourceFamilyCoverage"], SearchAngle["kind"][]> = {
    competitor: ["direct_competitors", "competitor_high_recall_primary", "competitor_high_recall_crosscheck", "competitor_recall_escalation", "adjacent_categories", "substitutes", "active_falsification_competition"],
    user_voice: ["customer_complaints", "manual_workarounds", "pricing_complaints", "customer_language", "evidence_gap_pain"],
    technical: ["poor_integrations", "open_source_patents", "research_regulation", "active_falsification_constraints", "evidence_gap_institutional"],
    institutional: ["research_regulation", "open_source_patents", "active_falsification_constraints", "evidence_gap_institutional"],
    failed_attempt: ["failed_attempts", "active_falsification_constraints"],
    commercial: ["direct_competitors", "competitor_high_recall_primary", "competitor_high_recall_crosscheck", "competitor_recall_escalation", "pricing_complaints", "jobs_procurement", "evidence_gap_spend"],
  };
  const successful = new Set(input.successfulAngleIds);
  const sourceFamilyAttempts = Object.fromEntries(Object.entries(kindsForFamily).map(([family, kinds]) => {
    const requested = input.angles.filter((angle) => kinds.includes(angle.kind));
    const state = familyCoverage[family as keyof typeof familyCoverage] > 0 ? "covered"
      : requested.length === 0 ? "not_attempted"
        : requested.some((angle) => successful.has(angle.id)) ? "attempted_unavailable" : "attempted_unavailable";
    return [family, state];
  })) as ResearchCoverage["sourceFamilyAttempts"];
  const coverageStatus = relevantEvidence.length < 4 || independent < 3 || familyCoverage.user_voice < 2 || successRatio < .4
    ? "insufficient" : missing.length || successRatio < .75 || types.length < 3 ? "partial" : "adequate";
  return {
    requestedAngles: input.angles.length, successfulAngles: input.successfulAngleIds.length,
    failedAngles: Math.max(0, input.angles.length - input.successfulAngleIds.length), usableSourceCount: relevantEvidence.length,
    independentSourceCount: independent, sourceTypeCount: types.length, sourceTypes: types,
    sourceFamilyCoverage: familyCoverage, missingCriticalSourceFamilies: missing,
    sourceFamilyAttempts,
    commercialEvidenceThin: familyCoverage.commercial < 2,
    counterevidenceBudgetExhausted: input.counterevidenceBudgetExhausted === true,
    duplicateClaimsCollapsed, qualityWeightedEvidence: Math.round(weighted * 100) / 100, coverageStatus,
  };
}

export function decideStop(input: { coverage: ResearchCoverage; gaps: CandidateGap[]; competitors: Competitor[] }): StopDecision {
  const supportedGaps = input.gaps.filter((gap) => gap.confidenceLabel !== "speculative opportunity"
    && !gap.penalties.some((penalty) => penalty.code === "weak_evidence" || penalty.code === "absence_only"));
  const reasons: string[] = [];
  if (input.coverage.coverageStatus === "insufficient") reasons.push("Research coverage is too thin or too dependent on one source family.");
  if (input.coverage.missingCriticalSourceFamilies.length) reasons.push(`Missing critical source families: ${input.coverage.missingCriticalSourceFamilies.join(", ")}.`);
  if (input.competitors.length === 0) reasons.push("No close competitor or substitute was positively identified; this is a search limitation, not competitive whitespace.");
  if (supportedGaps.length === 0) reasons.push("No gap has both repeated independent support and enough quality to clear the evidence gate.");
  const canGenerate = supportedGaps.length > 0 && input.coverage.coverageStatus !== "insufficient";
  const status: StopDecision["status"] = !canGenerate ? "insufficient_evidence"
    : input.coverage.coverageStatus === "partial" ? "partial_research" : "proceed";
  if (status === "proceed") reasons.push("At least one structural gap cleared the positive-evidence gate and the landscape includes user voice plus competitor/substitute coverage.");
  return {
    status, canGenerateCandidates: canGenerate, reasons,
    distinction: "Competitor existence can validate that a job or market may exist, but it is not a rejection by itself. A validated opportunity requires positive residual-demand evidence and a surviving falsification case; merely finding no competitor never qualifies.",
  };
}

export function isRegulatedQuery(query: string): boolean {
  return /health|medical|clinical|finance|bank|insurance|legal|government|public sector|education|child|elder care|food safety|pharma|regulat|compliance|license|hipaa|gdpr|sec\b|fda\b/i.test(query);
}

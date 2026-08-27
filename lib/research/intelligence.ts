import { assessFounderFit } from "./founder-fit.ts";
import { independentEvidenceCount } from "./quality.ts";
import { clamp } from "./utils.ts";
import type {
  CandidateGap, ClaimStatus, DecisionIntelligenceScores, Evidence, EvidenceConfidenceScore,
  FalsificationResult, IdeaCandidate, NoveltyScore, ResearchUserContext, ScoreFactorAssessment,
  SimilarityResult, StructuredOpportunityScorecard,
} from "./types.ts";

const round = (value: number) => Math.round(clamp(value, 0, 10) * 10) / 10;
const idsFor = (dimension: string, falsification: FalsificationResult) => {
  const hypothesis = falsification.hypotheses.find((item) => item.dimension === dimension);
  return [...new Set([...(hypothesis?.supportingEvidenceIds ?? []), ...(hypothesis?.counterEvidenceIds ?? [])])];
};

export function buildEvidenceConfidence(candidate: IdeaCandidate, evidence: Evidence[], citationCoverage: number): EvidenceConfidenceScore {
  const relevant = evidence.filter((item) => candidate.evidenceIds.includes(item.id));
  const independentSourceCount = independentEvidenceCount(candidate.evidenceIds, evidence);
  const sourceDiversity = new Set(relevant.map((item) => item.sourceType)).size;
  const freshness = relevant.length ? relevant.reduce((sum, item) => sum + item.sourceAssessment.recency, 0) / relevant.length : 0;
  const quality = relevant.length ? relevant.reduce((sum, item) => sum + item.sourceAssessment.overallWeight, 0) / relevant.length : 0;
  const contradictionPenalty = relevant.filter((item) => /contradict|dispute|however|but |failed|would not pay/i.test(item.summary)).length / Math.max(1, relevant.length);
  const evidenceDensity = clamp(independentSourceCount * 1.5 + sourceDiversity + quality * 3, 0, 10);
  const score = Math.round(clamp((evidenceDensity / 10 * .3 + Math.min(1, independentSourceCount / 5) * .2 + Math.min(1, sourceDiversity / 5) * .15 + citationCoverage * .2 + freshness * .15 - contradictionPenalty * .15) * 100, 0, 100));
  return {
    score, label: score >= 75 ? "high" : score >= 50 ? "moderate" : "low", evidenceDensity: round(evidenceDensity),
    independentSourceCount, sourceDiversity, citationCoverage: Math.round(citationCoverage * 1000) / 1000,
    freshness: Math.round(freshness * 1000) / 1000, contradictionPenalty: Math.round(contradictionPenalty * 1000) / 1000,
    rationale: "Separate from opportunity attractiveness: combines independent provenance, source diversity, quality, citation coverage, freshness, and visible contradictions.", heuristic: true,
  };
}

export function buildNoveltyScore(candidate: IdeaCandidate, similarities: SimilarityResult[], competitorIds: string[]): NoveltyScore {
  const competitors = new Set(competitorIds);
  const relevant = similarities.filter((item) => (item.leftId === candidate.id && competitors.has(item.rightId)) || (item.rightId === candidate.id && competitors.has(item.leftId)));
  const closest = relevant.sort((a, b) => b.score - a.score)[0];
  const matches = new Set(closest?.matchingDimensions ?? []);
  const overlap = {
    feature: round((matches.has("mechanism") || matches.has("desiredOutcome") ? 7 : 0) + (closest?.score ?? 0) * 3),
    positioning: round((matches.has("jobToBeDone") ? 7 : 0) + (closest?.score ?? 0) * 3),
    customer: round(matches.has("targetCustomer") ? 10 : (closest?.score ?? 0) * 4),
    workflow: round(matches.has("workflow") ? 10 : (closest?.score ?? 0) * 4),
    technology: round((matches.has("integrationsSystemBoundary") || matches.has("mechanism")) ? 10 : (closest?.score ?? 0) * 3),
    businessModel: round(matches.has("pricingBusinessModel") ? 10 : (closest?.score ?? 0) * 3),
  };
  const averageOverlap = Object.values(overlap).reduce((sum, value) => sum + value, 0) / 6;
  const score = closest ? Math.round(clamp((10 - averageOverlap) * 10, 0, 100)) : 0;
  return {
    score, overlap, closestCompetitorId: closest ? (closest.leftId === candidate.id ? closest.rightId : closest.leftId) : null,
    collisionDetected: Boolean(closest && (closest.score >= .62 || averageOverlap >= 7)),
    rationale: closest ? `Compares structured buyer, job, workflow, desired outcome, core mechanism, system boundary/integrations, pricing/business model, and distribution context. ${closest.explanation}` : "No competitor fingerprint was available, so the score receives no absence-based novelty credit.",
    heuristic: true,
  };
}

export function buildStructuredScorecard(candidate: IdeaCandidate, input: {
  gap: CandidateGap | undefined; evidence: Evidence[]; falsification: FalsificationResult;
  evidenceConfidence: EvidenceConfidenceScore; novelty: NoveltyScore; founderContext?: ResearchUserContext;
}): StructuredOpportunityScorecard {
  const gap = input.gap;
  const painIds = gap?.supportingEvidenceIds ?? [];
  const allIds = candidate.evidenceIds;
  const spendIds = input.evidence.filter((item) => allIds.includes(item.id) && /\$|€|£|pay|price|budget|procurement|hiring|cost/i.test(`${item.title} ${item.summary}`)).map((item) => item.id);
  const timingIds = input.evidence.filter((item) => allIds.includes(item.id) && /202[5-9]|new|recent|regulat|launch|adopt/i.test(`${item.title} ${item.summary}`)).map((item) => item.id);
  const founder = assessFounderFit(candidate, input.founderContext);
  const factor = (score: number, evidenceIds: string[], rationale: string, status: ClaimStatus = evidenceIds.length ? "INFERRED" : "UNKNOWN"): ScoreFactorAssessment => ({ score: round(score), status, rationale, evidenceIds: [...new Set(evidenceIds)] });
  const hypothesis = (dimension: string) => input.falsification.hypotheses.find((item) => item.dimension === dimension);
  const riskFactor = (dimension: string, fallback: number, rationale: string) => {
    const item = hypothesis(dimension); const ids = idsFor(dimension, input.falsification);
    return factor(item?.risk ?? fallback, ids, `${rationale} Higher is worse.`, item?.claimStatus ?? "UNKNOWN");
  };
  const benefitFromRisk = (dimension: string, fallback: number, rationale: string) => {
    const item = hypothesis(dimension); const ids = idsFor(dimension, input.falsification);
    return factor(10 - (item?.risk ?? fallback), ids, `${rationale} Higher is better.`, item?.claimStatus ?? "UNKNOWN");
  };
  const manual = /manual|spreadsheet|paper|copy|re-enter|by hand/i.test(`${gap?.currentWorkaround} ${gap?.whySolutionsFail}`);
  const recurring = /subscription|usage|recurring|workflow|monitor|continuous/i.test(`${candidate.businessModel} ${candidate.jobToBeDone}`);
  const card: StructuredOpportunityScorecard = {
    painSeverity: factor(gap?.scoreFactors.painSeverity ?? 2, painIds, "Severity of the evidenced consequence."),
    painFrequency: factor(gap?.scoreFactors.complaintRecurrence ?? 2, painIds, "Independent recurrence of the complaint; not inferred market frequency."),
    existingSpend: factor(Math.min(10, independentEvidenceCount(spendIds, input.evidence) * 3), spendIds, "Current money, labor, procurement, or job-budget signals."),
    willingnessToPay: factor(gap?.scoreFactors.willingnessToPay ?? 2, spendIds, "Direct or proxy willingness-to-pay evidence."),
    marketGrowth: factor(timingIds.length ? 6 : 3, timingIds, "Growth/change evidence; unknown when retrieval has no dated signal."),
    marketSize: factor(3, [], "Bottom-up reachable market size was not established by snippet research."),
    competition: riskFactor("competition", 6, "Competitive resolution risk."),
    saturation: factor(gap ? ({ low: 3, medium: 6, high: 9, unknown: 6 }[gap.competitiveDensity]) : 6, gap?.counterEvidenceIds ?? [], "Crowding risk. Higher is worse."),
    differentiation: factor(input.novelty.score / 10, gap?.counterEvidenceIds ?? [], "Residual mechanism-level novelty after competitor-overlap checks."),
    distributionDifficulty: riskFactor("distribution", 7, "Difficulty reaching buyers through a trusted affordable channel."),
    customerAccessibility: benefitFromRisk("distribution", 7, "Reachability of named users and buyers."),
    technicalDifficulty: riskFactor("technical_feasibility", 6, "Reliability, integration, and cost risk."),
    regulatoryRisk: riskFactor("regulation", 6, "Regulatory and policy exposure."),
    capitalRequirements: factor(/hardware|robot|marketplace/i.test(`${candidate.technology} ${candidate.businessModel}`) ? 8 : 3, [], "Estimated capital intensity from the proposed mechanism; requires direct validation. Higher is worse."),
    timeToMvp: factor(/hardware|robot|regulated|marketplace/i.test(`${candidate.technology} ${candidate.businessModel}`) ? 8 : 4, [], "Relative MVP time risk inferred from the mechanism. Higher is worse."),
    defensibility: benefitFromRisk("defensibility", 7, "Resistance to copying, bundling, and commoditization."),
    switchingCosts: riskFactor("switching_cost", 7, "Migration and workflow friction."),
    recurringRevenue: factor(recurring ? 7 : 4, [], "Business-model recurrence is proposed, not evidenced by market sources."),
    margins: factor(/service|concierge|hardware/i.test(`${candidate.businessModel} ${candidate.mechanism}`) ? 4 : 7, [], "Indicative delivery-margin potential; unit economics remain untested."),
    retentionPotential: factor(recurring ? 7 : manual ? 6 : 4, painIds, "Retention potential from recurring workflow embedding."),
    founderFit: factor(founder.score, [], founder.reasons.join(" ")),
    evidenceQuality: factor(input.evidenceConfidence.score / 10, allIds, "Quality-weighted support independent from attractiveness."),
    evidenceQuantity: factor(Math.min(10, input.evidenceConfidence.independentSourceCount * 2), allIds, "Independent evidence groups, excluding syndicated duplication."),
    sourceDiversity: factor(Math.min(10, input.evidenceConfidence.sourceDiversity * 2), allIds, "Distinct source-type coverage."),
    confidence: factor(input.evidenceConfidence.score / 10, allIds, input.evidenceConfidence.rationale),
    timing: factor(timingIds.length ? 7 : 3, timingIds, "Credible reason the opportunity may exist now."),
    incumbentVulnerability: benefitFromRisk("competition", 7, "Unresolved complaint and incumbent-response exposure."),
    fragmentation: factor(manual || /fragment|multiple tools|integration/i.test(gap?.whySolutionsFail ?? "") ? 8 : 4, painIds, "Workflow and supplier fragmentation signal."),
    aiCommoditizationRisk: factor(/ai|model|llm|generate|agent/i.test(`${candidate.technology} ${candidate.mechanism}`) ? 8 : 4, [], "Risk that foundation models or open source make the core capability cheap or bundled. Higher is worse."),
  };
  return card;
}

export function buildDecisionIntelligence(card: StructuredOpportunityScorecard, evidenceConfidence: EvidenceConfidenceScore): DecisionIntelligenceScores {
  const score = (key: keyof StructuredOpportunityScorecard) => card[key].score;
  return {
    evidenceDensity: evidenceConfidence.evidenceDensity,
    consensusVsContrarian: round(5 + evidenceConfidence.contradictionPenalty * 5 - Math.min(3, evidenceConfidence.independentSourceCount / 2)),
    opportunityHalfLife: round((score("timing") + (10 - score("aiCommoditizationRisk")) + score("defensibility")) / 3),
    demandAuthenticity: round((score("painSeverity") + score("painFrequency") + score("existingSpend") + score("willingnessToPay")) / 4),
    painToSpendRatio: round(score("existingSpend") ? score("painSeverity") / score("existingSpend") * 5 : 10),
    marketFragmentation: score("fragmentation"), incumbentVulnerability: score("incumbentVulnerability"),
    switchingFriction: score("switchingCosts"), timing: score("timing"),
    regulatoryTailwind: round(score("timing") - score("regulatoryRisk") / 2 + 5),
    manualLaborReplacement: round((score("painFrequency") + score("existingSpend") + score("fragmentation")) / 3),
    distributionViability: score("customerAccessibility"), aiCommoditization: score("aiCommoditizationRisk"),
    definitions: {
      evidenceDensity: "Independent, diverse, quality-weighted support per candidate; higher is denser.",
      consensusVsContrarian: "Higher means more contradiction or less independent consensus; it is not automatically better.",
      opportunityHalfLife: "Higher means timing, defensibility, and low commoditization imply a longer-lived opening.",
      demandAuthenticity: "Higher means pain, frequency, current spend, and willingness-to-pay align.",
      painToSpendRatio: "Higher means pain appears large relative to evidenced spend, which can indicate upside or fake demand.",
      marketFragmentation: "Higher means more fragmented tools, suppliers, or handoffs.",
      incumbentVulnerability: "Higher means the residual gap appears harder for incumbents to close.",
      switchingFriction: "Higher is worse: greater migration and workflow friction.",
      timing: "Higher means stronger cited now-reasons.", regulatoryTailwind: "Higher means timing evidence outweighs regulatory risk.",
      manualLaborReplacement: "Higher means recurring paid/manual work is plausibly replaceable.",
      distributionViability: "Higher means named buyers and channels look more reachable.",
      aiCommoditization: "Higher is worse: generic AI or open source can erase more of the capability.",
    }, heuristic: true,
  };
}

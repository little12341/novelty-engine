import type { CandidateGap, Evidence, FalsificationDimension, FalsificationHypothesis, FalsificationResult, IdeaCandidate, SimilarityResult } from "./types.ts";
import { classifyClaim, independentEvidenceCount } from "./quality.ts";

const HYPOTHESES: Array<[FalsificationDimension, string]> = [
  ["demand", "The reported pain is not frequent or severe enough to change behavior."],
  ["competition", "An existing product already solves the job well enough."],
  ["economics", "The avoided cost is lower than acquisition, support, and delivery cost."],
  ["distribution", "The target user cannot be reached through an affordable trusted channel."],
  ["technical_feasibility", "The core mechanism is unreliable at the required cost or accuracy."],
  ["regulation", "Policy, licensing, or data rules block the proposed workflow."],
  ["user_behavior", "Users will not abandon the workaround or supply the required behavior."],
  ["trust", "The system requires data access or autonomy users will not grant."],
  ["liability", "A failure creates liability greater than the value delivered."],
  ["switching_cost", "Migration and integration costs overwhelm the wedge."],
  ["defensibility", "Incumbents can copy or bundle the mechanism before it compounds."],
];

export function falsifyCandidate(candidate: IdeaCandidate, input: {
  evidence: Evidence[]; gaps: CandidateGap[]; similarities: SimilarityResult[];
}): FalsificationResult {
  const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
  const candidateSimilarity = input.similarities.filter((item) => item.leftId === candidate.id || item.rightId === candidate.id);
  const maxSimilarity = candidateSimilarity.reduce((max, item) => Math.max(max, item.score), 0);
  const positiveIds = candidate.evidenceIds;
  const counterIds = gap?.counterEvidenceIds ?? [];
  const independent = independentEvidenceCount(positiveIds, input.evidence);
  const activeCounterevidence = input.evidence.filter((item) => item.searchAngleIds.some((id) => id.startsWith("falsify_")));
  const idsMatching = (pattern: RegExp) => activeCounterevidence.filter((item) => pattern.test(`${item.title} ${item.summary}`)).map((item) => item.id);
  const critical = new Set<FalsificationDimension>(["demand", "economics", "distribution", "technical_feasibility"]);
  const hypotheses: FalsificationHypothesis[] = HYPOTHESES.map(([dimension, statement]) => {
    let risk = 6;
    const supportingEvidenceIds: string[] = [];
    const counterEvidenceIds: string[] = [];
    if (dimension === "demand") {
      risk = independent >= 3 ? 3 : independent >= 2 ? 5 : 8;
      supportingEvidenceIds.push(...positiveIds);
      counterEvidenceIds.push(...idsMatching(/low demand|would not pay|not worth|low adoption|cancel|abandon|shut down|failed/i));
    }
    if (dimension === "competition") {
      risk = Math.round(maxSimilarity * 10);
      counterEvidenceIds.push(...counterIds, ...idsMatching(/competitor|alternative|substitute|already (?:does|solve)|features?|pricing/i));
    }
    if (dimension === "economics") {
      if (gap?.willingnessToPaySignal) supportingEvidenceIds.push(...gap.supportingEvidenceIds);
      counterEvidenceIds.push(...idsMatching(/unit economics|support cost|acquisition cost|too expensive|infrastructure cost|small market|pricing/i));
    }
    if (dimension === "distribution") {
      supportingEvidenceIds.push(...input.evidence.filter((item) => item.sourceType === "job_posting" || /procurement|rfp|partner|marketplace|community/i.test(`${item.title} ${item.summary}`)).map((item) => item.id));
      counterEvidenceIds.push(...idsMatching(/acquisition|distribution|procurement|trusted channel|sales cycle/i));
    }
    if (dimension === "technical_feasibility") {
      supportingEvidenceIds.push(...input.evidence.filter((item) => ["documentation", "github", "research", "patent"].includes(item.sourceType)).map((item) => item.id));
      counterEvidenceIds.push(...idsMatching(/technical limitation|unreliable|accuracy|latency|infrastructure|hardware cost/i));
      risk = candidate.technology && /sensor|edge|hardware/i.test(candidate.technology) ? 7 : 5;
    }
    if (dimension === "user_behavior") {
      supportingEvidenceIds.push(...gap?.supportingEvidenceIds ?? []);
      counterEvidenceIds.push(...idsMatching(/adoption|behavior|would not|refus|manual.*prefer|habit/i));
    }
    if (dimension === "trust") {
      counterEvidenceIds.push(...idsMatching(/trust|privacy|security|data access|surveillance/i));
      risk = /passive|data|autonomous|metadata/i.test(`${candidate.dataSource} ${candidate.mechanism}`) ? 7 : 5;
    }
    if (dimension === "liability") counterEvidenceIds.push(...idsMatching(/liability|safety|harm|insurance|responsib/i));
    if (dimension === "switching_cost") {
      supportingEvidenceIds.push(...gap?.supportingEvidenceIds ?? []);
      counterEvidenceIds.push(...idsMatching(/switching cost|migration|integration cost|lock.in/i));
      risk = /replace|new system/i.test(candidate.workflowPosition) ? 8 : 5;
    }
    if (dimension === "defensibility") {
      counterEvidenceIds.push(...counterIds, ...idsMatching(/incumbent|bundle|copy|open.source|commodity/i));
      risk = maxSimilarity > 0.65 ? 8 : 6;
    }
    if (dimension === "regulation") {
      const regulatory = input.evidence.filter((item) => item.sourceType === "regulator" || /regulat|rule|policy/i.test(`${item.title} ${item.summary}`));
      counterEvidenceIds.push(...regulatory.map((item) => item.id));
      risk = regulatory.length ? 6 : 5;
    }
    const support = [...new Set(supportingEvidenceIds)];
    const counter = [...new Set(counterEvidenceIds)];
    const unknown = support.length === 0 && counter.length === 0;
    if (counter.length >= 2 && support.length === 0) risk = Math.max(risk, 8);
    else if (counter.length > support.length) risk = Math.max(risk, 7);
    else if (support.length >= 2 && counter.length === 0) risk = Math.min(risk, 4);
    else if (support.length > 0 && support.length >= counter.length) risk = Math.min(risk, 5);
    else if (unknown && critical.has(dimension)) risk = Math.max(risk, 7);
    const status = unknown ? "UNKNOWN" : classifyClaim([...support, ...counter], input.evidence);
    const rationale = unknown
      ? "No retrieved source directly tested this failure hypothesis; the risk remains unknown and receives no clearance credit."
      : `${support.length} source record(s) weigh against the failure hypothesis and ${counter.length} weigh in its favor; repeated copies are collapsed upstream.`;
    return { dimension, statement, supportingEvidenceIds: support, counterEvidenceIds: counter, risk, unknown, claimStatus: status, rationale, decisive: risk >= 7 || unknown && critical.has(dimension) };
  });
  const averageRisk = hypotheses.reduce((sum, item) => sum + item.risk, 0) / hypotheses.length;
  const evidenceBonus = Math.min(10, independent * 2.5);
  const counterPenalty = Math.min(18, counterIds.length * 2.5);
  const survivalScore = Math.round(Math.max(0, Math.min(100, 100 - averageRisk * 9 + evidenceBonus - counterPenalty)));
  const unknownCriticalCount = hypotheses.filter((item) => item.unknown && critical.has(item.dimension)).length;
  const knownFatal = hypotheses.some((item) => item.risk >= 9 && item.counterEvidenceIds.length >= 2);
  const outcome = !knownFatal && survivalScore >= 48 && unknownCriticalCount <= 2 ? "survived"
    : !knownFatal && survivalScore >= 35 && unknownCriticalCount <= 3 && candidate.iteration === 0 ? "mutate" : "rejected";
  const decisiveRisks = hypotheses.filter((item) => item.decisive).sort((a, b) => b.risk - a.risk).slice(0, 5).map((item) => ({
    dimension: item.dimension, risk: item.risk, status: item.claimStatus, reason: item.rationale,
    evidenceIds: [...new Set([...item.supportingEvidenceIds, ...item.counterEvidenceIds])],
  }));
  return {
    candidateId: candidate.id, hypotheses,
    argumentsFor: positiveIds.length ? [{ claim: "Retrieved evidence supports the source gap, workaround, or enabling change.", evidenceIds: positiveIds }] : [],
    argumentsAgainst: counterIds.length ? [{ claim: "Retrieved competitors or substitutes may already address part of the job.", evidenceIds: counterIds }] : [{ claim: "No targeted counterevidence was retrieved; competition and demand remain unknown, not cleared.", evidenceIds: [] }],
    survivalScore, outcome, decisiveRisks, unknownCriticalCount,
    reason: outcome === "survived" ? "The concept cleared the positive-evidence gate and no known fatal risk or excessive critical unknowns survived the adversarial pass." : outcome === "mutate" ? "The evidence-backed core remains promising, but exactly one bounded constraint mutation may be retested." : "Counterevidence, similarity, a fatal risk, or too many critical unknowns overwhelm the current case; the idea is not rescued further.",
  };
}

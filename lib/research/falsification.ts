import type { CandidateGap, Evidence, FalsificationDimension, FalsificationHypothesis, FalsificationResult, IdeaCandidate, SimilarityResult } from "./types.ts";
import { independentHostCount } from "./utils.ts";

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
  const independent = independentHostCount(positiveIds, input.evidence);
  const hypotheses: FalsificationHypothesis[] = HYPOTHESES.map(([dimension, statement]) => {
    let risk = 5;
    const supportingEvidenceIds: string[] = [];
    const counterEvidenceIds: string[] = [];
    if (dimension === "demand") {
      risk = independent >= 3 ? 3 : independent >= 2 ? 5 : 8;
      supportingEvidenceIds.push(...positiveIds);
    }
    if (dimension === "competition") {
      risk = Math.round(maxSimilarity * 10);
      counterEvidenceIds.push(...counterIds);
    }
    if (dimension === "technical_feasibility") risk = candidate.technology && /sensor|edge|hardware/i.test(candidate.technology) ? 7 : 4;
    if (dimension === "trust") risk = /passive|data|autonomous|metadata/i.test(`${candidate.dataSource} ${candidate.mechanism}`) ? 7 : 4;
    if (dimension === "switching_cost") risk = /replace|new system/i.test(candidate.workflowPosition) ? 8 : 4;
    if (dimension === "defensibility") risk = maxSimilarity > 0.65 ? 8 : 5;
    if (dimension === "regulation") {
      const regulatory = input.evidence.filter((item) => item.sourceType === "regulator" || /regulat|rule|policy/i.test(`${item.title} ${item.summary}`));
      counterEvidenceIds.push(...regulatory.map((item) => item.id));
      risk = regulatory.length ? 6 : 5;
    }
    return { dimension, statement, supportingEvidenceIds: [...new Set(supportingEvidenceIds)], counterEvidenceIds: [...new Set(counterEvidenceIds)], risk, unknown: supportingEvidenceIds.length === 0 && counterEvidenceIds.length === 0 };
  });
  const averageRisk = hypotheses.reduce((sum, item) => sum + item.risk, 0) / hypotheses.length;
  const evidenceBonus = Math.min(12, independent * 3);
  const counterPenalty = Math.min(18, counterIds.length * 2.5);
  const survivalScore = Math.round(Math.max(0, Math.min(100, 100 - averageRisk * 9 + evidenceBonus - counterPenalty)));
  const outcome = survivalScore >= 50 ? "survived" : survivalScore >= 32 ? "mutate" : "rejected";
  return {
    candidateId: candidate.id, hypotheses,
    argumentsFor: positiveIds.length ? [{ claim: "Retrieved evidence supports the source gap, workaround, or enabling change.", evidenceIds: positiveIds }] : [],
    argumentsAgainst: counterIds.length ? [{ claim: "Retrieved competitors or substitutes may already address part of the job.", evidenceIds: counterIds }] : [{ claim: "No targeted counterevidence was retrieved; competition and demand remain unknown, not cleared.", evidenceIds: [] }],
    survivalScore, outcome,
    reason: outcome === "survived" ? "The concept retained sufficient evidence and distance after explicit risk penalties." : outcome === "mutate" ? "Potential remains, but one mutation is required before retesting." : "Counterevidence, similarity, or unsupported critical risks overwhelm the current case.",
  };
}

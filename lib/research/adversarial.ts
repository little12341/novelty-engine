import { createHash } from "node:crypto";
import type { AdversarialAgentResult, AssumptionLedgerEntry, CandidateGap, Evidence, FalsificationResult, IdeaCandidate } from "./types.ts";

const hash = (label: string, ids: string[]) => createHash("sha256").update(`${label}:${[...ids].sort().join(":")}`).digest("hex").slice(0, 20);
const averageQuality = (ids: string[], evidence: Evidence[]) => {
  const records = evidence.filter((item) => ids.includes(item.id));
  return records.length ? Math.round(records.reduce((sum, item) => sum + item.sourceAssessment.overallWeight, 0) / records.length * 100) : 0;
};

export function runAdversarialPanel(candidate: IdeaCandidate, input: {
  gap: CandidateGap | undefined; falsification: FalsificationResult; evidence: Evidence[]; assumptions: AssumptionLedgerEntry[];
}): { bull: AdversarialAgentResult; bear: AdversarialAgentResult; judge: AdversarialAgentResult } {
  const positiveIds = [...new Set([...(input.gap?.supportingEvidenceIds ?? []), ...input.falsification.argumentsFor.flatMap((item) => item.evidenceIds)])];
  const negativeIds = [...new Set(input.falsification.hypotheses.flatMap((item) => item.counterEvidenceIds))];
  const unresolved = input.assumptions.filter((item) => ["UNTESTED", "WEAK", "CRITICAL"].includes(item.status)).map((item) => item.id);
  const bull: AdversarialAgentResult = {
    agent: "bull", candidateId: candidate.id, independentInputHash: hash("bull-positive-only", positiveIds),
    verdict: positiveIds.length >= 2 ? "SURVIVES" : "INVESTIGATE",
    claims: input.falsification.argumentsFor.map((item) => ({ claim: item.claim, factState: item.evidenceIds.length ? "INFERRED" : "UNKNOWN", evidenceIds: item.evidenceIds })),
    contradictions: [], unresolvedAssumptions: unresolved, sourceQualityScore: averageQuality(positiveIds, input.evidence),
    rationale: positiveIds.length >= 2 ? "The strongest independently assembled positive case has repeated evidence and an explicit residual-gap mechanism." : "The positive case is too thin to advance without additional demand evidence.",
  };
  const fatal = input.falsification.outcome === "rejected" || input.falsification.decisiveRisks.some((item) => item.risk >= 9 && item.evidenceIds.length >= 2);
  const bear: AdversarialAgentResult = {
    agent: "bear", candidateId: candidate.id, independentInputHash: hash("bear-counter-only", negativeIds),
    verdict: fatal ? "KILL" : negativeIds.length || unresolved.length ? "INVESTIGATE" : "SURVIVES",
    claims: input.falsification.argumentsAgainst.map((item) => ({ claim: item.claim, factState: item.evidenceIds.length ? "INFERRED" : "UNKNOWN", evidenceIds: item.evidenceIds })),
    contradictions: input.falsification.decisiveRisks.map((item) => `${item.dimension}: ${item.reason}`),
    unresolvedAssumptions: unresolved, sourceQualityScore: averageQuality(negativeIds, input.evidence),
    rationale: fatal ? "Independent counterevidence established a fatal condition." : "No fatal condition was established, but unresolved economics, access, switching, or technical assumptions still require testing.",
  };
  const contradictions = [
    ...(bull.verdict === "SURVIVES" && bear.verdict !== "SURVIVES" ? ["Positive demand evidence coexists with unresolved or adverse execution evidence."] : []),
    ...input.assumptions.filter((item) => item.supportingEvidenceIds.length && item.contradictingEvidenceIds.length).map((item) => item.assumption),
  ];
  const judgeVerdict: AdversarialAgentResult["verdict"] = bear.verdict === "KILL" ? "KILL"
    : input.falsification.outcome === "survived" && input.falsification.unknownCriticalCount <= 1 ? "SURVIVES" : "INVESTIGATE";
  const judgeIds = [...new Set([...positiveIds, ...negativeIds])];
  const judge: AdversarialAgentResult = {
    agent: "judge", candidateId: candidate.id, independentInputHash: hash(`judge:${bull.independentInputHash}:${bear.independentInputHash}`, judgeIds),
    verdict: judgeVerdict,
    claims: [
      { claim: `Bull verdict: ${bull.verdict}. ${bull.rationale}`, factState: "INFERRED", evidenceIds: positiveIds },
      { claim: `Bear verdict: ${bear.verdict}. ${bear.rationale}`, factState: negativeIds.length ? "INFERRED" : "UNKNOWN", evidenceIds: negativeIds },
    ], contradictions, unresolvedAssumptions: unresolved,
    sourceQualityScore: Math.round((bull.sourceQualityScore + bear.sourceQualityScore) / 2),
    rationale: judgeVerdict === "KILL" ? "The Bear established a fatal cited condition."
      : judgeVerdict === "SURVIVES" ? "The evidence-backed case survived the independent Bear attack with at most one critical unknown; this is survived, not externally validated."
        : "The opportunity remains worth investigating, but the evidence does not justify calling it validated.",
  };
  return { bull, bear, judge };
}

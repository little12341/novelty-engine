import type {
  CandidateGap, Competitor, Evidence, EvidenceGateResult, EvidenceGateThresholds,
  FalsificationResult, IdeaCandidate, UnderservedSegment,
} from "./types.ts";
import { independentEvidenceCount } from "./quality.ts";

const bounded = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function evidenceGateThresholds(env: NodeJS.ProcessEnv = process.env): EvidenceGateThresholds {
  return {
    minIndependentPainSignals: bounded(env.EVIDENCE_GATE_MIN_PAIN_SIGNALS, 3, 1, 10),
    minIndependentSpendSignals: bounded(env.EVIDENCE_GATE_MIN_SPEND_SIGNALS, 2, 1, 10),
    minCompetitorsAnalyzed: bounded(env.EVIDENCE_GATE_MIN_COMPETITORS, 3, 0, 10),
    minUnderservedSegments: bounded(env.EVIDENCE_GATE_MIN_SEGMENTS, 1, 1, 5),
    minTimingSignals: bounded(env.EVIDENCE_GATE_MIN_TIMING_SIGNALS, 1, 1, 5),
    minSourceTypes: bounded(env.EVIDENCE_GATE_MIN_SOURCE_TYPES, 3, 1, 10),
    minCitationCoverage: bounded(env.EVIDENCE_GATE_MIN_CITATION_COVERAGE, .85, .5, 1),
    maxUnresolvedFatalFalsifications: bounded(env.EVIDENCE_GATE_MAX_FATAL_RISKS, 0, 0, 3),
  };
}

const SPEND = /\$|€|£|\bpay(?:ing|ment)?\b|price|pricing|budget|procurement|hiring|job posting|consultant|contractor|invoice|cost/i;
const TIMING = /202[5-9]|new regulation|effective date|mandate|recent(?:ly)?|launch|adoption|price (?:drop|collapse)|now possible|new api/i;

export function evaluateEvidenceGate(candidate: IdeaCandidate, input: {
  gap: CandidateGap | undefined;
  evidence: Evidence[];
  competitors: Competitor[];
  segments: UnderservedSegment[];
  falsification: FalsificationResult;
  thresholds?: EvidenceGateThresholds;
  externallyValidated?: boolean;
}): EvidenceGateResult {
  const thresholds = input.thresholds ?? evidenceGateThresholds();
  const gapIds = input.gap?.supportingEvidenceIds ?? [];
  const relevantIds = [...new Set([...candidate.evidenceIds, ...gapIds, ...(input.gap?.counterEvidenceIds ?? [])])];
  const relevant = input.evidence.filter((item) => relevantIds.includes(item.id));
  const spendIds = input.evidence.filter((item) => SPEND.test(`${item.title} ${item.summary}`)
    && (relevantIds.includes(item.id) || item.sourceAssessment.sourceFamily === "commercial")).map((item) => item.id);
  const timingIds = input.evidence.filter((item) => TIMING.test(`${item.title} ${item.summary}`)).map((item) => item.id);
  const referenced = [
    ...candidate.evidenceIds,
    ...input.falsification.hypotheses.flatMap((item) => [...item.supportingEvidenceIds, ...item.counterEvidenceIds]),
  ];
  const known = new Set(input.evidence.map((item) => item.id));
  const citationCoverage = referenced.length ? referenced.filter((id) => known.has(id)).length / referenced.length : 0;
  const fatal = input.falsification.decisiveRisks.filter((item) => item.risk >= 9 && item.evidenceIds.length >= 2).length
    + (input.falsification.residualUnmetDemand.adequateSameJobSameUserSolution ? 1 : 0);
  const observed = {
    independentPainSignals: independentEvidenceCount(gapIds, input.evidence),
    independentSpendSignals: independentEvidenceCount(spendIds, input.evidence),
    competitorsAnalyzed: input.competitors.length,
    underservedSegments: input.gap?.affectedSegment ? Math.max(1, input.segments.length) : input.segments.length,
    timingSignals: independentEvidenceCount(timingIds, input.evidence),
    sourceTypes: new Set(relevant.map((item) => item.sourceType)).size,
    citationCoverage: Math.round(citationCoverage * 1000) / 1000,
    unresolvedFatalFalsifications: fatal,
  };
  const checks = {
    pain: observed.independentPainSignals >= thresholds.minIndependentPainSignals,
    spend: observed.independentSpendSignals >= thresholds.minIndependentSpendSignals,
    competition: observed.competitorsAnalyzed >= thresholds.minCompetitorsAnalyzed,
    segment: observed.underservedSegments >= thresholds.minUnderservedSegments,
    timing: observed.timingSignals >= thresholds.minTimingSignals,
    sourceDiversity: observed.sourceTypes >= thresholds.minSourceTypes,
    citationCoverage: observed.citationCoverage >= thresholds.minCitationCoverage,
    fatalFalsification: observed.unresolvedFatalFalsifications <= thresholds.maxUnresolvedFatalFalsifications,
  };
  const survivalGatePassed = input.falsification.outcome === "survived"
    && observed.independentPainSignals >= 2 && observed.citationCoverage === 1 && checks.fatalFalsification;
  const validationEvidenceGatePassed = Object.values(checks).every(Boolean);
  const externallyValidated = input.externallyValidated === true;
  const classification: EvidenceGateResult["classification"] = input.falsification.outcome === "rejected" || !checks.fatalFalsification
    ? "killed" : externallyValidated && validationEvidenceGatePassed ? "validated"
      : survivalGatePassed ? "survived" : candidate.evidenceIds.length ? "promising" : "discovered";
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (!externallyValidated) blockers.push("external_validation_not_completed");
  return {
    candidateId: candidate.id, thresholds, observed, checks, survivalGatePassed,
    validationEvidenceGatePassed, externallyValidated, classification, blockers,
    rationale: classification === "validated"
      ? "Every configured evidence threshold passed and external validation evidence was recorded."
      : classification === "survived"
        ? `The candidate survived research falsification but is not validated. Remaining validation blockers: ${blockers.join(", ") || "external validation"}.`
        : classification === "killed" ? "A fatal or rejected falsification condition prevents promotion."
          : `The candidate remains ${classification}; unmet checks are explicit rather than silently filled: ${blockers.join(", ")}.`,
  };
}

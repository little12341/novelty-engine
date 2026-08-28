import type { CandidateGap, ClaimStatus, FactState, IdeaCandidate, ResearchResult } from "./types.ts";

export const RUN_CANDIDATE_COMPARISON_DIMENSIONS = [
  "buyer_specificity", "pain_evidence", "spend_wtp_evidence", "residual_gap", "competition_collision",
  "differentiation", "feasibility", "distribution", "switching_friction", "regulation_liability",
  "evidence_confidence", "unresolved_critical_assumptions", "strongest_counterevidence", "next_validation_action",
] as const;

export type RunCandidateComparisonDimension = typeof RUN_CANDIDATE_COMPARISON_DIMENSIONS[number];

type ComparisonTarget = {
  id: string;
  entityType: "candidate" | "gap";
  name: string;
  lifecycle: "discovered" | "promising" | "survived" | "validated" | "killed" | "gap_only";
  killed: boolean;
  killReason: string | null;
  candidate: IdeaCandidate | null;
  gap: CandidateGap | null;
};

type ComparisonCell = {
  targetId: string;
  state: FactState;
  assessment: string;
  evidenceIds: string[];
  citations: Array<{ id: string; title: string; url: string }>;
};

const unique = (values: string[]) => [...new Set(values)];
const factState = (status: ClaimStatus | FactState | undefined): FactState => status === "VERIFIED" ? "KNOWN" : status ?? "UNKNOWN";

function targetForId(run: ResearchResult, id: string): ComparisonTarget {
  if (id.startsWith("candidate_")) {
    const mapped = run.candidateIdMapping?.provisionalToCanonical[id];
    if (mapped && mapped !== id) throw new RangeError(`Candidate ${id} is provisional; use canonical candidate ID ${mapped} from run ${run.id}.`);
    const candidate = run.candidates.find((item) => item.id === id);
    if (!candidate || !run.candidateIdMapping.canonicalIds.includes(id)) {
      throw new RangeError(`Candidate ${id} was not found in run ${run.id}; do not mix candidate IDs from another run.`);
    }
    const lifecycle = run.candidateLifecycles.find((item) => item.candidateId === id);
    const rejected = run.rejectedIdeas.find((item) => item.candidateId === id);
    return {
      id, entityType: "candidate", name: candidate.name,
      lifecycle: lifecycle?.classification ?? (rejected ? "killed" : "discovered"),
      killed: lifecycle?.classification === "killed" || Boolean(rejected),
      killReason: lifecycle?.exactKillReason ?? rejected?.reason ?? null,
      candidate, gap: null,
    };
  }
  const gap = run.gaps.find((item) => item.id === id);
  if (!gap) throw new RangeError(`Gap ${id} was not found in run ${run.id}; do not mix gap IDs from another run.`);
  return { id, entityType: "gap", name: gap.problemStatement, lifecycle: "gap_only", killed: false, killReason: null, candidate: null, gap };
}

function cite(run: ResearchResult, evidenceIds: string[]) {
  const wanted = new Set(evidenceIds);
  return run.sources.filter((item) => wanted.has(item.id)).slice(0, 8).map((item) => ({ id: item.id, title: item.title, url: item.sourceUrl }));
}

function cell(run: ResearchResult, targetId: string, state: FactState, assessment: string, evidenceIds: string[]): ComparisonCell {
  const resolved = unique(evidenceIds).filter((id) => run.sources.some((item) => item.id === id));
  return { targetId, state, assessment, evidenceIds: resolved, citations: cite(run, resolved) };
}

function candidateCell(run: ResearchResult, target: ComparisonTarget, dimension: RunCandidateComparisonDimension): ComparisonCell {
  const candidate = target.candidate!;
  const opportunity = run.finalOpportunities.find((item) => item.candidate.id === candidate.id);
  const score = opportunity?.score ?? run.opportunityScores.find((item) => item.candidateId === candidate.id);
  const gate = opportunity?.evidenceGate ?? run.evidenceGates.find((item) => item.candidateId === candidate.id);
  const falsification = opportunity?.falsification ?? run.falsificationResults.find((item) => item.candidateId === candidate.id);
  const assumptions = opportunity?.assumptionLedger ?? run.assumptionLedger.filter((item) => item.candidateId === candidate.id);
  const scorecard = score?.scorecard;
  const factor = score?.decisionFactors;
  const hypothesis = (name: "competition" | "switching_cost" | "regulation" | "liability") => falsification?.hypotheses.find((item) => item.dimension === name);
  if (dimension === "buyer_specificity") {
    const definition = candidate.definition;
    const specific = Boolean(definition?.buyer && definition?.decisionMaker && candidate.targetCustomer);
    return cell(run, target.id, specific && gate?.checks.buyerSpecificity ? "INFERRED" : "UNKNOWN",
      specific ? `${definition!.buyer}; decision maker: ${definition!.decisionMaker}; target customer: ${candidate.targetCustomer}.` : "Buyer and decision-maker specificity is incomplete in the stored candidate definition.",
      candidate.evidenceIds);
  }
  if (dimension === "pain_evidence") {
    const severity = scorecard?.painSeverity;
    const frequency = scorecard?.painFrequency;
    return cell(run, target.id, factState(severity?.status ?? factor?.demandSignal.status),
      severity && frequency ? `${severity.rationale} ${frequency.rationale} Gate observed ${gate?.observed.independentPainSignals ?? 0} independent pain signal(s).` : "Pain severity or frequency remains UNKNOWN in the stored run.",
      [...(severity?.evidenceIds ?? []), ...(frequency?.evidenceIds ?? []), ...(factor?.demandSignal.evidenceIds ?? [])]);
  }
  if (dimension === "spend_wtp_evidence") {
    const spend = scorecard?.existingSpend;
    const wtp = scorecard?.willingnessToPay;
    return cell(run, target.id, factState(spend?.status ?? wtp?.status),
      spend || wtp ? `${spend?.rationale ?? "Existing spend is UNKNOWN."} ${wtp?.rationale ?? "Willingness to pay is UNKNOWN."} Gate observed ${gate?.observed.independentSpendSignals ?? 0} independent spend signal(s).` : "Existing spend and willingness-to-pay evidence remain UNKNOWN.",
      [...(spend?.evidenceIds ?? []), ...(wtp?.evidenceIds ?? [])]);
  }
  if (dimension === "residual_gap") return cell(run, target.id,
    falsification?.residualUnmetDemand.conclusion === "adequately_solved" ? "CONTRADICTED" : falsification?.residualUnmetDemand.meaningfulResidualGap ? "INFERRED" : "UNKNOWN",
    falsification?.residualUnmetDemand.rationale ?? "No stored residual-unmet-demand assessment reached this candidate.", falsification?.residualUnmetDemand.evidenceIds ?? []);
  if (dimension === "competition_collision") {
    const competition = hypothesis("competition");
    const nearest = score?.noveltyScore;
    const recall = run.competitorRecall.candidates.find((item) => item.candidateId === candidate.id);
    return cell(run, target.id, competition ? factState(competition.claimStatus) : nearest ? "INFERRED" : "UNKNOWN",
      nearest ? `${nearest.collisionDetected ? "A collision was detected" : "No material collision was recorded"}; closest stored competitor=${nearest.closestCompetitorId ?? "UNKNOWN"}. ${recall?.explanation ?? "Competitor recall for this candidate is incomplete or unavailable."}` : "Competition and collision remain UNKNOWN for this candidate.",
      [...(competition?.supportingEvidenceIds ?? []), ...(competition?.counterEvidenceIds ?? []), ...(falsification?.residualUnmetDemand.evidenceIds ?? [])]);
  }
  if (dimension === "differentiation") return cell(run, target.id, factState(factor?.noveltyDifferentiation.status), factor?.noveltyDifferentiation.rationale ?? "Differentiation remains UNKNOWN.", factor?.noveltyDifferentiation.evidenceIds ?? []);
  if (dimension === "feasibility") return cell(run, target.id, factState(factor?.feasibility.status), factor?.feasibility.rationale ?? "Feasibility remains UNKNOWN.", factor?.feasibility.evidenceIds ?? []);
  if (dimension === "distribution") return cell(run, target.id, factState(factor?.distribution.status), factor?.distribution.rationale ?? "Distribution remains UNKNOWN.", factor?.distribution.evidenceIds ?? []);
  if (dimension === "switching_friction") {
    const switching = hypothesis("switching_cost");
    return cell(run, target.id, factState(switching?.claimStatus ?? scorecard?.switchingCosts.status), switching?.rationale ?? scorecard?.switchingCosts.rationale ?? "Switching friction remains UNKNOWN.", [...(switching?.counterEvidenceIds ?? []), ...(switching?.supportingEvidenceIds ?? []), ...(scorecard?.switchingCosts.evidenceIds ?? [])]);
  }
  if (dimension === "regulation_liability") {
    const regulation = hypothesis("regulation");
    const liability = hypothesis("liability");
    return cell(run, target.id, factState(regulation?.claimStatus ?? liability?.claimStatus ?? factor?.regulatoryRisk.status),
      [regulation?.rationale, liability?.rationale, factor?.regulatoryRisk.rationale].filter(Boolean).join(" ") || "Regulation and liability remain UNKNOWN.",
      [...(regulation?.counterEvidenceIds ?? []), ...(liability?.counterEvidenceIds ?? []), ...(factor?.regulatoryRisk.evidenceIds ?? [])]);
  }
  if (dimension === "evidence_confidence") return cell(run, target.id, score?.evidenceConfidence.label === "high" ? "KNOWN" : score ? "INFERRED" : "UNKNOWN",
    score ? `${score.evidenceConfidence.label} recorded evidence confidence (${score.evidenceConfidence.score}/100 heuristic): ${score.evidenceConfidence.rationale}` : "Evidence confidence was not scored for this candidate.",
    candidate.evidenceIds);
  if (dimension === "unresolved_critical_assumptions") {
    const unresolved = assumptions.filter((item) => ["CRITICAL", "UNTESTED", "WEAK"].includes(item.status));
    return cell(run, target.id, unresolved.length ? "UNKNOWN" : assumptions.length ? "KNOWN" : "UNKNOWN",
      unresolved.length ? unresolved.map((item) => `${item.status}: ${item.assumption}; resolve with ${item.researchToResolve ?? "the recorded kill criterion"}.`).join(" ") : assumptions.length ? "No unresolved CRITICAL, UNTESTED, or WEAK assumption remains in the stored ledger." : "No assumption-ledger evidence is available for this candidate.",
      unresolved.flatMap((item) => [...item.supportingEvidenceIds, ...item.contradictingEvidenceIds]));
  }
  if (dimension === "strongest_counterevidence") {
    const decisive = falsification?.decisiveRisks.slice().sort((a, b) => b.risk - a.risk)[0];
    const rejected = run.rejectedIdeas.find((item) => item.candidateId === candidate.id);
    return cell(run, target.id, target.killed ? "CONTRADICTED" : decisive ? factState(decisive.status) : "UNKNOWN",
      target.killReason ?? decisive?.reason ?? rejected?.reason ?? "No decisive counterevidence was established; this remains UNKNOWN rather than cleared.",
      decisive?.evidenceIds ?? rejected?.evidenceIds ?? []);
  }
  const nextAction = opportunity?.validationExperiment ?? run.validationExperiments.find((item) => item.candidateId === candidate.id);
  const unresolved = assumptions.find((item) => ["CRITICAL", "UNTESTED", "WEAK"].includes(item.status));
  return cell(run, target.id, nextAction ? "INFERRED" : "UNKNOWN",
    nextAction ? `${nextAction.action} Success: ${nextAction.successThreshold} Failure: ${nextAction.failureThreshold}` : unresolved?.researchToResolve ?? "No candidate-specific validation action is recorded; the next action is UNKNOWN.",
    candidate.evidenceIds);
}

function gapCell(run: ResearchResult, target: ComparisonTarget, dimension: RunCandidateComparisonDimension): ComparisonCell {
  const gap = target.gap!;
  const supporting = gap.supportingEvidenceIds;
  const counter = gap.counterEvidenceIds;
  if (dimension === "buyer_specificity") return cell(run, target.id, gap.affectedSegment ? "INFERRED" : "UNKNOWN", gap.affectedSegment ? `Affected segment: ${gap.affectedSegment}. A distinct buyer or decision maker is not guaranteed by a gap record.` : "Affected segment and buyer are UNKNOWN.", supporting);
  if (dimension === "pain_evidence") return cell(run, target.id, supporting.length ? "INFERRED" : "UNKNOWN", `${gap.problemStatement} Current workaround: ${gap.currentWorkaround ?? "UNKNOWN"}.`, supporting);
  if (dimension === "spend_wtp_evidence") return cell(run, target.id, gap.willingnessToPaySignal ? "INFERRED" : "UNKNOWN", gap.willingnessToPaySignal ?? "Willingness-to-pay evidence is UNKNOWN.", supporting);
  if (dimension === "residual_gap") return cell(run, target.id, gap.confidenceLabel === "evidence-backed market gap" ? "KNOWN" : supporting.length ? "INFERRED" : "UNKNOWN", `${gap.problemStatement} Existing solutions: ${gap.existingSolutions.join(", ") || "UNKNOWN"}. Why they fail: ${gap.whySolutionsFail || "UNKNOWN"}.`, [...supporting, ...counter]);
  if (dimension === "competition_collision") return cell(run, target.id, gap.competitiveDensity === "unknown" ? "UNKNOWN" : "INFERRED", `Competitive density: ${gap.competitiveDensity}.`, [...supporting, ...counter]);
  if (dimension === "feasibility") return cell(run, target.id, gap.implementationDifficulty === "unknown" ? "UNKNOWN" : "INFERRED", `Implementation difficulty: ${gap.implementationDifficulty}.`, supporting);
  if (dimension === "evidence_confidence") return cell(run, target.id, gap.confidenceLabel === "evidence-backed market gap" ? "KNOWN" : supporting.length ? "INFERRED" : "UNKNOWN", `${gap.confidenceLabel}; ${supporting.length} supporting and ${counter.length} counterevidence record(s).`, [...supporting, ...counter]);
  if (dimension === "strongest_counterevidence") return cell(run, target.id, counter.length ? "CONTRADICTED" : "UNKNOWN", counter.length ? "Stored counterevidence exists; inspect the cited records before promoting this gap." : "No counterevidence was recorded; absence is not proof that the risk is cleared.", counter);
  const related = run.candidates.find((item) => item.sourceGapIds.includes(gap.id));
  if (dimension === "next_validation_action" && related) {
    const relatedCell = candidateCell(run, targetForId(run, related.id), dimension);
    return { ...relatedCell, targetId: target.id, assessment: `Related canonical candidate ${related.id}: ${relatedCell.assessment}` };
  }
  return cell(run, target.id, "UNKNOWN", `${dimension.replaceAll("_", " ")} is not established by this stored gap record${related ? "; compare the related canonical candidate for candidate-level analysis" : ""}.`, [...supporting, ...counter]);
}

export function compareRunCandidates(run: ResearchResult, ids: string[], dimensions?: RunCandidateComparisonDimension[]) {
  if (ids.length < 2 || ids.length > 5) throw new RangeError("compare_run_candidates requires 2–5 candidate or gap IDs from one stored run.");
  if (new Set(ids).size !== ids.length) throw new RangeError("compare_run_candidates IDs must be unique.");
  const selectedDimensions = dimensions?.length ? unique(dimensions) as RunCandidateComparisonDimension[] : [...RUN_CANDIDATE_COMPARISON_DIMENSIONS];
  const targets = ids.map((id) => targetForId(run, id));
  const rows = selectedDimensions.map((dimension) => ({
    dimension,
    cells: targets.map((target) => target.entityType === "candidate" ? candidateCell(run, target, dimension) : gapCell(run, target, dimension)),
  }));
  const unknownCount = rows.flatMap((row) => row.cells).filter((item) => item.state === "UNKNOWN").length;
  const killed = targets.filter((item) => item.killed);
  const uncertaintyNotes = [
    "No aggregate winner or synthetic precision is computed; compare the recorded qualitative states, evidence, counterevidence, and validation actions.",
    unknownCount ? `${unknownCount} comparison cell(s) remain explicitly UNKNOWN because the stored run does not support a stronger conclusion.` : null,
    killed.length ? `${killed.length} killed candidate(s) remain labeled KILLED with their exact recorded reason and are not resurrected by this comparison.` : null,
  ].filter((item): item is string => Boolean(item));
  return {
    runId: run.id,
    query: run.query,
    comparedAt: new Date().toISOString(),
    sourcePolicy: "stored_run_only" as const,
    providerCalls: 0,
    targets: targets.map((target) => ({ id: target.id, entityType: target.entityType, name: target.name, lifecycle: target.lifecycle, killed: target.killed, killReason: target.killReason })),
    dimensions: rows,
    uncertaintyNotes,
    conclusion: killed.length === targets.length
      ? "Every compared candidate was killed in the stored run; comparison does not revive them. Use the recorded kill reasons and validation actions before considering new research."
      : unknownCount > rows.length * targets.length / 2
        ? "The stored evidence is insufficient for a confident side-by-side choice. Resolve the listed UNKNOWNs using the recorded next validation actions."
        : "The stored run supports a qualitative side-by-side comparison. Any tie remains unresolved unless the cited evidence and validation outcomes distinguish it.",
  };
}

export type RunCandidateComparisonResult = ReturnType<typeof compareRunCandidates>;

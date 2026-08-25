import { createHash } from "node:crypto";
import { falsifyCandidate } from "../research/falsification.ts";
import { normalizeResults } from "../research/normalize.ts";
import { getConfiguredProvider } from "../research/providers.ts";
import { getResearchResultById } from "../research/store.ts";
import { researchLimits } from "../research/pipeline.ts";
import type { CandidateGap, IdeaCandidate, SearchAngle } from "../research/types.ts";

function focusedAngles(opportunity: string, limit: number): SearchAngle[] {
  const base = opportunity.replace(/\s+/g, " ").trim().slice(0, 700);
  const definitions: Array<Pick<SearchAngle, "kind" | "purpose"> & { suffix: string }> = [
    { kind: "direct_competitors", suffix: "existing products competitors already solve alternative", purpose: "Counterevidence from direct competitors and adequate existing solutions" },
    { kind: "customer_complaints", suffix: "failed product customer rejection low demand would not pay", purpose: "Counterevidence about demand, adoption, and willingness to pay" },
    { kind: "substitutes", suffix: "startup shut down failure economics acquisition support cost", purpose: "Counterevidence from failed attempts and unfavorable economics" },
    { kind: "change_signals", suffix: "regulation liability privacy security technical limitation", purpose: "Counterevidence from regulation, liability, trust, and feasibility constraints" },
  ];
  return definitions.slice(0, limit).map((item, index) => ({
    id: `falsify_${index + 1}_${createHash("sha1").update(`${base}:${item.kind}`).digest("hex").slice(0, 7)}`,
    kind: item.kind, query: `${base} ${item.suffix}`, purpose: item.purpose, targetedDomains: [],
  }));
}

function syntheticCandidate(opportunity: string): IdeaCandidate {
  const id = `candidate_external_${createHash("sha1").update(opportunity).digest("hex").slice(0, 10)}`;
  const name = opportunity.split(/[.!?\n]/)[0].trim().slice(0, 100) || "External candidate";
  return {
    id, name, summary: opportunity, targetCustomer: null, payer: null,
    jobToBeDone: "unknown from supplied candidate", mechanism: opportunity,
    interface: "unknown", technology: null, businessModel: null, distribution: null,
    dataSource: null, ownershipModel: null, workflowPosition: "unknown", differentiator: "unknown",
    sourceGapIds: ["gap_external"], sourceGraphHoleIds: [], sourceContradictionIds: [], sourceStitchingIds: [],
    sourceSignalIds: [], sourceFailedAttemptIds: [], evidenceIds: [], iteration: 0,
    rootCandidateId: id, mechanismFamily: "externally supplied mechanism", crossDomainTransfer: null,
  };
}

export async function activelyFalsifyOpportunity(input: { opportunity: string; run_id?: string; candidate_id?: string }) {
  const prior = input.run_id ? await getResearchResultById(input.run_id) : null;
  if (input.run_id && !prior) throw new RangeError(`Research run ${input.run_id} was not found or has expired.`);
  const candidate = input.candidate_id
    ? prior?.candidates.find((item) => item.id === input.candidate_id)
    : undefined;
  if (input.candidate_id && !candidate) throw new RangeError(`Candidate ${input.candidate_id} was not found in run ${input.run_id}.`);

  const limits = researchLimits();
  const configured = Number.parseInt(process.env.MCP_FALSIFICATION_MAX_QUERIES ?? "4", 10);
  const searchCount = Math.min(4, limits.maxProviderCalls, Number.isFinite(configured) ? Math.max(1, configured) : 4);
  const angles = focusedAngles(input.opportunity, searchCount);
  const provider = getConfiguredProvider();
  const settled = await Promise.allSettled(angles.map(async (angle) => ({
    angle,
    results: await provider.search(angle.query, { limit: Math.min(5, limits.resultsPerQuery), signal: AbortSignal.timeout(limits.timeoutMs) }),
  })));
  const successful = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  const errors = settled.flatMap((item, index) => item.status === "rejected" ? [`${angles[index].kind}: ${item.reason instanceof Error ? item.reason.message : "provider error"}`] : []);
  if (successful.length === 0) throw new Error(`All focused counterevidence searches failed. ${errors[0] ?? "Provider returned no response."}`);
  const newEvidence = normalizeResults(successful, new Date().toISOString(), 20);
  if (newEvidence.length === 0) throw new Error("Focused searches returned no usable public counterevidence. Risks remain unknown; no evidence was fabricated.");

  const selected = candidate ?? syntheticCandidate(input.opportunity);
  const sourceGaps = prior?.gaps.filter((gap) => selected.sourceGapIds.includes(gap.id)) ?? [];
  const externalGap: CandidateGap = {
    id: "gap_external", problemStatement: input.opportunity, affectedSegment: null, currentWorkaround: null,
    existingSolutions: [], whySolutionsFail: "unknown", supportingEvidenceIds: [], counterEvidenceIds: [],
    competitiveDensity: "unknown", willingnessToPaySignal: null, implementationDifficulty: "unknown", timingSignal: null,
    gapType: "isolated", score: 0,
    scoreFactors: { painSeverity: 0, complaintRecurrence: 0, currentSolutionWeakness: 0, competitiveWhitespace: 0, differentiationPotential: 0, willingnessToPay: 0, timing: 0, implementationFeasibility: 0, distributionAccessibility: 0, defensibility: 0 },
    penalties: [{ code: "weak_evidence", points: 20, reason: "No prior structured gap was supplied." }], confidence: 0,
    confidenceLabel: "speculative opportunity",
  };
  const gaps: CandidateGap[] = (sourceGaps.length ? sourceGaps : [externalGap]).map((gap) => ({ ...gap, counterEvidenceIds: [...new Set([...gap.counterEvidenceIds, ...newEvidence.map((item) => item.id)])] }));
  const evidence = [...(prior?.sources ?? []), ...newEvidence.filter((item) => !prior?.sources.some((existing) => existing.id === item.id))];
  const result = falsifyCandidate(selected, { evidence, gaps, similarities: prior?.similarities ?? [] });
  const citedIds = new Set(result.hypotheses.flatMap((item) => [...item.supportingEvidenceIds, ...item.counterEvidenceIds]));
  return {
    candidate: { id: selected.id, name: selected.name, summary: selected.summary, targetCustomer: selected.targetCustomer, mechanism: selected.mechanism },
    priorRunId: prior?.id ?? null, provider: { id: provider.id, displayName: provider.displayName },
    activeSearch: { requestedQueries: angles.length, successfulQueries: successful.length, sourceCount: newEvidence.length, errors },
    falsification: result,
    citations: evidence.filter((item) => citedIds.has(item.id)).slice(0, 20).map((item) => ({ id: item.id, title: item.title, url: item.sourceUrl, confidence: item.confidence })),
    explicitUnknowns: result.hypotheses.filter((item) => item.unknown).map((item) => item.dimension),
    warning: "Focused search results are counterevidence inputs, not proof that every claim in their snippets is correct. The survival score is a heuristic.",
  };
}

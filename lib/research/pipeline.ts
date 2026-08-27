import { randomUUID } from "node:crypto";
import { deriveBusinessSearchAngles, deriveSearchAngles, deriveFalsificationAngles, buildProviderQuery } from "./angles.ts";
import { clusterComplaints, detectUnderservedSegments, extractCompetitors } from "./analyze.ts";
import { detectGaps } from "./gaps.ts";
import { canonicalizeQuery, normalizeResults } from "./normalize.ts";
import { getConfiguredProvider } from "./providers.ts";
import { runOpportunityPipeline } from "./opportunity-pipeline.ts";
import { assessCoverage, decideStop, isRegulatedQuery } from "./quality.ts";
import { buildFinalOutput } from "./final-output.ts";
import { findCachedResearch, saveResearchResult } from "./store.ts";
import { RESEARCH_SCHEMA_VERSION, type IdeationContext, type ResearchLimits, type ResearchRequestOptions, type ResearchResult } from "./types.ts";
import { assertSurvivorGates, buildRoleOutputs, checkpoint, validateEvidenceReferences } from "./governance.ts";
import { createEvidenceSnapshot } from "./snapshots.ts";
import { buildCompanyProfile } from "./company.ts";
import { deriveExpansionBranches } from "./expansion.ts";
import { RESEARCH_ENGINE_VERSION, type ResearchDepth, type SearchAngle, type SearchBranch } from "./types.ts";

const absoluteMax = (raw: string | undefined, fallback: number, max: number) => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : fallback;
};
const absoluteMaxZero = (raw: string | undefined, fallback: number, max: number) => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;
};

export function researchLimits(env: NodeJS.ProcessEnv = process.env, depth: ResearchDepth = "standard"): ResearchLimits {
  const depthQueryCap = depth === "fast" ? 6 : 12;
  const maxSearchQueries = Math.min(depthQueryCap, absoluteMax(env.RESEARCH_MAX_QUERIES, depthQueryCap, 12));
  const resultsPerQuery = absoluteMax(env.RESEARCH_RESULTS_PER_QUERY, depth === "fast" ? 4 : depth === "deep" ? 10 : 6, 10);
  const maxProviderCalls = absoluteMax(env.RESEARCH_MAX_PROVIDER_CALLS, maxSearchQueries, 12);
  return {
    maxQueryLength: 500, maxSearchQueries: Math.min(maxSearchQueries, maxProviderCalls), resultsPerQuery,
    maxSources: Math.min(80, maxSearchQueries * resultsPerQuery), maxCandidates: absoluteMax(env.RESEARCH_MAX_CANDIDATES, 30, 48),
    maxModelIterations: absoluteMaxZero(env.RESEARCH_MAX_MODEL_ITERATIONS, 0, 6),
    maxSurvivorIterations: absoluteMax(env.RESEARCH_MAX_SURVIVOR_ITERATIONS, 1, 1),
    maxProviderCalls,
    maxCounterevidenceSearches: Math.min(depth === "fast" ? 1 : depth === "standard" ? 2 : 4, absoluteMax(env.RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES, depth === "deep" ? 4 : 2, 4)),
    maxAgentCalls: absoluteMaxZero(env.RESEARCH_MAX_AGENT_CALLS, 0, 8),
    maxProviderSpendCredits: absoluteMax(env.RESEARCH_MAX_PROVIDER_SPEND_CREDITS, maxProviderCalls, 12),
    maxConcurrency: absoluteMax(env.RESEARCH_MAX_CONCURRENCY, 3, 6),
    maxRetriesPerSearch: absoluteMax(env.RESEARCH_MAX_RETRIES_PER_SEARCH, 1, 2),
    timeoutMs: absoluteMax(env.RESEARCH_TIMEOUT_MS, 15_000, 30_000),
    maxExpansionBranches: depth === "fast" ? 0 : absoluteMaxZero(env.RESEARCH_MAX_EXPANSION_BRANCHES, depth === "deep" ? 4 : 2, 4),
    maxRunDurationMs: absoluteMax(env.RESEARCH_MAX_RUN_DURATION_MS, depth === "fast" ? 20_000 : depth === "deep" ? 120_000 : 55_000, 120_000),
  };
}

function cacheTtlSeconds(): number {
  return absoluteMax(process.env.RESEARCH_CACHE_TTL_SECONDS, 86_400, 604_800);
}

async function searchWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const output: PromiseSettledResult<T>[] = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      try {
        output[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (reason) {
        output[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return output;
}

function ideationContext(result: Omit<ResearchResult, "ideationContext">): IdeationContext {
  const topGaps = result.gaps.slice(0, 5).map(({ id, problemStatement, affectedSegment, currentWorkaround, existingSolutions, whySolutionsFail, supportingEvidenceIds, counterEvidenceIds, score, confidenceLabel }) => ({
    id, problemStatement, affectedSegment, currentWorkaround, existingSolutions, whySolutionsFail, supportingEvidenceIds, counterEvidenceIds, score, confidenceLabel,
  }));
  const selectedEvidenceIds = new Set(topGaps.flatMap((gap) => [...gap.supportingEvidenceIds, ...gap.counterEvidenceIds]));
  const competitors = result.competitors.slice(0, 8).map(({ id, name, website, pricing, keyFeatures, likelyWeaknesses, evidenceIds }) => ({ id, name, website, pricing, keyFeatures, likelyWeaknesses, evidenceIds }));
  competitors.flatMap((item) => item.evidenceIds).forEach((id) => selectedEvidenceIds.add(id));
  result.finalOpportunities.flatMap((item) => [
    ...item.candidate.evidenceIds,
    ...item.falsification.hypotheses.flatMap((hypothesis) => [...hypothesis.supportingEvidenceIds, ...hypothesis.counterEvidenceIds]),
  ]).forEach((id) => selectedEvidenceIds.add(id));
  return {
    instruction: "Use finalOutput and ranked survivors as the starting point. Preserve VERIFIED, INFERRED, and UNKNOWN claim labels. Cite evidence IDs using sourceUrl. A missing competitor is a search result, not a validated opportunity; competitor existence validates a possible job but is not an automatic veto. Use residualUnmetDemand to distinguish market crowding from adequate same-user/same-job resolution. Scores are heuristics and must stay paired with written reasoning. Never revive rejected candidates without new evidence and a bounded mutation/falsification pass.",
    topGaps,
    competitors,
    evidence: result.sources.filter((item) => selectedEvidenceIds.has(item.id)),
    graphHoles: result.graphHoles.slice(0, 8),
    contradictions: result.contradictions.slice(0, 8),
    stitchingPatterns: result.stitchingPatterns.slice(0, 6),
    weakSignals: result.weakSignals.slice(0, 6),
    resurrectionOpportunities: result.failedAttempts.filter((item) => item.resurrectionEligible).slice(0, 4),
    finalOpportunities: result.finalOpportunities,
    finalOutput: result.output,
    budgetUsage: result.budgetUsage,
  };
}

function providerFailure(error: unknown): { category: string; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : "unknown provider error";
  const category = /abort|time(?:d)?\s*out/i.test(message) ? "TIMEOUT" : /429|rate/i.test(message) ? "RATE_LIMIT"
    : /json|malformed|schema|array/i.test(message) ? "MALFORMED_RESPONSE" : /HTTP 5\d\d/i.test(message) ? "UPSTREAM_5XX" : "PROVIDER_ERROR";
  return { category, message, retryable: ["TIMEOUT", "RATE_LIMIT", "UPSTREAM_5XX"].includes(category) };
}

export async function runResearch(rawQuery: string, options: ResearchRequestOptions = {}): Promise<ResearchResult> {
  const depth = options.depth ?? "standard";
  const limits = researchLimits(process.env, depth);
  const wallStartedAt = Date.now();
  const query = rawQuery.trim();
  const mode = options.mode ?? "research_market";
  if (query.length < 8) throw new RangeError("Research query must be at least 8 characters.");
  if (query.length > limits.maxQueryLength) throw new RangeError(`Research query must be ${limits.maxQueryLength} characters or fewer.`);
  const canonicalQuery = canonicalizeQuery(`${mode} ${query}`);
  const provider = options.provider ?? getConfiguredProvider();
  const ttl = cacheTtlSeconds();
  if (!options.bypassCache) {
    const cached = await findCachedResearch(canonicalQuery, provider.id, ttl);
    if (cached) {
      cached.cache = { hit: true, matchedRunId: cached.id };
      return cached;
    }
  }

  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  let providerCalls = 0;
  const failures: string[] = [];
  const executeAngles = async (angles: ReturnType<typeof deriveSearchAngles>) => {
    const settled = await searchWithConcurrency(angles.map((angle) => async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= limits.maxRetriesPerSearch + 1; attempt += 1) {
        if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Research cancelled.", "AbortError");
        if (Date.now() - wallStartedAt >= limits.maxRunDurationMs) throw new DOMException("Hard research time budget exhausted.", "TimeoutError");
        if (providerCalls >= Math.min(limits.maxProviderCalls, limits.maxProviderSpendCredits)) throw new Error("Provider-call or spend-credit budget exhausted before this angle could complete.");
        providerCalls += 1;
        try {
          const timeoutSignal = AbortSignal.timeout(Math.min(limits.timeoutMs, Math.max(1, limits.maxRunDurationMs - (Date.now() - wallStartedAt))));
          const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
          const results = await provider.search(buildProviderQuery(angle), { limit: limits.resultsPerQuery, signal });
          if (!Array.isArray(results)) throw new TypeError("Search provider returned a malformed response instead of a result array.");
          return { angle, results: results.filter((item) => item && typeof item.url === "string" && typeof item.title === "string" && typeof item.snippet === "string") };
        } catch (error) {
          lastError = error;
          if (!providerFailure(error).retryable || attempt === limits.maxRetriesPerSearch + 1) throw error;
        }
      }
      throw lastError;
    }), limits.maxConcurrency);
    settled.forEach((item, index) => {
      if (item.status === "rejected") {
        const detail = providerFailure(item.reason);
        failures.push(`Search angle ${angles[index].kind} failed [${detail.category}]: ${detail.message}`);
      }
    });
    return settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  };

  const landscapeAngleBudget = Math.min(depth === "fast" ? 6 : 8, limits.maxSearchQueries);
  const landscapeAngles = mode === "find_business"
    ? deriveBusinessSearchAngles(query, landscapeAngleBudget)
    : deriveSearchAngles(query, landscapeAngleBudget);
  const landscapeResults = await executeAngles(landscapeAngles);
  const provisionalSources = normalizeResults(landscapeResults, now().toISOString(), limits.maxSources);
  const provisionalCompetitors = extractCompetitors(provisionalSources);
  const provisionalComplaints = clusterComplaints(provisionalSources);
  const provisionalSegments = detectUnderservedSegments(provisionalSources);
  const provisionalGaps = detectGaps(provisionalSources, provisionalCompetitors, provisionalComplaints, provisionalSegments);
  const provisionalCoverage = assessCoverage({
    angles: landscapeAngles, successfulAngleIds: landscapeResults.map((item) => item.angle.id), evidence: provisionalSources,
    regulatedMarket: isRegulatedQuery(query),
  });
  const provisionalStop = decideStop({ coverage: provisionalCoverage, gaps: provisionalGaps, competitors: provisionalCompetitors });
  let provisionalOpportunity = runOpportunityPipeline({
    query, sources: provisionalSources, competitors: provisionalCompetitors, complaints: provisionalComplaints,
    segments: provisionalSegments, gaps: provisionalGaps, limits, now: now(), allowGeneration: provisionalStop.canGenerateCandidates,
    excludedMechanisms: options.userContext?.previouslyRejectedMechanisms, userContext: options.userContext, depth,
  });
  let searchBranches: SearchBranch[] = [];
  let expansionAngles: SearchAngle[] = [];
  let expansionResults: Awaited<ReturnType<typeof executeAngles>> = [];
  let focusSources = provisionalSources;
  let focusCompetitors = provisionalCompetitors;
  let focusComplaints = provisionalComplaints;
  let focusSegments = provisionalSegments;
  let focusGaps = provisionalGaps;
  const weakInitialSurvivors = provisionalOpportunity.finalOpportunities.length === 0
    || provisionalOpportunity.finalOpportunities.every((item) => item.adversarialReview.judge.verdict !== "SURVIVES");
  if (weakInitialSurvivors && limits.maxExpansionBranches > 0) {
    const available = Math.min(limits.maxExpansionBranches, limits.maxSearchQueries - landscapeAngles.length, limits.maxProviderCalls - providerCalls, limits.maxProviderSpendCredits - providerCalls);
    if (available > 0) {
      const expansion = deriveExpansionBranches(query, provisionalOpportunity.rejectedIdeas.map((item) => item.reason), available);
      searchBranches = expansion.branches;
      expansionAngles = expansion.angles;
      expansionResults = await executeAngles(expansion.angles);
      focusSources = normalizeResults([...landscapeResults, ...expansionResults], now().toISOString(), limits.maxSources);
      focusCompetitors = extractCompetitors(focusSources);
      focusComplaints = clusterComplaints(focusSources);
      focusSegments = detectUnderservedSegments(focusSources);
      focusGaps = detectGaps(focusSources, focusCompetitors, focusComplaints, focusSegments);
      const focusCoverage = assessCoverage({ angles: [...landscapeAngles, ...expansion.angles], successfulAngleIds: [...landscapeResults, ...expansionResults].map((item) => item.angle.id), evidence: focusSources, regulatedMarket: isRegulatedQuery(query) });
      const focusStop = decideStop({ coverage: focusCoverage, gaps: focusGaps, competitors: focusCompetitors });
      provisionalOpportunity = runOpportunityPipeline({ query, sources: focusSources, competitors: focusCompetitors, complaints: focusComplaints, segments: focusSegments, gaps: focusGaps, limits, now: now(), allowGeneration: focusStop.canGenerateCandidates, excludedMechanisms: options.userContext?.previouslyRejectedMechanisms, userContext: options.userContext, depth });
      if (expansionResults.length === 0) searchBranches = searchBranches.map((branch) => ({ ...branch, status: "no_new_evidence" }));
    }
  }
  const seenMechanisms = new Set<string>();
  const candidateFocus = provisionalOpportunity.candidates.filter((candidate) => candidate.iteration === 0 && !seenMechanisms.has(candidate.mechanismFamily) && seenMechanisms.add(candidate.mechanismFamily)).map((candidate) =>
    `${candidate.mechanismFamily} for ${candidate.targetCustomer ?? "unknown"}: ${candidate.differentiator}`,
  );
  const remainingAngles = Math.min(limits.maxCounterevidenceSearches, limits.maxSearchQueries - landscapeAngles.length - expansionAngles.length, limits.maxProviderCalls - providerCalls, limits.maxProviderSpendCredits - providerCalls);
  const falsificationAngles = candidateFocus.length && remainingAngles > 0
    ? deriveFalsificationAngles(query, candidateFocus, remainingAngles)
    : [];
  const falsificationResults = falsificationAngles.length ? await executeAngles(falsificationAngles) : [];
  const searchAngles = [...landscapeAngles, ...expansionAngles, ...falsificationAngles];
  const successful = [...landscapeResults, ...expansionResults, ...falsificationResults];

  const retrievedAt = now().toISOString();
  const sources = normalizeResults(successful, retrievedAt, limits.maxSources);
  const competitors = extractCompetitors(sources);
  const complaintClusters = clusterComplaints(sources);
  const underservedSegments = detectUnderservedSegments(sources);
  const gaps = detectGaps(sources, competitors, complaintClusters, underservedSegments);
  const successfulAngleIds = successful.map((item) => item.angle.id);
  const counterevidenceBudgetExhausted = focusGaps.length > 0 && falsificationAngles.length === 0;
  const coverage = assessCoverage({ angles: searchAngles, successfulAngleIds, evidence: sources, regulatedMarket: isRegulatedQuery(query), counterevidenceBudgetExhausted });
  const stopDecision = decideStop({ coverage, gaps, competitors });
  const opportunity = runOpportunityPipeline({ query, sources, competitors, complaints: complaintClusters, segments: underservedSegments, gaps, limits, now: now(), allowGeneration: stopDecision.canGenerateCandidates, excludedMechanisms: options.userContext?.previouslyRejectedMechanisms, userContext: options.userContext, depth });
  opportunity.budgetUsage.providerCalls = providerCalls;
  opportunity.budgetUsage.counterevidenceSearches = falsificationResults.length;
  opportunity.budgetUsage.estimatedProviderCredits = providerCalls;
  opportunity.budgetUsage.exhausted ||= providerCalls >= limits.maxProviderCalls;
  const warnings = [...failures];
  if (complaintClusters.length === 0) warnings.push("No supported complaint clusters were found; the result contains no inferred market gaps rather than manufacturing them.");
  if (gaps.length > 0 && gaps.every((gap) => gap.confidenceLabel === "speculative opportunity")) warnings.push("All detected openings remain speculative because retrieved support is weak or isolated.");
  if (sources.length === 0) warnings.push("No usable public sources were retrieved. The run is returned as insufficient evidence; no candidate was generated.");
  if (!falsificationAngles.length && focusGaps.length > 0) warnings.push("The provider-call budget left no room for active candidate counterevidence searches; falsification dimensions without evidence remain UNKNOWN.");
  if (searchBranches.length) warnings.push(`${searchBranches.length} adjacent search branch(es) were attempted because the initial niche produced no survival-gate candidate; exact failure reasons were carried forward as negative search memory.`);
  if (stopDecision.canGenerateCandidates && opportunity.finalOpportunities.length === 0) warnings.push("No candidate survived the bounded competitor, falsification, and mutation gates; the response intentionally contains no mediocre filler ideas.");
  if (stopDecision.status !== "proceed") warnings.push(...stopDecision.reasons);
  const injectionCount = sources.filter((item) => item.security.promptInjectionDetected).length;
  if (injectionCount) warnings.push(`${injectionCount} retrieved source record(s) contained instruction-like text; directives were ignored and the content remained untrusted research data.`);
  const output = buildFinalOutput({
    evidence: sources, competitors, gaps, signals: opportunity.weakSignals, candidates: opportunity.candidates,
    rejectedIdeas: opportunity.rejectedIdeas, survivors: opportunity.finalOpportunities, lineages: opportunity.lineages,
    validationExperiments: opportunity.validationExperiments, coverage, stopDecision,
  });
  const completedAt = now().toISOString();
  const companyProfile = mode === "research_company" ? buildCompanyProfile({
    query, evidence: sources, competitors, complaints: complaintClusters, segments: underservedSegments,
    opportunities: opportunity.finalOpportunities,
  }) : null;
  const roleOutputs = buildRoleOutputs({
    evidence: sources, competitors, complaints: complaintClusters, gaps, candidates: opportunity.candidates,
    falsificationResults: opportunity.falsificationResults,
    companyRecordIds: companyProfile ? [companyProfile.identity.id, ...companyProfile.productsServices.map((item) => item.id)] : undefined,
    sourceFailures: failures.length,
  });
  opportunity.budgetUsage.agentCalls = 0;
  opportunity.budgetUsage.gracefulDegradation = sources.length === 0 || stopDecision.status === "insufficient_evidence" ? "insufficient_evidence"
    : counterevidenceBudgetExhausted ? "counterevidence_budget_exhausted"
      : failures.length ? "partial_provider_failure" : "none";
  const checkpoints = [
    checkpoint("source_validation_deduplication", "passed", `${sources.length} normalized source records; ${coverage.duplicateClaimsCollapsed} duplicate or syndicated claims collapsed.`, completedAt),
    checkpoint("competitor_substitute_check", successful.some((item) => ["direct_competitors", "adjacent_categories", "active_falsification_competition"].includes(item.angle.kind)) ? "passed" : "failed", competitors.length ? `${competitors.length} supported competitors/substitutes inspected.` : "No supported competitor was found; coverage limitation remains visible.", completedAt),
    checkpoint("residual_gap_test", opportunity.candidates.length ? "passed" : "not_applicable", opportunity.candidates.length ? "Every promoted candidate received a structured residual-unmet-demand assessment during falsification." : "No candidate cleared the evidence gate.", completedAt),
    checkpoint("candidate_mechanism_deduplication", opportunity.candidates.length ? "passed" : "not_applicable", "Duplicate mechanism families were collapsed before final candidate count.", completedAt),
    checkpoint("falsification", opportunity.finalOpportunities.every((item) => item.falsification.outcome === "survived") ? "passed" : "failed", `${opportunity.falsificationResults.length} candidates received an adversarial falsification result.`, completedAt),
  ];
  const base = {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    engineVersion: RESEARCH_ENGINE_VERSION,
    id: `research_${now().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`,
    query,
    mode,
    depth,
    canonicalQuery,
    status: failures.length || stopDecision.status !== "proceed" ? "partial" as const : "complete" as const,
    startedAt,
    completedAt,
    provider: { id: provider.id, displayName: provider.displayName },
    cache: { hit: false, matchedRunId: null },
    limits,
    searchAngles,
    sources,
    competitors,
    complaintClusters,
    underservedSegments,
    gaps,
    searchBranches,
    ...opportunity,
    coverage,
    stopDecision,
    output,
    roleOutputs,
    checkpoints,
    evidenceSnapshot: createEvidenceSnapshot(sources, coverage, completedAt),
    companyProfile,
    warnings,
  };
  const result = { ...base } as Omit<ResearchResult, "ideationContext">;
  const invalidReferences = validateEvidenceReferences(result as ResearchResult);
  const gateErrors = assertSurvivorGates(result as ResearchResult);
  if (invalidReferences.length || gateErrors.length) throw new Error(`Research quality gate failed: ${[...invalidReferences.map((id) => `missing evidence ${id}`), ...gateErrors].join("; ")}`);
  result.checkpoints.push(checkpoint("citation_validation", "passed", "Every factual evidence ID in survivors, gaps, rejections, and falsification resolved to the immutable evidence snapshot.", completedAt));
  result.checkpoints.push(checkpoint("final_persistence", options.persist === false ? "not_applicable" : "passed", options.persist === false ? "Persistence was explicitly disabled for this run." : "The completed run and evidence snapshot are the object passed to durable/local persistence.", completedAt));
  const completeResult: ResearchResult = { ...result, ideationContext: ideationContext(result) };
  if (options.persist !== false) {
    const stored = await saveResearchResult(completeResult, ttl);
    if (!stored.durable) completeResult.warnings.push("This Vercel-compatible build uses in-memory cache in serverless mode; configure external durable storage before relying on run history across instances.");
  }
  return completeResult;
}

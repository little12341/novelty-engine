import { createHash, randomUUID } from "node:crypto";
import { deriveBusinessSearchAngles, deriveSearchAngles, deriveFalsificationAngles, deriveEvidenceGapAngles, buildProviderQuery } from "./angles.ts";
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
import { buildCompetitorRecallReport, credibleCompetitor, establishedCategory, planCompetitorDiscovery } from "./competitor-discovery.ts";
import { operationalLog, safeErrorCategory } from "../http-safety.ts";
import { buildResearchClaimLineage, citationCoverageAudit } from "./claim-support.ts";
import { buildCandidateIdMapping } from "./candidate-ids.ts";
import { suppliedSourcesToProvider } from "./supplied-sources.ts";
import type { SuppliedResearchSource } from "./types.ts";

const absoluteMax = (raw: string | undefined, fallback: number, max: number) => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : fallback;
};
const absoluteMaxZero = (raw: string | undefined, fallback: number, max: number) => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;
};

export function researchLimits(env: NodeJS.ProcessEnv = process.env, depth: ResearchDepth = "standard"): ResearchLimits {
  const depthQueryCap = depth === "fast" ? 12 : depth === "deep" ? 48 : 28;
  const maxSearchQueries = Math.min(depthQueryCap, absoluteMax(env.RESEARCH_MAX_QUERIES, depthQueryCap, 48));
  const resultsPerQuery = absoluteMax(env.RESEARCH_RESULTS_PER_QUERY, depth === "fast" ? 4 : depth === "deep" ? 10 : 6, 10);
  const maxProviderCalls = absoluteMax(env.RESEARCH_MAX_PROVIDER_CALLS, maxSearchQueries, 48);
  return {
    maxQueryLength: 500, maxSearchQueries: Math.min(maxSearchQueries, maxProviderCalls), resultsPerQuery,
    maxSources: Math.min(180, maxSearchQueries * resultsPerQuery), maxCandidates: absoluteMax(env.RESEARCH_MAX_CANDIDATES, 30, 48),
    maxModelIterations: absoluteMaxZero(env.RESEARCH_MAX_MODEL_ITERATIONS, 0, 6),
    maxSurvivorIterations: absoluteMax(env.RESEARCH_MAX_SURVIVOR_ITERATIONS, 1, 1),
    maxProviderCalls,
    maxCounterevidenceSearches: Math.min(depth === "fast" ? 1 : depth === "standard" ? 2 : 4, absoluteMax(env.RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES, depth === "deep" ? 4 : 2, 4)),
    maxAgentCalls: absoluteMaxZero(env.RESEARCH_MAX_AGENT_CALLS, 0, 8),
    maxProviderSpendCredits: absoluteMax(env.RESEARCH_MAX_PROVIDER_SPEND_CREDITS, maxProviderCalls, 48),
    maxConcurrency: absoluteMax(env.RESEARCH_MAX_CONCURRENCY, 3, 6),
    maxRetriesPerSearch: absoluteMax(env.RESEARCH_MAX_RETRIES_PER_SEARCH, 1, 2),
    timeoutMs: absoluteMax(env.RESEARCH_TIMEOUT_MS, 15_000, 30_000),
    maxExpansionBranches: depth === "fast" ? 0 : absoluteMaxZero(env.RESEARCH_MAX_EXPANSION_BRANCHES, depth === "deep" ? 8 : 5, 8),
    maxRunDurationMs: absoluteMax(env.RESEARCH_MAX_RUN_DURATION_MS, depth === "fast" ? 30_000 : depth === "deep" ? 120_000 : 75_000, 120_000),
    minCredibleCompetitors: absoluteMax(env.RESEARCH_MIN_CREDIBLE_COMPETITORS, 5, 15),
    competitorQueriesPerCandidate: absoluteMax(env.RESEARCH_COMPETITOR_QUERIES_PER_CANDIDATE, 2, 4),
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
    instruction: "Use finalOutput and ranked survivors as the starting point. Preserve VERIFIED, INFERRED, UNKNOWN, and CONTRADICTED claim labels. Cite evidence IDs using sourceUrl. A missing competitor is a search result, not a validated opportunity; competitor existence validates a possible job but is not an automatic veto. Use residualUnmetDemand to distinguish market crowding from adequate same-user/same-job resolution. Scores are heuristics and must stay paired with written reasoning. Never revive rejected candidates without new evidence and a bounded mutation/falsification pass.",
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
  const category = safeErrorCategory(error);
  const message = category === "TIMEOUT" ? "The provider request timed out."
    : category === "RATE_LIMIT" ? "The provider rate limit or quota was reached; check the provider dashboard and server logs."
      : category === "PROVIDER_AUTH" ? "The provider rejected its server-side credentials."
        : category === "MALFORMED_RESPONSE" ? "The provider returned a malformed response."
          : category === "UPSTREAM_5XX" ? "The provider returned a server error."
            : "The provider request failed.";
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
  const retrievalMode = options.retrievalMode ?? provider.retrievalMode ?? "hosted";
  const usesHostedCredits = retrievalMode === "hosted" && provider.usesHostedCredits !== false;
  const ttl = cacheTtlSeconds();
  if (!options.bypassCache) {
    const cached = await findCachedResearch(canonicalQuery, provider.id, ttl, options.ownerScope);
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
        if (usesHostedCredits && providerCalls >= Math.min(limits.maxProviderCalls, limits.maxProviderSpendCredits)) throw new Error("Provider-call or spend-credit budget exhausted before this angle could complete.");
        if (usesHostedCredits) providerCalls += 1;
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
        operationalLog("warn", "provider_failure", { provider: provider.id, angleKind: angles[index].kind, category: detail.category, retryable: detail.retryable });
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
  let expansionStopReason: ResearchResult["budgetUsage"]["expansionStopReason"] = "not_needed";
  const weakInitialSurvivors = provisionalOpportunity.candidates.length === 0
    || !provisionalOpportunity.falsificationResults.some((item) => item.outcome === "survived");
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
      const newEvidenceCount = focusSources.length - provisionalSources.length;
      if (expansionResults.length === 0 || newEvidenceCount <= 0) {
        searchBranches = searchBranches.map((branch) => ({ ...branch, status: "no_new_evidence" }));
        expansionStopReason = failures.length ? "provider_limit" : "coverage_plateau";
      } else if (provisionalOpportunity.falsificationResults.some((item) => item.outcome === "survived")) expansionStopReason = "survivor_found";
      else expansionStopReason = available >= limits.maxExpansionBranches || providerCalls >= limits.maxProviderCalls ? "budget_exhausted" : "duplicate_branches";
    }
    else expansionStopReason = "budget_exhausted";
  }
  else if (weakInitialSurvivors) expansionStopReason = "budget_exhausted";
  const recallSeeds = provisionalOpportunity.candidates.filter((candidate) => candidate.iteration === 0);
  const fullRecallPlan = planCompetitorDiscovery(recallSeeds, focusGaps, limits.competitorQueriesPerCandidate);
  const recallCapacity = Math.max(0, Math.min(
    limits.maxSearchQueries - landscapeAngles.length - expansionAngles.length - 2,
    limits.maxProviderCalls - providerCalls - 2,
    limits.maxProviderSpendCredits - providerCalls - 2,
  ));
  const groupCost = limits.competitorQueriesPerCandidate * 2;
  const selectedGroups = fullRecallPlan.groups.slice(0, Math.floor(recallCapacity / Math.max(1, groupCost)));
  const selectedSuffixes = selectedGroups.map((group) => group.id.slice(-10));
  const recallPlan = {
    groups: selectedGroups,
    primaryAngles: fullRecallPlan.primaryAngles.filter((angle) => selectedSuffixes.some((suffix) => angle.id.includes(suffix))),
    crossCheckAngles: fullRecallPlan.crossCheckAngles.filter((angle) => selectedSuffixes.some((suffix) => angle.id.includes(suffix))),
    escalationAngles: fullRecallPlan.escalationAngles.filter((angle) => selectedSuffixes.some((suffix) => angle.id.includes(suffix))),
  };
  const primaryCompetitorResults = recallPlan.primaryAngles.length ? await executeAngles(recallPlan.primaryAngles) : [];
  const crossCheckCompetitorResults = recallPlan.crossCheckAngles.length ? await executeAngles(recallPlan.crossCheckAngles) : [];
  let competitorSearchBatches = [...primaryCompetitorResults, ...crossCheckCompetitorResults];
  focusSources = normalizeResults([...landscapeResults, ...expansionResults, ...competitorSearchBatches], now().toISOString(), limits.maxSources);
  focusCompetitors = extractCompetitors(focusSources);
  focusComplaints = clusterComplaints(focusSources);
  focusSegments = detectUnderservedSegments(focusSources);
  focusGaps = detectGaps(focusSources, focusCompetitors, focusComplaints, focusSegments);
  const credibleAfterCrossCheck = focusCompetitors.filter((item) => credibleCompetitor(item, focusSources)).length;
  const escalationTriggeredGroupIds = establishedCategory(query, focusCompetitors) && credibleAfterCrossCheck < limits.minCredibleCompetitors
    ? recallPlan.groups.map((group) => group.id) : [];
  const escalationAvailable = Math.max(0, Math.min(
    limits.maxSearchQueries - landscapeAngles.length - expansionAngles.length - recallPlan.primaryAngles.length - recallPlan.crossCheckAngles.length - 2,
    limits.maxProviderCalls - providerCalls - 2,
    limits.maxProviderSpendCredits - providerCalls - 2,
  ));
  const escalationAngles = escalationTriggeredGroupIds.length ? recallPlan.escalationAngles.slice(0, escalationAvailable) : [];
  const escalationResults = escalationAngles.length ? await executeAngles(escalationAngles) : [];
  competitorSearchBatches = [...competitorSearchBatches, ...escalationResults];
  focusSources = normalizeResults([...landscapeResults, ...expansionResults, ...competitorSearchBatches], now().toISOString(), limits.maxSources);
  focusCompetitors = extractCompetitors(focusSources);
  focusComplaints = clusterComplaints(focusSources);
  focusSegments = detectUnderservedSegments(focusSources);
  focusGaps = detectGaps(focusSources, focusCompetitors, focusComplaints, focusSegments);
  let competitorRecall = buildCompetitorRecallReport({
    query, plan: recallPlan, candidates: recallSeeds, competitors: focusCompetitors, evidence: focusSources,
    successfulAngleIds: competitorSearchBatches.map((item) => item.angle.id), minimumCredibleCompetitors: limits.minCredibleCompetitors,
    escalationTriggeredGroupIds,
  });
  let focusCoverage = assessCoverage({
    angles: [...landscapeAngles, ...expansionAngles, ...recallPlan.primaryAngles, ...recallPlan.crossCheckAngles, ...escalationAngles],
    successfulAngleIds: [...landscapeResults, ...expansionResults, ...competitorSearchBatches].map((item) => item.angle.id),
    evidence: focusSources, regulatedMarket: isRegulatedQuery(query),
  });
  let focusStop = decideStop({ coverage: focusCoverage, gaps: focusGaps, competitors: focusCompetitors });
  provisionalOpportunity = runOpportunityPipeline({
    query, sources: focusSources, competitors: focusCompetitors, complaints: focusComplaints, segments: focusSegments, gaps: focusGaps,
    limits, now: now(), allowGeneration: focusStop.canGenerateCandidates, excludedMechanisms: options.userContext?.previouslyRejectedMechanisms,
    userContext: options.userContext, depth, competitorRecall: competitorRecall.candidates,
  });

  const missingGateFamilies = [...new Set(provisionalOpportunity.evidenceGates.flatMap((gate) => Object.entries(gate.checks)
    .filter(([, passed]) => !passed).map(([name]) => name)))];
  const gateCapacity = Math.max(0, Math.min(3,
    limits.maxSearchQueries - landscapeAngles.length - expansionAngles.length - recallPlan.primaryAngles.length - recallPlan.crossCheckAngles.length - escalationAngles.length - 1,
    limits.maxProviderCalls - providerCalls - 1,
    limits.maxProviderSpendCredits - providerCalls - 1,
  ));
  const evidenceGapAngles = gateCapacity > 0
    ? deriveEvidenceGapAngles(query, provisionalOpportunity.candidates, missingGateFamilies, isRegulatedQuery(query), gateCapacity) : [];
  const evidenceGapResults = evidenceGapAngles.length ? await executeAngles(evidenceGapAngles) : [];
  if (evidenceGapResults.length) {
    focusSources = normalizeResults([...landscapeResults, ...expansionResults, ...competitorSearchBatches, ...evidenceGapResults], now().toISOString(), limits.maxSources);
    focusCompetitors = extractCompetitors(focusSources);
    focusComplaints = clusterComplaints(focusSources);
    focusSegments = detectUnderservedSegments(focusSources);
    focusGaps = detectGaps(focusSources, focusCompetitors, focusComplaints, focusSegments);
    competitorRecall = buildCompetitorRecallReport({ query, plan: recallPlan, candidates: recallSeeds, competitors: focusCompetitors, evidence: focusSources,
      successfulAngleIds: competitorSearchBatches.map((item) => item.angle.id), minimumCredibleCompetitors: limits.minCredibleCompetitors, escalationTriggeredGroupIds });
    focusCoverage = assessCoverage({ angles: [...landscapeAngles, ...expansionAngles, ...recallPlan.primaryAngles, ...recallPlan.crossCheckAngles, ...escalationAngles, ...evidenceGapAngles],
      successfulAngleIds: [...landscapeResults, ...expansionResults, ...competitorSearchBatches, ...evidenceGapResults].map((item) => item.angle.id), evidence: focusSources, regulatedMarket: isRegulatedQuery(query) });
    focusStop = decideStop({ coverage: focusCoverage, gaps: focusGaps, competitors: focusCompetitors });
    provisionalOpportunity = runOpportunityPipeline({ query, sources: focusSources, competitors: focusCompetitors, complaints: focusComplaints, segments: focusSegments,
      gaps: focusGaps, limits, now: now(), allowGeneration: focusStop.canGenerateCandidates, excludedMechanisms: options.userContext?.previouslyRejectedMechanisms,
      userContext: options.userContext, depth, competitorRecall: competitorRecall.candidates });
  }

  const seenMechanisms = new Set<string>();
  const candidateFocus = provisionalOpportunity.candidates.filter((candidate) => candidate.iteration === 0 && !seenMechanisms.has(candidate.mechanismFamily) && seenMechanisms.add(candidate.mechanismFamily)).map((candidate) =>
    `${candidate.definition?.companyProfile ?? candidate.targetCustomer ?? "unknown buyer"}; ${candidate.jobToBeDone}; ${candidate.mechanism}; ${candidate.differentiator}`,
  );
  const usedAngles = landscapeAngles.length + expansionAngles.length + recallPlan.primaryAngles.length + recallPlan.crossCheckAngles.length + escalationAngles.length + evidenceGapAngles.length;
  const remainingAngles = Math.min(limits.maxCounterevidenceSearches, limits.maxSearchQueries - usedAngles, limits.maxProviderCalls - providerCalls, limits.maxProviderSpendCredits - providerCalls);
  const falsificationAngles = candidateFocus.length && remainingAngles > 0 ? deriveFalsificationAngles(query, candidateFocus, remainingAngles) : [];
  const falsificationResults = falsificationAngles.length ? await executeAngles(falsificationAngles) : [];
  const searchAngles = [...landscapeAngles, ...expansionAngles, ...recallPlan.primaryAngles, ...recallPlan.crossCheckAngles, ...escalationAngles, ...evidenceGapAngles, ...falsificationAngles];
  const successful = [...landscapeResults, ...expansionResults, ...competitorSearchBatches, ...evidenceGapResults, ...falsificationResults];

  const retrievedAt = now().toISOString();
  const sources = normalizeResults(successful, retrievedAt, limits.maxSources);
  const competitors = extractCompetitors(sources);
  const complaintClusters = clusterComplaints(sources);
  const underservedSegments = detectUnderservedSegments(sources);
  const gaps = detectGaps(sources, competitors, complaintClusters, underservedSegments);
  competitorRecall = buildCompetitorRecallReport({
    query, plan: recallPlan, candidates: recallSeeds, competitors, evidence: sources,
    successfulAngleIds: successful.map((item) => item.angle.id), minimumCredibleCompetitors: limits.minCredibleCompetitors,
    escalationTriggeredGroupIds,
  });
  const successfulAngleIds = successful.map((item) => item.angle.id);
  const counterevidenceBudgetExhausted = focusGaps.length > 0 && falsificationAngles.length === 0;
  const coverage = assessCoverage({ angles: searchAngles, successfulAngleIds, evidence: sources, regulatedMarket: isRegulatedQuery(query), counterevidenceBudgetExhausted });
  const stopDecision = decideStop({ coverage, gaps, competitors });
  const opportunity = runOpportunityPipeline({ query, sources, competitors, complaints: complaintClusters, segments: underservedSegments, gaps, limits, now: now(), allowGeneration: stopDecision.canGenerateCandidates, excludedMechanisms: options.userContext?.previouslyRejectedMechanisms, userContext: options.userContext, depth, competitorRecall: competitorRecall.candidates });
  opportunity.budgetUsage.providerCalls = providerCalls;
  opportunity.budgetUsage.counterevidenceSearches = usesHostedCredits ? falsificationResults.length : 0;
  opportunity.budgetUsage.estimatedProviderCredits = providerCalls;
  opportunity.budgetUsage.exhausted = usesHostedCredits
    ? providerCalls >= limits.maxProviderCalls || providerCalls >= limits.maxProviderSpendCredits
      || searchAngles.length >= limits.maxSearchQueries || Date.now() - wallStartedAt >= limits.maxRunDurationMs
    : Date.now() - wallStartedAt >= limits.maxRunDurationMs;
  opportunity.budgetUsage.expansionStopReason = opportunity.budgetUsage.exhausted ? "budget_exhausted"
    : opportunity.finalOpportunities.length > 0 ? "success"
      : searchBranches.some((item) => item.status === "no_new_evidence") ? "coverage_plateau"
        : failures.length && expansionAngles.length > 0 && expansionResults.length === 0 ? "provider_limit"
          : expansionStopReason === "budget_exhausted" ? "no_useful_branch_remaining" : expansionStopReason;
  if (!opportunity.finalOpportunities.length && searchBranches.length && /Expand the search into one adjacent segment or workflow/i.test(opportunity.nextBestAction.action)) {
    opportunity.nextBestAction = {
      ...opportunity.nextBestAction,
      action: "Collect independent user-voice and current-spend evidence for the strongest recorded gap before another adjacent expansion.",
      reason: "Adjacent workflow/segment expansion already ran in this research run without producing a survivor; repeating it is not the next-best action.",
      estimatedCost: "targeted interviews or one evidence-gap retrieval pass",
    };
  }
  const warnings = [...failures];
  if (complaintClusters.length === 0) warnings.push("No supported complaint clusters were found; the result contains no inferred market gaps rather than manufacturing them.");
  if (gaps.length > 0 && gaps.every((gap) => gap.confidenceLabel === "speculative opportunity")) warnings.push("All detected openings remain speculative because retrieved support is weak or isolated.");
  if (sources.length === 0) warnings.push("No usable public sources were retrieved. The run is returned as insufficient evidence; no candidate was generated.");
  if (!falsificationAngles.length && focusGaps.length > 0) warnings.push(retrievalMode === "supplied_sources"
    ? "The supplied evidence snapshot did not provide a separate counterevidence pass; unresolved falsification dimensions remain UNKNOWN and are returned by get_research_requirements."
    : "The provider-call budget left no room for active candidate counterevidence searches; falsification dimensions without evidence remain UNKNOWN.");
  if (searchBranches.length) warnings.push(`${searchBranches.length} adjacent search branch(es) were attempted because the initial niche produced no survival-gate candidate; exact failure reasons were carried forward as negative search memory.`);
  if (competitorRecall.candidates.some((item) => item.materialNewDirectCompetitorIds.length)) warnings.push("The mandatory independent competitor cross-check found material direct competitors absent from the primary pass; discoveries were merged before collision scoring, falsification, Bull/Bear/Judge review, and selection.");
  if (competitorRecall.candidates.some((item) => !item.crossCheckComplete)) warnings.push("At least one candidate structural group could not complete its independent competitor cross-check and is ineligible for SURVIVED classification.");
  if (stopDecision.canGenerateCandidates && opportunity.finalOpportunities.length === 0) warnings.push(opportunity.budgetUsage.exhausted
    ? "No candidate survived after the configured search/expansion budget was exhausted; the response intentionally contains no mediocre filler ideas."
    : "No opportunity survived in the branches searched so far; retrieval stopped only for the persisted expansion reason and does not imply exhaustive market rejection.");
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
    opportunities: opportunity.finalOpportunities, requestedIdentity: options.companyIdentity,
  }) : null;
  const candidateIdMapping = buildCandidateIdMapping(recallSeeds, opportunity.candidates);
  const claimLineage = buildResearchClaimLineage({
    query, sources, competitors, gaps, candidates: opportunity.candidates,
    falsificationResults: opportunity.falsificationResults, weakSignals: opportunity.weakSignals, companyProfile,
  });
  const citationCoverage = citationCoverageAudit(claimLineage);
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
    checkpoint("competitor_substitute_check", competitorRecall.candidates.length > 0 && competitorRecall.candidates.every((item) => item.crossCheckComplete) ? "passed" : "failed", competitors.length ? `${competitors.length} supported competitors/substitutes inspected after primary and independent cross-check passes.` : "No supported competitor was found; coverage limitation remains visible.", completedAt),
    checkpoint("residual_gap_test", opportunity.candidates.length ? "passed" : "not_applicable", opportunity.candidates.length ? "Every promoted candidate received a structured residual-unmet-demand assessment during falsification." : "No candidate cleared the evidence gate.", completedAt),
    checkpoint("candidate_mechanism_deduplication", opportunity.candidates.length ? "passed" : "not_applicable", "Duplicate mechanism families were collapsed before final candidate count.", completedAt),
    checkpoint("falsification", opportunity.finalOpportunities.every((item) => item.falsification.outcome === "survived") ? "passed" : "failed", `${opportunity.falsificationResults.length} candidates received an adversarial falsification result.`, completedAt),
  ];
  const runId = `research_${now().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const runLineage = {
    rootRunId: options.runLineage?.rootRunId ?? runId,
    parentRunId: options.runLineage?.parentRunId ?? null,
    version: options.runLineage?.version ?? 1,
    reason: options.runLineage?.reason ?? "fresh_run" as const,
  };
  const evidenceIds = new Set(sources.map((item) => item.id));
  const retainedEvidenceIds = [...new Set(options.parentEvidenceIds ?? [])].filter((id) => evidenceIds.has(id));
  const base = {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    engineVersion: RESEARCH_ENGINE_VERSION,
    id: runId,
    query,
    mode,
    depth,
    canonicalQuery,
    stableMarketKey: `market_${createHash("sha256").update(canonicalQuery).digest("hex").slice(0, 16)}`,
    status: failures.length || stopDecision.status !== "proceed" ? "partial" as const : "complete" as const,
    startedAt,
    completedAt,
    provider: { id: provider.id, displayName: provider.displayName },
    retrievalMode,
    retrieval: {
      mode: retrievalMode,
      provenance: retrievalMode === "supplied_sources" ? "claude_or_user_supplied" as const : "novelty_hosted_search" as const,
      suppliedSourceCount: retrievalMode === "supplied_sources" ? options.suppliedSourceCount ?? sources.length : 0,
      hostedProviderCalls: providerCalls,
      estimatedHostedProviderCredits: providerCalls,
    },
    runLineage,
    cache: { hit: false, matchedRunId: null },
    limits,
    searchAngles,
    sources,
    competitors,
    competitorRecall,
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
    evidenceSnapshot: {
      ...createEvidenceSnapshot(sources, coverage, completedAt),
      claimLineage: structuredClone(claimLineage), citationCoverage: structuredClone(citationCoverage),
      lineage: {
        runId, rootRunId: runLineage.rootRunId, parentRunId: runLineage.parentRunId, version: runLineage.version,
        retainedEvidenceIds,
        addedEvidenceIds: sources.map((item) => item.id).filter((id) => !retainedEvidenceIds.includes(id)),
      },
    },
    claimLineage,
    citationCoverage,
    candidateIdMapping,
    companyProfile,
    warnings,
  };
  const result = { ...base } as Omit<ResearchResult, "ideationContext">;
  const invalidReferences = validateEvidenceReferences(result as ResearchResult);
  const gateErrors = assertSurvivorGates(result as ResearchResult);
  if (invalidReferences.length || gateErrors.length) throw new Error(`Research quality gate failed: ${[...invalidReferences.map((id) => `missing evidence ${id}`), ...gateErrors].join("; ")}`);
  result.checkpoints.push(checkpoint("citation_validation", "passed", `Every factual evidence ID resolved to the immutable snapshot; ${citationCoverage.supportedMajorClaims}/${citationCoverage.totalMajorClaims} major claims have at least one support-role- and relevance-compatible citation. Unsupported or mismatched claims remain explicit.`, completedAt));
  result.checkpoints.push(checkpoint("final_persistence", options.persist === false ? "not_applicable" : "passed", options.persist === false ? "Persistence was explicitly disabled for this run." : "The completed run and evidence snapshot are the object passed to durable/local persistence.", completedAt));
  const completeResult: ResearchResult = { ...result, ideationContext: ideationContext(result) };
  if (options.persist !== false) {
    const stored = await saveResearchResult(completeResult, ttl, options.ownerScope);
    if (!stored.durable) completeResult.warnings.push("This Vercel-compatible build uses in-memory cache in serverless mode; configure external durable storage before relying on run history across instances.");
  }
  if (failures.length) {
    operationalLog("warn", "research_partial_failure", { runId: completeResult.id, provider: provider.id, failureCount: failures.length, stopStatus: stopDecision.status });
  }
  if (depth === "deep" || providerCalls >= 20 || providerCalls >= Math.ceil(limits.maxProviderCalls * 0.75)) {
    operationalLog("info", "research_high_cost_run", {
      runId: completeResult.id,
      depth,
      provider: provider.id,
      providerCalls,
      estimatedProviderCredits: opportunity.budgetUsage.estimatedProviderCredits,
      durationMs: Date.now() - wallStartedAt,
      sourceCount: sources.length,
    });
  }
  return completeResult;
}

export async function runResearchFromSources(
  rawQuery: string,
  sources: SuppliedResearchSource[],
  options: Omit<ResearchRequestOptions, "provider" | "retrievalMode" | "suppliedSourceCount"> = {},
): Promise<ResearchResult> {
  const now = options.now?.() ?? new Date();
  const supplied = suppliedSourcesToProvider(sources, { now });
  return runResearch(rawQuery, {
    ...options,
    now: options.now ?? (() => now),
    provider: supplied.provider,
    retrievalMode: "supplied_sources",
    suppliedSourceCount: supplied.sourceCount,
    bypassCache: true,
  });
}

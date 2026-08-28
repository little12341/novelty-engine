import type { McpServer } from "@modelcontextprotocol/server";
import { HostedSearchDisabledError, ResearchConfigurationError, SuppliedSourcesRequiredError } from "../research/providers.ts";
import { runResearch, runResearchFromSources } from "../research/pipeline.ts";
import { discoverResearchRuns, getResearchResultById, searchResearchRunPage } from "../research/store.ts";
import type { ResearchResult } from "../research/types.ts";
import { activelyFalsifyOpportunity } from "./falsify.ts";
import { currentMcpOwnerScope, currentMcpRequestId, recordMcpCall } from "./observability.ts";
import { compareIdeas } from "../research/comparison.ts";
import { compareResearchRuns } from "../research/changes.ts";
import { exportResearchResult } from "../research/exports.ts";
import { recordValidationOutcome } from "../research/validation-outcomes.ts";
import {
  compareIdeasInput, compareResearchRunsInput, exportResearchRunInput, falsifyOpportunityInput, findMarketGapsInput,
  getResearchRunInput, inspectCompetitorsInput, inspectRunInput, recordValidationOutcomeInput, rerunResearchInput, researchMarketInput, runResearchModeInput,
  addSourcesToRunInput, compareRunCandidatesInput, getResearchBudgetInfoInput, getResearchRequirementsInput, listResearchRunsInput, researchFromSourcesInput, searchResearchRunsInput,
} from "./schemas.ts";
import { summarizeCompetitors, summarizeGaps, summarizeResearch } from "./summaries.ts";
import { freshCompetitorExpansion } from "../research/competitor-discovery.ts";
import { resolveCandidateId } from "../research/candidate-ids.ts";
import { normalizeCompanyResearchRequest, CompanyIdentityError } from "../research/company-identity.ts";
import { getResearchBudgetInfo } from "../research/budget-info.ts";
import { compareRunCandidates } from "../research/run-candidate-comparison.ts";
import { addSourcesToResearchRun } from "../research/source-updates.ts";
import { getResearchRequirements } from "../research/requirements.ts";
import type { SuppliedResearchSource } from "../research/types.ts";

export const MCP_TOOL_DESCRIPTIONS = Object.freeze({
  research_market: "Start a new full V2.2 market-research run through the optional hosted-search path retained for backward compatibility. It uses deployment-owned Tavily/Brave credits when HOSTED_SEARCH_ENABLED is true. For the recommended zero-provider-credit workflow, Claude should search the web and call research_from_sources instead.",
  research_from_sources: "Recommended default: accept bounded public sources gathered by Claude/web or supplied by the user, audit them as untrusted evidence, and run the complete shared V2.2 normalization, entity resolution, claim support, evidence gate, competitor, gap, falsification, scoring, Bull/Bear/Judge, lifecycle, persistence, and next-action pipeline with exactly zero Tavily/Brave calls.",
  add_sources_to_run: "Merge bounded additional Claude/user-supplied evidence into an immutable descendant of a stored run, deduplicate it, and recompute the shared downstream V2.2 analysis. The historical run is never mutated and Tavily/Brave calls remain zero.",
  get_research_requirements: "Inspect a stored run's evidence gates, source families, competitor recall, assumptions, falsification unknowns, and claim-support deficits. Return what Claude should search for next without calling Tavily/Brave.",
  find_market_gaps: "Stored-read tool only: rank and paginate gaps already present in one completed run. It performs no fresh retrieval. To research a new gap-focused query, call run_research_mode with mode=find_gaps.",
  inspect_competitors: "Read the normalized competitor/substitute map already stored in a completed run. It performs no fresh retrieval unless fresh_expand=true. That flag is an explicit hosted-search request for hosted runs; supplied-source runs must use get_research_requirements plus add_sources_to_run.",
  falsify_opportunity: "Falsify an opportunity against stored supplied evidence with zero provider calls when available; otherwise this optional advanced path performs up to four hosted counterevidence searches when hosted search is enabled.",
  get_research_run: "Retrieve a completed run by ID. The default is a concise user-safe summary; include_full=true returns the stored internal ResearchResult for debugging/follow-up, not the canonical export/report representation.",
  run_research_mode: "Start a new intent-scoped run through the shared V2.2 pipeline using the optional hosted-search path. It may spend deployment-owned Tavily/Brave credits and fails with HOSTED_SEARCH_DISABLED when disabled. Prefer research_from_sources for Claude-first evidence.",
  compare_ideas: "Optional hosted-search comparison for 2–5 separate ideas under one shared provider-call cap. With hosted search disabled, research each idea from Claude-supplied sources and compare persisted runs/candidates instead.",
  export_research_run: "Read a stored run and return its canonical export/report representation in the requested format. JSON export is deliberately distinct from get_research_run(include_full=true), which returns the internal ResearchResult.",
  compare_research_runs: "Read two persisted research snapshots and surface supported material changes while suppressing trivial or syndicated differences.",
  rerun_research: "Rerun a hosted baseline through optional hosted retrieval and compare snapshots. A supplied-source baseline never triggers implicit provider spend; use add_sources_to_run with newly gathered evidence.",
  source_check: "Read one stored run and audit citation coverage, source quality/diversity, duplicates, contradictions, and unresolved claim states without fresh retrieval.",
  next_best_action: "Read the single highest-information validation or search-expansion action and its success/kill criteria from a stored run.",
  record_validation_outcome: "Persist measured external validation results. A success becomes VALIDATED only when the strict research evidence gate passed and an inspectable public artifact URL is supplied.",
  list_research_runs: "List recent persisted runs visible to the current automatic client namespace, with opaque pagination and optional date/status/stop/mode/depth filters. No run ID or fresh retrieval is required, and unrelated client namespaces are never enumerated.",
  search_research_runs: "Find persisted runs visible to the current automatic client namespace using transparent canonical-token similarity plus exact keyword/phrase matching. This is not embedding, vector, or fresh web search.",
  get_research_budget_info: "Return public-safe configured retrieval-call ranges, hard caps, and low/medium/high relative cost for fast, standard, deep, comparison, falsification, and rerun workflows. Provider identity, billing plans, credentials, and sensitive remaining quota are excluded.",
  compare_run_candidates: "Compare 2–5 canonical candidates or gaps from one stored run side by side using its evidence, scoring, falsification, assumptions, collisions, and lineage. Default fresh_expand=false makes zero provider calls; killed candidates remain explicitly killed.",
});

type ToolDependencies = {
  research: typeof runResearch;
  researchFromSources: typeof runResearchFromSources;
  addSources: typeof addSourcesToResearchRun;
  requirements: typeof getResearchRequirements;
  getRun: typeof getResearchResultById;
  falsify: (input: { opportunity: string; run_id?: string; candidate_id?: string }) => Promise<object>;
  compare: typeof compareIdeas;
  expandCompetitors: typeof freshCompetitorExpansion;
  discoverRuns: typeof discoverResearchRuns;
  searchRuns: typeof searchResearchRunPage;
};

const defaults: ToolDependencies = {
  research: runResearch, researchFromSources: runResearchFromSources, addSources: addSourcesToResearchRun, requirements: getResearchRequirements,
  getRun: getResearchResultById, falsify: activelyFalsifyOpportunity, compare: compareIdeas,
  expandCompetitors: freshCompetitorExpansion, discoverRuns: discoverResearchRuns, searchRuns: searchResearchRunPage,
};

function textResult<T extends object>(value: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Novelty Engine tool failed.";
  const code = error instanceof HostedSearchDisabledError ? "HOSTED_SEARCH_DISABLED"
    : error instanceof SuppliedSourcesRequiredError ? "SUPPLIED_SOURCES_REQUIRED"
    : error instanceof ResearchConfigurationError ? "RESEARCH_NOT_CONFIGURED"
    : error instanceof CompanyIdentityError ? "INVALID_COMPANY_IDENTITY"
    : error instanceof DOMException && error.name === "AbortError" || /cancel|aborted/i.test(message) ? "RESEARCH_CANCELLED"
    : error instanceof RangeError && /research query/i.test(message) ? "INVALID_QUERY"
      : error instanceof RangeError ? "INVALID_OR_MISSING_RUN"
        : /malformed/i.test(message) ? "MALFORMED_PROVIDER_RESPONSE"
          : /abort|time(?:d)?\s*out/i.test(message) ? "RESEARCH_TIMEOUT" : "RESEARCH_PROVIDER_ERROR";
  const publicMessage = error instanceof HostedSearchDisabledError || error instanceof SuppliedSourcesRequiredError || error instanceof ResearchConfigurationError ? error.message
    : code === "RESEARCH_CANCELLED" ? "Research was cancelled before completion."
      : code === "INVALID_QUERY" || code === "INVALID_OR_MISSING_RUN" || code === "INVALID_COMPANY_IDENTITY" ? message
        : code === "MALFORMED_PROVIDER_RESPONSE" ? "The search provider returned a malformed response."
          : code === "RESEARCH_TIMEOUT" ? "The research provider or run timed out."
            : "The search provider request failed. Use the request ID to find the privacy-safe server log.";
  const value: Record<string, unknown> = { error: publicMessage, code, requestId: currentMcpRequestId(), fabricatedEvidence: false };
  if (error instanceof ResearchConfigurationError) value.requiredEnvironmentVariables = error.requiredEnvironmentVariables;
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value, isError: true };
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return error instanceof HostedSearchDisabledError ? "HOSTED_SEARCH_DISABLED"
    : error instanceof SuppliedSourcesRequiredError ? "SUPPLIED_SOURCES_REQUIRED"
    : error instanceof ResearchConfigurationError ? "RESEARCH_NOT_CONFIGURED"
    : error instanceof CompanyIdentityError ? "INVALID_COMPANY_IDENTITY"
    : error instanceof DOMException && error.name === "AbortError" || /cancel|aborted/i.test(message) ? "RESEARCH_CANCELLED"
    : error instanceof RangeError && /research query/i.test(message) ? "INVALID_QUERY"
      : error instanceof RangeError ? "INVALID_OR_MISSING_RUN"
        : /malformed/i.test(message) ? "MALFORMED_PROVIDER_RESPONSE"
          : /abort|time(?:d)?\s*out/i.test(message) ? "RESEARCH_TIMEOUT" : "RESEARCH_PROVIDER_ERROR";
}

function resultMetadata(value: object) {
  const record = value as Record<string, unknown>;
  const provider = record.provider && typeof record.provider === "object" && "id" in record.provider
    ? String((record.provider as { id: unknown }).id) : null;
  const sourceCount = Array.isArray(record.citations) ? record.citations.length
    : record.activeSearch && typeof record.activeSearch === "object" && "sourceCount" in record.activeSearch
      ? Number((record.activeSearch as { sourceCount: unknown }).sourceCount) : null;
  return { provider, sourceCount: Number.isFinite(sourceCount) ? sourceCount : null };
}

async function observed<T extends object>(tool: string, work: () => Promise<T>) {
  const started = Date.now();
  try {
    const value = await work();
    const runId = typeof (value as { runId?: unknown }).runId === "string" ? (value as { runId: string }).runId : null;
    recordMcpCall({ at: new Date().toISOString(), tool, status: "success", durationMs: Date.now() - started, runId, ...resultMetadata(value), errorCode: null });
    return textResult(value);
  } catch (error) {
    recordMcpCall({ at: new Date().toISOString(), tool, status: "error", durationMs: Date.now() - started, runId: null, provider: null, sourceCount: null, errorCode: errorCode(error) });
    return toolError(error);
  }
}

async function requiredRun(getRun: ToolDependencies["getRun"], id: string): Promise<ResearchResult> {
  const result = await getRun(id);
  if (!result) throw new RangeError(`Research run ${id} was not found or has expired.`);
  return result;
}

function discoveryFilters(input: {
  limit: number; cursor?: string; created_after?: string; created_before?: string; updated_after?: string; updated_before?: string;
  status?: "complete" | "partial"; stop_status?: "proceed" | "partial_research" | "insufficient_evidence";
  mode?: ResearchResult["mode"]; depth?: ResearchResult["depth"];
}) {
  return {
    limit: input.limit, cursor: input.cursor, createdAfter: input.created_after, createdBefore: input.created_before,
    updatedAfter: input.updated_after, updatedBefore: input.updated_before, status: input.status,
    stopStatus: input.stop_status, mode: input.mode, depth: input.depth, ownerScope: currentMcpOwnerScope(),
  };
}

function suppliedSourcesFromInput(sources: Array<{
  url: string; title: string; snippet?: string; excerpt?: string; content?: string; publication_date?: string;
  source_type?: SuppliedResearchSource["sourceType"]; publisher?: string; domain?: string; retrieved_at?: string;
}>): SuppliedResearchSource[] {
  return sources.map((source) => ({
    url: source.url, title: source.title, snippet: source.snippet, excerpt: source.excerpt, content: source.content,
    publicationDate: source.publication_date, sourceType: source.source_type, publisher: source.publisher,
    domain: source.domain, retrievedAt: source.retrieved_at,
  }));
}

export function registerNoveltyTools(server: McpServer, dependencies: Partial<ToolDependencies> = {}) {
  const deps = { ...defaults, ...dependencies };
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

  server.registerTool("research_market", {
    title: "Research a market",
    description: MCP_TOOL_DESCRIPTIONS.research_market,
    inputSchema: researchMarketInput,
    annotations,
  }, ({ query, depth, founder_constraints }, context) => observed("research_market", async () => summarizeResearch(await deps.research(query, { depth, userContext: founder_constraints, ownerScope: currentMcpOwnerScope(), signal: context.mcpReq.signal }))));

  server.registerTool("research_from_sources", {
    title: "Research from supplied public sources",
    description: MCP_TOOL_DESCRIPTIONS.research_from_sources,
    inputSchema: researchFromSourcesInput,
    annotations: { ...annotations, readOnlyHint: false, openWorldHint: false },
  }, ({ query, depth, founder_constraints, sources }, context) => observed("research_from_sources", async () => summarizeResearch(await deps.researchFromSources(
    query,
    suppliedSourcesFromInput(sources),
    { depth, userContext: founder_constraints, ownerScope: currentMcpOwnerScope(), signal: context.mcpReq.signal },
  ))));

  server.registerTool("add_sources_to_run", {
    title: "Add supplied evidence to a stored run",
    description: MCP_TOOL_DESCRIPTIONS.add_sources_to_run,
    inputSchema: addSourcesToRunInput,
    annotations: { ...annotations, readOnlyHint: false, openWorldHint: false },
  }, ({ run_id, sources, founder_constraints }, context) => observed("add_sources_to_run", async () => {
    const baseline = await requiredRun(deps.getRun, run_id);
    const updated = await deps.addSources({
      baseline, sources: suppliedSourcesFromInput(sources), founderConstraints: founder_constraints,
      ownerScope: currentMcpOwnerScope(), signal: context.mcpReq.signal,
    });
    return { runId: updated.run.id, summary: updated.summary, result: summarizeResearch(updated.run), materialChanges: updated.materialChanges };
  }));

  server.registerTool("get_research_requirements", {
    title: "Get the next evidence requirements",
    description: MCP_TOOL_DESCRIPTIONS.get_research_requirements,
    inputSchema: getResearchRequirementsInput,
    annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id }) => observed("get_research_requirements", async () => deps.requirements(await requiredRun(deps.getRun, run_id))));

  server.registerTool("find_market_gaps", {
    title: "Find ranked market gaps",
    description: MCP_TOOL_DESCRIPTIONS.find_market_gaps,
    inputSchema: findMarketGapsInput,
    annotations,
  }, ({ run_id, limit, cursor }) => observed("find_market_gaps", async () => summarizeGaps(await requiredRun(deps.getRun, run_id), limit, cursor)));

  server.registerTool("inspect_competitors", {
    title: "Inspect competitors",
    description: MCP_TOOL_DESCRIPTIONS.inspect_competitors,
    inputSchema: inspectCompetitorsInput,
    annotations,
  }, ({ run_id, limit, cursor, fresh_expand, candidate_id }, context) => observed("inspect_competitors", async () => {
    const stored = await requiredRun(deps.getRun, run_id);
    const canonicalCandidateId = candidate_id ? resolveCandidateId(stored, candidate_id) : null;
    if (candidate_id && !canonicalCandidateId) throw new RangeError(`Candidate ${candidate_id} was not found in run ${run_id}.`);
    const result = fresh_expand ? await deps.expandCompetitors(stored, canonicalCandidateId ?? undefined, context.mcpReq.signal) : stored;
    return { ...summarizeCompetitors(result, limit, cursor, canonicalCandidateId ?? undefined), freshExpansion: fresh_expand, candidateId: canonicalCandidateId, candidateIdMapping: result.candidateIdMapping, competitorRecall: result.competitorRecall };
  }));

  server.registerTool("falsify_opportunity", {
    title: "Falsify an opportunity",
    description: MCP_TOOL_DESCRIPTIONS.falsify_opportunity,
    inputSchema: falsifyOpportunityInput,
    annotations,
  }, (input) => observed("falsify_opportunity", async () => deps.falsify(input)));

  server.registerTool("get_research_run", {
    title: "Get a research run",
    description: MCP_TOOL_DESCRIPTIONS.get_research_run,
    inputSchema: getResearchRunInput,
    annotations,
  }, ({ run_id, include_full }) => observed("get_research_run", async () => {
    const result = await requiredRun(deps.getRun, run_id);
    return include_full ? { runId: result.id, fullResearchResult: result } : summarizeResearch(result);
  }));

  server.registerTool("run_research_mode", {
    title: "Run a Novelty Engine intent mode",
    description: MCP_TOOL_DESCRIPTIONS.run_research_mode,
    inputSchema: runResearchModeInput,
    annotations,
  }, ({ mode, query, company_name, domain, ticker, country, depth, founder_constraints }, context) => observed("run_research_mode", async () => {
    const companyRequest = mode === "research_company"
      ? normalizeCompanyResearchRequest({ query, companyName: company_name, domain, ticker, country })
      : { query: query!, identity: null };
    return summarizeResearch(await deps.research(companyRequest.query, {
      mode, depth, userContext: founder_constraints, companyIdentity: companyRequest.identity ?? undefined,
      ownerScope: currentMcpOwnerScope(), signal: context.mcpReq.signal,
    }));
  }));

  server.registerTool("compare_ideas", {
    title: "Compare 2–5 ideas",
    description: MCP_TOOL_DESCRIPTIONS.compare_ideas,
    inputSchema: compareIdeasInput,
    annotations,
  }, ({ ideas }) => observed("compare_ideas", async () => deps.compare(ideas, { ownerScope: currentMcpOwnerScope() })));

  server.registerTool("export_research_run", {
    title: "Export a research run",
    description: MCP_TOOL_DESCRIPTIONS.export_research_run,
    inputSchema: exportResearchRunInput,
    annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id, format }) => observed("export_research_run", async () => ({ runId: run_id, format, export: exportResearchResult(await requiredRun(deps.getRun, run_id), format) })));

  server.registerTool("compare_research_runs", {
    title: "Detect material changes between snapshots",
    description: MCP_TOOL_DESCRIPTIONS.compare_research_runs,
    inputSchema: compareResearchRunsInput,
    annotations: { ...annotations, openWorldHint: false },
  }, ({ baseline_run_id, comparison_run_id }) => observed("compare_research_runs", async () => compareResearchRuns(
    await requiredRun(deps.getRun, baseline_run_id), await requiredRun(deps.getRun, comparison_run_id),
  )));

  server.registerTool("rerun_research", {
    title: "Rerun research incrementally",
    description: MCP_TOOL_DESCRIPTIONS.rerun_research,
    inputSchema: rerunResearchInput, annotations,
  }, ({ run_id, depth, retrieval_mode }, context) => observed("rerun_research", async () => {
    const baseline = await requiredRun(deps.getRun, run_id);
    if (retrieval_mode === "auto" && baseline.retrievalMode === "supplied_sources") {
      throw new SuppliedSourcesRequiredError("This baseline was created from supplied sources, so rerun_research will not silently switch to hosted search. Gather new evidence with Claude/web search and call add_sources_to_run, or explicitly request retrieval_mode=hosted when deployment-owned search is intended.");
    }
    const requested = baseline.companyProfile?.requestedIdentity;
    const companyIdentity = baseline.mode === "research_company" && requested?.authoritativeIdentifiers?.length ? {
      companyName: requested.authoritativeIdentifiers.includes("company_name") ? requested.name : null,
      normalizedName: requested.normalizedName, canonicalDomain: requested.canonicalDomain,
      ticker: requested.ticker ?? null, country: requested.country ?? null, authoritative: true as const,
    } : undefined;
    const rerun = await deps.research(baseline.query, {
      mode: baseline.mode, depth, bypassCache: true, companyIdentity, ownerScope: currentMcpOwnerScope(), signal: context.mcpReq.signal,
      runLineage: { rootRunId: baseline.runLineage.rootRunId, parentRunId: baseline.id, version: baseline.runLineage.version + 1, reason: "hosted_rerun" },
      parentEvidenceIds: baseline.sources.map((item) => item.id),
    });
    return { baselineRunId: baseline.id, result: summarizeResearch(rerun), materialChanges: compareResearchRuns(baseline, rerun) };
  }));

  server.registerTool("source_check", {
    title: "Audit evidence and citations",
    description: MCP_TOOL_DESCRIPTIONS.source_check,
    inputSchema: inspectRunInput, annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id }) => observed("source_check", async () => {
    const run = await requiredRun(deps.getRun, run_id);
    const unsupportedClaims = run.claimLineage.filter((item) => item.major && item.supportingEvidenceIds.length === 0);
    const roleMismatches = run.claimLineage.filter((item) => item.evidenceDecisions.some((decision) => !decision.roleCompatible));
    const relevanceRejections = run.claimLineage.filter((item) => item.evidenceDecisions.some((decision) => decision.roleCompatible && !decision.relevant));
    const domainGroups = run.sources.reduce((groups, item) => {
      const key = item.sourceAssessment.independenceGroup;
      groups.set(key, [...(groups.get(key) ?? []), item]);
      return groups;
    }, new Map<string, ResearchResult["sources"]>());
    const sameDomainDuplicates = [...domainGroups.entries()]
      .filter(([, sources]) => sources.length > 1)
      .map(([independenceGroup, sources]) => ({ independenceGroup, sourceIds: sources.map((item) => item.id), urls: sources.map((item) => item.sourceUrl), independentSignalCount: 1 }));
    return {
      runId: run.id, retrievalMode: run.retrievalMode, providerCalls: 0, storedRunProviderCalls: run.budgetUsage.providerCalls,
      coverage: run.coverage, checkpoint: run.checkpoints.find((item) => item.name === "citation_validation"),
      citationCoverage: run.citationCoverage,
      snapshotWarnings: { duplicates: run.evidenceSnapshot.duplicateWarnings, sameDomainDuplicates, missingFamilies: run.evidenceSnapshot.missingSourceFamilyWarnings },
      unsupportedClaims,
      supportRoleMismatches: roleMismatches,
      relevanceRejections,
      claimLineage: run.claimLineage,
      contradictions: run.assumptionLedger.filter((item) => item.factState === "CONTRADICTED"),
      sources: run.sources.map((item) => ({ id: item.id, url: item.sourceUrl, pageIdentity: item.pageIdentity, relevanceAssessment: item.relevanceAssessment, assessment: item.sourceAssessment, security: item.security, suppliedMetadata: item.suppliedMetadata })),
    };
  }));

  server.registerTool("next_best_action", {
    title: "Get the single next-best action",
    description: MCP_TOOL_DESCRIPTIONS.next_best_action,
    inputSchema: inspectRunInput, annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id }) => observed("next_best_action", async () => ({ runId: run_id, nextBestAction: (await requiredRun(deps.getRun, run_id)).nextBestAction })));

  server.registerTool("record_validation_outcome", {
    title: "Record an external validation outcome",
    description: MCP_TOOL_DESCRIPTIONS.record_validation_outcome,
    inputSchema: recordValidationOutcomeInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ run_id, candidate_id, experiment_type, success, observed_metrics, artifact_urls }) => observed("record_validation_outcome", async () => recordValidationOutcome({
    runId: run_id, candidateId: candidate_id, experimentType: experiment_type, success, observedMetrics: observed_metrics, artifactUrls: artifact_urls,
  })));

  server.registerTool("list_research_runs", {
    title: "List recent research runs",
    description: MCP_TOOL_DESCRIPTIONS.list_research_runs,
    inputSchema: listResearchRunsInput,
    annotations: { ...annotations, openWorldHint: false },
  }, (input) => observed("list_research_runs", async () => {
    const page = await deps.discoverRuns(discoveryFilters(input));
    return { ...page, runs: page.runs.map((run) => ({
      run_id: run.id, query: run.query, mode: run.mode, depth: run.depth, retrieval_mode: run.retrievalMode, status: run.status,
      stop_status: run.stopDecision.status, created_at: run.startedAt, updated_at: run.completedAt,
      counts: { survivors: run.survivorCount, candidates: run.candidateCount, gaps: run.gapCount, rejected: run.rejectedCount },
      result_summary: `${run.survivorCount} survivor(s), ${run.gapCount} gap(s); stop=${run.stopDecision.status}.`,
    })) };
  }));

  server.registerTool("search_research_runs", {
    title: "Search prior research runs",
    description: MCP_TOOL_DESCRIPTIONS.search_research_runs,
    inputSchema: searchResearchRunsInput,
    annotations: { ...annotations, openWorldHint: false },
  }, ({ query, ...input }) => observed("search_research_runs", async () => {
    const page = await deps.searchRuns(query, discoveryFilters(input));
    return { ...page, query, runs: page.runs.map((run) => ({
      run_id: run.id, query: run.query, mode: run.mode, depth: run.depth, retrieval_mode: run.retrievalMode, status: run.status,
      stop_status: run.stopDecision.status, created_at: run.startedAt, updated_at: run.completedAt,
      counts: { survivors: run.survivorCount, candidates: run.candidateCount, gaps: run.gapCount, rejected: run.rejectedCount },
      match: run.match,
      result_summary: `${run.survivorCount} survivor(s), ${run.gapCount} gap(s); stop=${run.stopDecision.status}.`,
    })) };
  }));

  server.registerTool("get_research_budget_info", {
    title: "Get research budget expectations",
    description: MCP_TOOL_DESCRIPTIONS.get_research_budget_info,
    inputSchema: getResearchBudgetInfoInput,
    annotations: { ...annotations, openWorldHint: false },
  }, () => observed("get_research_budget_info", async () => getResearchBudgetInfo()));

  server.registerTool("compare_run_candidates", {
    title: "Compare candidates within one run",
    description: MCP_TOOL_DESCRIPTIONS.compare_run_candidates,
    inputSchema: compareRunCandidatesInput,
    annotations,
  }, ({ run_id, candidate_ids, dimensions, fresh_expand }, context) => observed("compare_run_candidates", async () => {
    const stored = await requiredRun(deps.getRun, run_id);
    if (!fresh_expand) return { ...compareRunCandidates(stored, candidate_ids, dimensions), freshExpansion: { performed: false, storedRunMutated: false } };
    const selectedCandidates = stored.candidates.filter((candidate) => candidate_ids.includes(candidate.id)
      || candidate.sourceGapIds.some((gapId) => candidate_ids.includes(gapId)));
    if (!selectedCandidates.length) throw new RangeError("fresh_expand requires at least one selected canonical candidate or a gap linked to a candidate.");
    const expanded = await deps.expandCompetitors({ ...stored, candidates: selectedCandidates }, undefined, context.mcpReq.signal);
    const compared = compareRunCandidates(expanded, candidate_ids, dimensions);
    const calls = expanded.competitorRecall.primaryQueries + expanded.competitorRecall.crossCheckQueries + expanded.competitorRecall.escalationQueries;
    return {
      ...compared, sourcePolicy: "stored_run_plus_bounded_fresh_competitor_expansion" as const, providerCalls: calls,
      freshExpansion: { performed: true, storedRunMutated: false, selectedCandidateIds: selectedCandidates.map((item) => item.id), retrievalCalls: calls, note: "Fresh competitor evidence was merged only into this comparison view; stored scores and lifecycle decisions were not recomputed or mutated." },
    };
  }));
}

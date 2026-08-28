import type { McpServer } from "@modelcontextprotocol/server";
import { ResearchConfigurationError } from "../research/providers.ts";
import { runResearch } from "../research/pipeline.ts";
import { getResearchResultById } from "../research/store.ts";
import type { ResearchResult } from "../research/types.ts";
import { activelyFalsifyOpportunity } from "./falsify.ts";
import { currentMcpRequestId, recordMcpCall } from "./observability.ts";
import { compareIdeas } from "../research/comparison.ts";
import { compareResearchRuns } from "../research/changes.ts";
import { exportResearchResult } from "../research/exports.ts";
import { recordValidationOutcome } from "../research/validation-outcomes.ts";
import {
  compareIdeasInput, compareResearchRunsInput, exportResearchRunInput, falsifyOpportunityInput, findMarketGapsInput,
  getResearchRunInput, inspectCompetitorsInput, inspectRunInput, recordValidationOutcomeInput, rerunResearchInput, researchMarketInput, runResearchModeInput,
} from "./schemas.ts";
import { summarizeCompetitors, summarizeGaps, summarizeResearch } from "./summaries.ts";
import { freshCompetitorExpansion } from "../research/competitor-discovery.ts";
import { resolveCandidateId } from "../research/candidate-ids.ts";

type ToolDependencies = {
  research: typeof runResearch;
  getRun: typeof getResearchResultById;
  falsify: typeof activelyFalsifyOpportunity;
  compare: typeof compareIdeas;
  expandCompetitors: typeof freshCompetitorExpansion;
};

const defaults: ToolDependencies = { research: runResearch, getRun: getResearchResultById, falsify: activelyFalsifyOpportunity, compare: compareIdeas, expandCompetitors: freshCompetitorExpansion };

function textResult<T extends object>(value: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Novelty Engine tool failed.";
  const code = error instanceof ResearchConfigurationError ? "RESEARCH_NOT_CONFIGURED"
    : error instanceof DOMException && error.name === "AbortError" || /cancel|aborted/i.test(message) ? "RESEARCH_CANCELLED"
    : error instanceof RangeError && /research query/i.test(message) ? "INVALID_QUERY"
      : error instanceof RangeError ? "INVALID_OR_MISSING_RUN"
        : /malformed/i.test(message) ? "MALFORMED_PROVIDER_RESPONSE"
          : /abort|time(?:d)?\s*out/i.test(message) ? "RESEARCH_TIMEOUT" : "RESEARCH_PROVIDER_ERROR";
  const publicMessage = error instanceof ResearchConfigurationError ? error.message
    : code === "RESEARCH_CANCELLED" ? "Research was cancelled before completion."
      : code === "INVALID_QUERY" || code === "INVALID_OR_MISSING_RUN" ? message
        : code === "MALFORMED_PROVIDER_RESPONSE" ? "The search provider returned a malformed response."
          : code === "RESEARCH_TIMEOUT" ? "The research provider or run timed out."
            : "The search provider request failed. Use the request ID to find the privacy-safe server log.";
  const value: Record<string, unknown> = { error: publicMessage, code, requestId: currentMcpRequestId(), fabricatedEvidence: false };
  if (error instanceof ResearchConfigurationError) value.requiredEnvironmentVariables = error.requiredEnvironmentVariables;
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value, isError: true };
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return error instanceof ResearchConfigurationError ? "RESEARCH_NOT_CONFIGURED"
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

export function registerNoveltyTools(server: McpServer, dependencies: Partial<ToolDependencies> = {}) {
  const deps = { ...defaults, ...dependencies };
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

  server.registerTool("research_market", {
    title: "Research a market",
    description: "Run Novelty Engine's complete V2.2 market map, source-quality, evidence gate, active counterevidence, competitor/substitute, deduplication, falsification, scoring-with-reasons, and 24–72 hour validation pipeline. It may return insufficient_evidence instead of ideas.",
    inputSchema: researchMarketInput,
    annotations,
  }, ({ query, depth, founder_constraints }, context) => observed("research_market", async () => summarizeResearch(await deps.research(query, { depth, userContext: founder_constraints, signal: context.mcpReq.signal }))));

  server.registerTool("find_market_gaps", {
    title: "Find ranked market gaps",
    description: "Return the strongest evidence-backed, plausible, or speculative gaps from a completed Novelty Engine run, with supporting and counter citations and explicit unknowns.",
    inputSchema: findMarketGapsInput,
    annotations,
  }, ({ run_id, limit, cursor }) => observed("find_market_gaps", async () => summarizeGaps(await requiredRun(deps.getRun, run_id), limit, cursor)));

  server.registerTool("inspect_competitors", {
    title: "Inspect competitors",
    description: "Return the cited competitor map from a completed research run, or optionally run the same high-recall primary/cross-check/escalation logic fresh for a selected candidate. Unsupported factual fields remain explicit nulls.",
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
    description: "Actively search for competitors, failed demand, unfavorable economics, regulatory, liability, trust, and feasibility counterevidence for one candidate. Optionally ground the challenge in a prior run and candidate ID.",
    inputSchema: falsifyOpportunityInput,
    annotations,
  }, (input) => observed("falsify_opportunity", async () => deps.falsify(input)));

  server.registerTool("get_research_run", {
    title: "Get a research run",
    description: "Retrieve a completed run by ID. Returns a concise research summary by default; request the full internal JSON only for detailed debugging or follow-up analysis.",
    inputSchema: getResearchRunInput,
    annotations,
  }, ({ run_id, include_full }) => observed("get_research_run", async () => {
    const result = await requiredRun(deps.getRun, run_id);
    return include_full ? { runId: result.id, fullResearchResult: result } : summarizeResearch(result);
  }));

  server.registerTool("run_research_mode", {
    title: "Run a Novelty Engine intent mode",
    description: "Use the shared V2.1+ pipeline for find-business, market/company research, competitor/gap finding, falsification, or idea validation. Roles share one normalized evidence set and bounded counterevidence budget.",
    inputSchema: runResearchModeInput,
    annotations,
  }, ({ mode, query, depth, founder_constraints }, context) => observed("run_research_mode", async () => summarizeResearch(await deps.research(query, { mode, depth, userContext: founder_constraints, signal: context.mcpReq.signal }))));

  server.registerTool("compare_ideas", {
    title: "Compare 2–5 ideas",
    description: "Research 2–5 ideas under one shared provider-call cap and compare qualitative evidence, demand, residual gap, differentiation, feasibility, economics, distribution, switching, trust, regulation/liability, defensibility, incumbent response, and decisive risks. Returns a written recommendation without fake precision.",
    inputSchema: compareIdeasInput,
    annotations,
  }, ({ ideas }) => observed("compare_ideas", async () => deps.compare(ideas)));

  server.registerTool("export_research_run", {
    title: "Export a research run",
    description: "Export the canonical report and evidence lineage as structured JSON, Markdown, or a print/PDF-ready representation.",
    inputSchema: exportResearchRunInput,
    annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id, format }) => observed("export_research_run", async () => ({ runId: run_id, format, export: exportResearchResult(await requiredRun(deps.getRun, run_id), format) })));

  server.registerTool("compare_research_runs", {
    title: "Detect material changes between snapshots",
    description: "Compare two persisted research snapshots, suppress trivial/syndicated differences, and surface supported material changes with before/after evidence IDs.",
    inputSchema: compareResearchRunsInput,
    annotations: { ...annotations, openWorldHint: false },
  }, ({ baseline_run_id, comparison_run_id }) => observed("compare_research_runs", async () => compareResearchRuns(
    await requiredRun(deps.getRun, baseline_run_id), await requiredRun(deps.getRun, comparison_run_id),
  )));

  server.registerTool("rerun_research", {
    title: "Rerun research incrementally",
    description: "Rerun a stored query against current evidence with cache bypass, preserving the baseline run for material-change comparison.",
    inputSchema: rerunResearchInput, annotations,
  }, ({ run_id, depth }, context) => observed("rerun_research", async () => {
    const baseline = await requiredRun(deps.getRun, run_id);
    const rerun = await deps.research(baseline.query, { mode: baseline.mode, depth, bypassCache: true, signal: context.mcpReq.signal });
    return { baselineRunId: baseline.id, result: summarizeResearch(rerun), materialChanges: compareResearchRuns(baseline, rerun) };
  }));

  server.registerTool("source_check", {
    title: "Audit evidence and citations",
    description: "Inspect citation coverage, source quality/diversity, duplicate and stale warnings, contradictions, and unresolved claim states for a stored run.",
    inputSchema: inspectRunInput, annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id }) => observed("source_check", async () => {
    const run = await requiredRun(deps.getRun, run_id);
    const unsupportedClaims = run.claimLineage.filter((item) => item.major && item.supportingEvidenceIds.length === 0);
    const roleMismatches = run.claimLineage.filter((item) => item.evidenceDecisions.some((decision) => !decision.roleCompatible));
    const relevanceRejections = run.claimLineage.filter((item) => item.evidenceDecisions.some((decision) => decision.roleCompatible && !decision.relevant));
    return {
      runId: run.id, coverage: run.coverage, checkpoint: run.checkpoints.find((item) => item.name === "citation_validation"),
      citationCoverage: run.citationCoverage,
      snapshotWarnings: { duplicates: run.evidenceSnapshot.duplicateWarnings, missingFamilies: run.evidenceSnapshot.missingSourceFamilyWarnings },
      unsupportedClaims,
      supportRoleMismatches: roleMismatches,
      relevanceRejections,
      claimLineage: run.claimLineage,
      contradictions: run.assumptionLedger.filter((item) => item.factState === "CONTRADICTED"),
      sources: run.sources.map((item) => ({ id: item.id, url: item.sourceUrl, pageIdentity: item.pageIdentity, relevanceAssessment: item.relevanceAssessment, assessment: item.sourceAssessment, security: item.security })),
    };
  }));

  server.registerTool("next_best_action", {
    title: "Get the single next-best action",
    description: "Return the highest-information validation or search-expansion action and its success/kill criteria from a stored run.",
    inputSchema: inspectRunInput, annotations: { ...annotations, openWorldHint: false },
  }, ({ run_id }) => observed("next_best_action", async () => ({ runId: run_id, nextBestAction: (await requiredRun(deps.getRun, run_id)).nextBestAction })));

  server.registerTool("record_validation_outcome", {
    title: "Record an external validation outcome",
    description: "Persist measured validation results. A success becomes VALIDATED only when the strict research evidence gate also passed and an inspectable public artifact URL is supplied; otherwise it remains INVESTIGATE.",
    inputSchema: recordValidationOutcomeInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ run_id, candidate_id, experiment_type, success, observed_metrics, artifact_urls }) => observed("record_validation_outcome", async () => recordValidationOutcome({
    runId: run_id, candidateId: candidate_id, experimentType: experiment_type, success, observedMetrics: observed_metrics, artifactUrls: artifact_urls,
  })));
}

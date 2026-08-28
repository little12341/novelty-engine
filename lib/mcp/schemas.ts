import { z } from "zod";
import { normalizeCompanyResearchRequest } from "../research/company-identity.ts";
import { RUN_CANDIDATE_COMPARISON_DIMENSIONS } from "../research/run-candidate-comparison.ts";
import { SUPPLIED_SOURCE_MAX_COUNT, SUPPLIED_SOURCE_MAX_TEXT_CHARS, SUPPLIED_SOURCE_MAX_TOTAL_TEXT_CHARS } from "../research/supplied-sources.ts";
import { validateExternalResearchUrl } from "../research/url-policy.ts";

const runId = z.string().regex(/^research_[a-zA-Z0-9_]{8,80}$/, "Invalid research run ID.");
const depth = z.enum(["fast", "standard", "deep"]).default("standard");
const founderConstraints = z.object({
  budget: z.string().trim().max(120).optional(), availableCapital: z.string().trim().max(120).optional(),
  teamSize: z.number().int().min(1).max(100).optional(), timeToMvpWeeks: z.number().int().min(1).max(260).optional(),
  technicalLimits: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  industryExclusions: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  geography: z.string().trim().max(120).optional(), geographyExclusions: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).optional(),
  distributionChannels: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
}).strict();

const sourceType = z.enum([
  "official_company", "pricing", "documentation", "reddit", "forum", "github", "product_directory",
  "app_marketplace", "review", "industry_publication", "regulator", "research", "patent", "job_posting", "marketplace", "other",
]);

export const suppliedSourceInput = z.object({
  url: z.string().trim().min(8).max(2_048).superRefine((value, context) => {
    const decision = validateExternalResearchUrl(value);
    if (!decision.allowed) context.addIssue({ code: "custom", message: `URL is not allowed (${decision.reason ?? "invalid_url"}).` });
  }).describe("Public HTTP(S) source URL. Private/local destinations, credentials, credential query parameters, and non-standard ports are rejected."),
  title: z.string().trim().min(1).max(300),
  snippet: z.string().trim().min(1).max(SUPPLIED_SOURCE_MAX_TEXT_CHARS).optional(),
  excerpt: z.string().trim().min(1).max(SUPPLIED_SOURCE_MAX_TEXT_CHARS).optional(),
  content: z.string().trim().min(1).max(SUPPLIED_SOURCE_MAX_TEXT_CHARS).optional(),
  publication_date: z.string().trim().max(64).optional(),
  source_type: sourceType.optional().describe("Optional untrusted source-type declaration. Novelty independently infers the operative type from the URL and records mismatches."),
  publisher: z.string().trim().min(1).max(160).optional().describe("Optional unverified publisher label; it never raises source trust."),
  domain: z.string().trim().min(3).max(253).optional().describe("Optional declared hostname; mismatches with the URL are ignored and audited."),
  retrieved_at: z.string().trim().max(64).optional(),
}).strict().refine((value) => Boolean(value.snippet || value.excerpt || value.content), {
  message: "Each source requires a non-empty snippet, excerpt, or content field.", path: ["snippet"],
});

const suppliedSources = z.array(suppliedSourceInput).min(1).max(SUPPLIED_SOURCE_MAX_COUNT).superRefine((items, context) => {
  const total = items.reduce((sum, item) => sum + item.title.length + (item.snippet?.length ?? 0) + (item.excerpt?.length ?? 0) + (item.content?.length ?? 0), 0);
  if (total > SUPPLIED_SOURCE_MAX_TOTAL_TEXT_CHARS) context.addIssue({ code: "custom", message: `Supplied source text exceeds the ${SUPPLIED_SOURCE_MAX_TOTAL_TEXT_CHARS}-character request limit.` });
});

export const researchMarketInput = z.object({
  query: z.string().trim().min(8).max(500).describe("Complete market research or ideation request. The result may intentionally contain no candidates when evidence is insufficient."),
  depth,
  founder_constraints: founderConstraints.optional(),
  retrieval_mode: z.literal("hosted").default("hosted").describe("This backward-compatible tool uses hosted Tavily/Brave retrieval. Use research_from_sources for the recommended zero-provider-credit path."),
}).strict();

export const researchFromSourcesInput = z.object({
  query: z.string().trim().min(8).max(500).describe("Complete market research or commercial ideation request."),
  depth,
  founder_constraints: founderConstraints.optional(),
  sources: suppliedSources.describe("Claude/web- or user-supplied public source records. Novelty does not fetch these URLs."),
}).strict();

export const addSourcesToRunInput = z.object({
  run_id: runId,
  sources: suppliedSources.describe("Additional public evidence gathered outside Novelty hosted search."),
  founder_constraints: founderConstraints.optional(),
}).strict();

export const getResearchRequirementsInput = z.object({ run_id: runId }).strict();

export const findMarketGapsInput = z.object({
  run_id: runId.describe("ID returned by research_market."),
  limit: z.number().int().min(1).max(10).default(5).describe("Maximum ranked gaps to return."),
  cursor: z.number().int().min(0).max(10_000).default(0).describe("Zero-based pagination offset."),
}).strict();

export const inspectCompetitorsInput = z.object({
  run_id: runId.describe("ID returned by research_market."),
  limit: z.number().int().min(1).max(15).default(8).describe("Maximum competitors to return."),
  cursor: z.number().int().min(0).max(10_000).default(0).describe("Zero-based pagination offset."),
  fresh_expand: z.boolean().default(false).describe("Run an optional fresh high-recall primary, independent cross-check, and escalation expansion using the stored candidate definition."),
  candidate_id: z.string().regex(/^candidate_[a-zA-Z0-9_]{3,100}$/).optional().describe("Optional candidate from the stored run to focus the fresh expansion."),
}).strict();

export const falsifyOpportunityInput = z.object({
  opportunity: z.string().trim().min(8).max(1_000).describe("Candidate opportunity to challenge with targeted counterevidence searches."),
  run_id: runId.optional().describe("Optional prior run containing the candidate and its evidence."),
  candidate_id: z.string().regex(/^candidate_[a-zA-Z0-9_]{3,100}$/).optional().describe("Optional candidate ID from the prior run."),
}).strict().refine((value) => !value.candidate_id || value.run_id, { message: "candidate_id requires run_id." });

export const getResearchRunInput = z.object({
  run_id: runId.describe("Previously completed research run ID."),
  include_full: z.boolean().default(false).describe("Return the complete internal ResearchResult instead of its concise MCP summary."),
}).strict();

const researchMode = z.enum(["find_business", "research_market", "research_company", "find_competitors", "find_gaps", "falsify", "validate_idea"]);

export const runResearchModeInput = z.object({
  mode: researchMode.describe("Intent corresponding to /find-business, /research-market, /research-company, /find-competitors, /find-gaps, /falsify, or /validate-idea."),
  query: z.string().trim().min(8).max(500).optional().describe("Free-text research request. Required for every mode except research_company when at least one structured company identifier is supplied."),
  company_name: z.string().trim().min(2).max(120).optional().describe("Authoritative target company name for research_company."),
  domain: z.string().trim().min(4).max(253).optional().describe("Authoritative bare public company domain such as certificial.com; schemes, paths, credentials, ports, localhost, and IP addresses are rejected."),
  ticker: z.string().trim().min(1).max(10).optional().describe("Optional authoritative public-market ticker, normalized to uppercase."),
  country: z.string().trim().min(2).max(80).optional().describe("Optional country or jurisdiction used to disambiguate the target company."),
  depth,
  founder_constraints: founderConstraints.optional(),
  retrieval_mode: z.literal("hosted").default("hosted").describe("Named-intent fresh runs use optional hosted retrieval. For supplied evidence use research_from_sources."),
}).strict().superRefine((value, context) => {
  const structured = Boolean(value.company_name || value.domain || value.ticker || value.country);
  if (value.mode !== "research_company") {
    if (!value.query) context.addIssue({ code: "custom", path: ["query"], message: "query is required for this research mode." });
    if (structured) context.addIssue({ code: "custom", path: ["company_name"], message: "Structured company identifiers are only valid when mode is research_company." });
    return;
  }
  if (!value.query && !structured) {
    context.addIssue({ code: "custom", path: ["query"], message: "research_company requires query or at least one structured company identifier." });
    return;
  }
  try {
    normalizeCompanyResearchRequest({ query: value.query, companyName: value.company_name, domain: value.domain, ticker: value.ticker, country: value.country });
  } catch (error) {
    context.addIssue({ code: "custom", path: value.domain ? ["domain"] : ["company_name"], message: error instanceof Error ? error.message : "Invalid company identity." });
  }
});

export const compareIdeasInput = z.object({
  ideas: z.array(z.string().trim().min(8).max(500)).min(2).max(5).describe("Two to five ideas researched independently under one shared provider-call budget."),
}).strict();

export const exportResearchRunInput = z.object({
  run_id: runId,
  format: z.enum(["json", "markdown", "print", "csv", "competitor_matrix", "validation_plan", "opportunity_brief", "investor_memo", "bibliography"]).default("markdown"),
}).strict();

export const rerunResearchInput = z.object({
  run_id: runId,
  depth,
  retrieval_mode: z.enum(["auto", "hosted"]).default("auto").describe("auto preserves the baseline retrieval mode. Supplied-source baselines require add_sources_to_run; hosted explicitly opts into Tavily/Brave retrieval."),
}).strict();
export const inspectRunInput = z.object({ run_id: runId }).strict();
export const recordValidationOutcomeInput = z.object({
  run_id: runId, candidate_id: z.string().regex(/^candidate_[a-zA-Z0-9_]{3,100}$/),
  experiment_type: z.enum(["fake_door", "cold_outreach", "concierge", "manual_service", "clickable_prototype", "preorder", "pricing_test", "comparison_ad", "marketplace_listing", "waitlist", "interview", "technical_poc"]),
  success: z.boolean(), observed_metrics: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  artifact_urls: z.array(z.string().url().max(2_000)).max(20).default([]),
}).strict();

export const compareResearchRunsInput = z.object({
  baseline_run_id: runId,
  comparison_run_id: runId,
}).strict().refine((value) => value.baseline_run_id !== value.comparison_run_id, { message: "Run IDs must be different." });

const discoveryFilterShape = {
  limit: z.number().int().min(1).max(50).default(20).describe("Maximum run summaries to return."),
  cursor: z.string().regex(/^rrc_[a-zA-Z0-9_-]{8,300}$/, "Malformed research-run cursor.").optional().describe("Opaque cursor returned by a prior call using the same filters."),
  created_after: z.iso.datetime({ offset: true }).optional(),
  created_before: z.iso.datetime({ offset: true }).optional(),
  updated_after: z.iso.datetime({ offset: true }).optional(),
  updated_before: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(["complete", "partial"]).optional(),
  stop_status: z.enum(["proceed", "partial_research", "insufficient_evidence"]).optional(),
  mode: researchMode.optional(),
  depth: z.enum(["fast", "standard", "deep"]).optional(),
};

const validateDateRanges = (value: { created_after?: string; created_before?: string; updated_after?: string; updated_before?: string }, context: z.RefinementCtx) => {
  if (value.created_after && value.created_before && new Date(value.created_after).getTime() > new Date(value.created_before).getTime()) context.addIssue({ code: "custom", path: ["created_after"], message: "created_after must not be later than created_before." });
  if (value.updated_after && value.updated_before && new Date(value.updated_after).getTime() > new Date(value.updated_before).getTime()) context.addIssue({ code: "custom", path: ["updated_after"], message: "updated_after must not be later than updated_before." });
};

export const listResearchRunsInput = z.object(discoveryFilterShape).strict().superRefine(validateDateRanges);

export const searchResearchRunsInput = z.object({
  query: z.string().trim().min(2).max(200).describe("Keyword or phrase matched with transparent canonical-token similarity and exact-substring boosting; this is not embedding/vector search."),
  ...discoveryFilterShape,
}).strict().superRefine(validateDateRanges);

export const getResearchBudgetInfoInput = z.object({}).strict();

export const compareRunCandidatesInput = z.object({
  run_id: runId.describe("One completed stored run containing every candidate or gap to compare."),
  candidate_ids: z.array(z.string().regex(/^(?:candidate|gap)_[a-zA-Z0-9_]{3,120}$/)).min(2).max(5).refine((items) => new Set(items).size === items.length, "candidate_ids must be unique.")
    .describe("Two to five canonical candidate IDs or gap IDs from the same stored run."),
  dimensions: z.array(z.enum(RUN_CANDIDATE_COMPARISON_DIMENSIONS)).min(1).max(RUN_CANDIDATE_COMPARISON_DIMENSIONS.length).optional(),
  fresh_expand: z.boolean().default(false).describe("Default false: use only stored evidence and make zero provider calls. When true, perform one bounded fresh competitor expansion for the selected candidates before comparing; the stored run is not mutated."),
}).strict();

export const MCP_TOOL_NAMES = [
  "research_market", "research_from_sources", "add_sources_to_run", "get_research_requirements",
  "find_market_gaps", "inspect_competitors", "falsify_opportunity", "get_research_run",
  "run_research_mode", "compare_ideas", "export_research_run", "compare_research_runs",
  "rerun_research", "source_check", "next_best_action",
  "record_validation_outcome", "list_research_runs", "search_research_runs", "get_research_budget_info", "compare_run_candidates",
] as const;

export const MCP_TOOL_CATALOG = [
  { name: "research_market", arguments: { query: "string (8-500 characters)", retrieval_mode: "hosted" }, cost: "up to configured hosted provider-call cap", behavior: "backward-compatible optional hosted Tavily/Brave market research" },
  { name: "research_from_sources", arguments: { query: "string (8-500 characters)", depth: "optional", founder_constraints: "optional", sources: `1-${SUPPLIED_SOURCE_MAX_COUNT} bounded public source objects` }, cost: "zero Tavily/Brave calls", behavior: "runs supplied evidence through the complete shared V2.2 pipeline and persists a canonical run" },
  { name: "add_sources_to_run", arguments: { run_id: "string", sources: `1-${SUPPLIED_SOURCE_MAX_COUNT} bounded public source objects` }, cost: "zero Tavily/Brave calls", behavior: "creates an immutable descendant run with merged evidence and recomputed downstream analysis" },
  { name: "get_research_requirements", arguments: { run_id: "string" }, cost: "stored-run analysis; zero provider calls", behavior: "returns missing evidence families, unresolved claims, and suggested Claude/web search objectives" },
  { name: "find_market_gaps", arguments: { run_id: "string", limit: "optional integer 1-10", cursor: "optional offset" }, cost: "stored-run lookup", behavior: "reads and ranks gaps already stored in one completed run; never starts fresh research" },
  { name: "inspect_competitors", arguments: { run_id: "string", limit: "optional integer 1-15", cursor: "optional offset", fresh_expand: "optional boolean", candidate_id: "optional candidate ID" }, cost: "stored-run lookup; bounded fresh research only when fresh_expand=true", behavior: "stored read by default; explicit fresh_expand performs a bounded non-mutating expansion" },
  { name: "falsify_opportunity", arguments: { opportunity: "string (8-1000 characters)", run_id: "optional string", candidate_id: "optional string" }, cost: "up to 4 focused provider searches" },
  { name: "get_research_run", arguments: { run_id: "string", include_full: "optional boolean" }, cost: "stored-run lookup", behavior: "include_full=true returns the internal ResearchResult, not the canonical export" },
  { name: "run_research_mode", arguments: { mode: "supported intent mode", query: "optional only for structured research_company", company_name: "optional", domain: "optional bare hostname", ticker: "optional", country: "optional", retrieval_mode: "hosted" }, cost: "up to configured hosted provider-call cap", behavior: "starts an optional hosted intent-scoped shared-pipeline run; mode=find_gaps is fresh research" },
  { name: "compare_ideas", arguments: { ideas: "array of 2-5 strings" }, cost: "shared bounded comparison budget" },
  { name: "export_research_run", arguments: { run_id: "string", format: "supported report/export format" }, cost: "stored-run lookup", behavior: "returns the canonical export/report representation, including for format=json" },
  { name: "compare_research_runs", arguments: { baseline_run_id: "string", comparison_run_id: "string" }, cost: "two stored-run lookups" },
  { name: "rerun_research", arguments: { run_id: "string", depth: "fast, standard, or deep", retrieval_mode: "auto or hosted" }, cost: "hosted only for a hosted baseline or explicit hosted opt-in", behavior: "supplied-source baselines require add_sources_to_run so no provider spend is implicit" },
  { name: "source_check", arguments: { run_id: "string" }, cost: "stored-run citation integrity audit" },
  { name: "next_best_action", arguments: { run_id: "string" }, cost: "stored-run decision lookup" },
  { name: "record_validation_outcome", arguments: { run_id: "string", candidate_id: "string", experiment_type: "supported type", success: "boolean", observed_metrics: "1-20 strings", artifact_urls: "optional public URLs" }, cost: "validation-record persistence" },
  { name: "list_research_runs", arguments: { limit: "optional integer 1-50", cursor: "optional opaque cursor", created_after: "optional ISO date-time", created_before: "optional ISO date-time", updated_after: "optional ISO date-time", updated_before: "optional ISO date-time", status: "optional complete|partial", stop_status: "optional stop decision", mode: "optional research mode", depth: "optional fast|standard|deep" }, cost: "current-client stored-run index lookup; no research calls" },
  { name: "search_research_runs", arguments: { query: "string 2-200 characters", limit: "optional integer 1-50", cursor: "optional opaque cursor", filters: "optional date/status/stop/mode/depth filters" }, cost: "current-client canonical token/keyword lookup; no embeddings or research calls" },
  { name: "get_research_budget_info", arguments: {}, cost: "configuration-only lookup; no research calls and no sensitive quota/provider details" },
  { name: "compare_run_candidates", arguments: { run_id: "string", candidate_ids: "2-5 canonical candidate or gap IDs", dimensions: "optional supported dimensions", fresh_expand: "optional boolean; false by default" }, cost: "stored-run comparison; bounded fresh competitor research only when fresh_expand=true" },
] as const;

import { z } from "zod";

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

export const researchMarketInput = z.object({
  query: z.string().trim().min(8).max(500).describe("Complete market research or ideation request. The result may intentionally contain no candidates when evidence is insufficient."),
  depth,
  founder_constraints: founderConstraints.optional(),
}).strict();

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
  query: z.string().trim().min(8).max(500),
  depth,
  founder_constraints: founderConstraints.optional(),
}).strict();

export const compareIdeasInput = z.object({
  ideas: z.array(z.string().trim().min(8).max(500)).min(2).max(5).describe("Two to five ideas researched independently under one shared provider-call budget."),
}).strict();

export const exportResearchRunInput = z.object({
  run_id: runId,
  format: z.enum(["json", "markdown", "print", "csv", "competitor_matrix", "validation_plan", "opportunity_brief", "investor_memo", "bibliography"]).default("markdown"),
}).strict();

export const rerunResearchInput = z.object({ run_id: runId, depth, }).strict();
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

export const MCP_TOOL_NAMES = [
  "research_market", "find_market_gaps", "inspect_competitors", "falsify_opportunity", "get_research_run",
  "run_research_mode", "compare_ideas", "export_research_run", "compare_research_runs",
  "rerun_research", "source_check", "next_best_action",
  "record_validation_outcome",
] as const;

export const MCP_TOOL_CATALOG = [
  { name: "research_market", arguments: { query: "string (8-500 characters)" }, cost: "up to configured provider-call cap" },
  { name: "find_market_gaps", arguments: { run_id: "string", limit: "optional integer 1-10", cursor: "optional offset" }, cost: "stored-run lookup" },
  { name: "inspect_competitors", arguments: { run_id: "string", limit: "optional integer 1-15", cursor: "optional offset", fresh_expand: "optional boolean", candidate_id: "optional candidate ID" }, cost: "stored-run lookup; bounded fresh research only when fresh_expand=true" },
  { name: "falsify_opportunity", arguments: { opportunity: "string (8-1000 characters)", run_id: "optional string", candidate_id: "optional string" }, cost: "up to 4 focused provider searches" },
  { name: "get_research_run", arguments: { run_id: "string", include_full: "optional boolean" }, cost: "stored-run lookup" },
  { name: "run_research_mode", arguments: { mode: "supported intent mode", query: "string (8-500 characters)" }, cost: "up to configured provider-call cap" },
  { name: "compare_ideas", arguments: { ideas: "array of 2-5 strings" }, cost: "shared bounded comparison budget" },
  { name: "export_research_run", arguments: { run_id: "string", format: "json, markdown, or print" }, cost: "stored-run lookup" },
  { name: "compare_research_runs", arguments: { baseline_run_id: "string", comparison_run_id: "string" }, cost: "two stored-run lookups" },
  { name: "rerun_research", arguments: { run_id: "string", depth: "fast, standard, or deep" }, cost: "fresh bounded research run" },
  { name: "source_check", arguments: { run_id: "string" }, cost: "stored-run citation integrity audit" },
  { name: "next_best_action", arguments: { run_id: "string" }, cost: "stored-run decision lookup" },
  { name: "record_validation_outcome", arguments: { run_id: "string", candidate_id: "string", experiment_type: "supported type", success: "boolean", observed_metrics: "1-20 strings", artifact_urls: "optional public URLs" }, cost: "validation-record persistence" },
] as const;

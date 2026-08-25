import { z } from "zod";

const runId = z.string().regex(/^research_[a-zA-Z0-9_]{8,80}$/, "Invalid research run ID.");

export const researchMarketInput = z.object({
  query: z.string().trim().min(8).max(500).describe("Complete market research or ideation request. The result may intentionally contain no candidates when evidence is insufficient."),
}).strict();

export const findMarketGapsInput = z.object({
  run_id: runId.describe("ID returned by research_market."),
  limit: z.number().int().min(1).max(10).default(5).describe("Maximum ranked gaps to return."),
}).strict();

export const inspectCompetitorsInput = z.object({
  run_id: runId.describe("ID returned by research_market."),
  limit: z.number().int().min(1).max(15).default(8).describe("Maximum competitors to return."),
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

export const MCP_TOOL_NAMES = [
  "research_market", "find_market_gaps", "inspect_competitors", "falsify_opportunity", "get_research_run",
] as const;

export const MCP_TOOL_CATALOG = [
  { name: "research_market", arguments: { query: "string (8-500 characters)" }, cost: "up to configured provider-call cap" },
  { name: "find_market_gaps", arguments: { run_id: "string", limit: "optional integer 1-10" }, cost: "stored-run lookup" },
  { name: "inspect_competitors", arguments: { run_id: "string", limit: "optional integer 1-15" }, cost: "stored-run lookup" },
  { name: "falsify_opportunity", arguments: { opportunity: "string (8-1000 characters)", run_id: "optional string", candidate_id: "optional string" }, cost: "up to 4 focused provider searches" },
  { name: "get_research_run", arguments: { run_id: "string", include_full: "optional boolean" }, cost: "stored-run lookup" },
] as const;

import { NextResponse } from "next/server";
import { RESEARCH_ENGINE_VERSION, RESEARCH_SCHEMA_VERSION } from "@/lib/research/types";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Novelty Engine Research API", version: RESEARCH_ENGINE_VERSION, description: "Evidence-driven normalization, elimination, falsification, survivor reporting, history, and export API. Claude/user-supplied sources are the recommended zero-Tavily/Brave-call default; hosted search is optional. Research survival is not external validation." },
    servers: [{ url: "/", description: "Current deployment" }],
    paths: {
      "/api/research": {
        get: { summary: "Research service metadata and command routing", responses: { "200": { description: "Service metadata" } } },
        post: {
          summary: "Run bounded research", requestBody: { required: true, content: { "application/json": { schema: { type: "object", anyOf: [
            { required: ["query"] }, { required: ["mode", "company_name"] }, { required: ["mode", "domain"] }, { required: ["mode", "ticker"] }, { required: ["mode", "country"] },
          ], properties: {
            query: { type: "string", minLength: 8, maxLength: 500, description: "Optional for research_company when at least one structured identifier is supplied." }, mode: { type: "string" }, depth: { enum: ["fast", "standard", "deep"] },
            retrieval_mode: { enum: ["supplied_sources", "hosted"], description: "supplied_sources makes zero Tavily/Brave calls; hosted uses deployment-owned provider credits when enabled." },
            sources: { type: "array", minItems: 1, maxItems: 48, description: "Required for supplied_sources. Text is untrusted, sanitized, bounded, and audited; Novelty does not fetch these URLs.", items: { type: "object", additionalProperties: false, required: ["url", "title"], properties: {
              url: { type: "string", maxLength: 2048 }, title: { type: "string", minLength: 1, maxLength: 300 },
              snippet: { type: "string", minLength: 1, maxLength: 4000 }, excerpt: { type: "string", minLength: 1, maxLength: 4000 }, content: { type: "string", minLength: 1, maxLength: 4000 },
              publication_date: { type: "string", maxLength: 64 }, source_type: { type: "string" }, publisher: { type: "string", maxLength: 160 }, domain: { type: "string", maxLength: 253 }, retrieved_at: { type: "string", maxLength: 64 },
            }, anyOf: [{ required: ["snippet"] }, { required: ["excerpt"] }, { required: ["content"] }] } },
            company_name: { type: "string", minLength: 2, maxLength: 120 }, domain: { type: "string", description: "Bare public hostname; URL schemes, paths, credentials, ports, localhost, and IP addresses are rejected." },
            ticker: { type: "string", minLength: 1, maxLength: 10 }, country: { type: "string", minLength: 2, maxLength: 80 },
            bypassCache: { type: "boolean" }, userContext: { type: "object", description: "Current-run founder constraints" },
          } } } } }, responses: { "200": { description: `ResearchResult schema ${RESEARCH_SCHEMA_VERSION}` }, "400": { description: "Invalid request" }, "429": { description: "Rate/cost/concurrency budget" }, "503": { description: "Provider or durable protection not configured" } },
        },
      },
      "/api/research/history": { get: { summary: "List or canonical-token search saved runs in the automatic current-client namespace", parameters: [
        { name: "query", in: "query", schema: { type: "string", minLength: 2, maxLength: 200 }, description: "Transparent keyword/canonical-token lookup, not embeddings or vector search." },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } }, { name: "cursor", in: "query", schema: { type: "string" } },
        { name: "created_after", in: "query", schema: { type: "string", format: "date-time" } }, { name: "created_before", in: "query", schema: { type: "string", format: "date-time" } },
        { name: "updated_after", in: "query", schema: { type: "string", format: "date-time" } }, { name: "updated_before", in: "query", schema: { type: "string", format: "date-time" } },
        { name: "status", in: "query", schema: { enum: ["complete", "partial"] } }, { name: "stop_status", in: "query", schema: { enum: ["proceed", "partial_research", "insufficient_evidence"] } },
        { name: "mode", in: "query", schema: { type: "string" } }, { name: "depth", in: "query", schema: { enum: ["fast", "standard", "deep"] } },
      ], responses: { "200": { description: "Scoped paginated saved-run summaries" }, "400": { description: "Malformed filter or cursor" } } } },
      "/api/research/export": { get: { summary: "Export a saved run", parameters: [{ name: "run_id", in: "query", required: true, schema: { type: "string" } }, { name: "format", in: "query", schema: { enum: ["json", "markdown", "print", "csv", "competitor_matrix", "validation_plan", "opportunity_brief", "investor_memo", "bibliography"] } }], responses: { "200": { description: "Requested export" }, "404": { description: "Run not found" } } } },
      "/api/research/feed": { get: { summary: "Filter opportunity signals from recent saved runs", responses: { "200": { description: "Daily/weekly saved-run feed" } } } },
      "/api/research/notes": { get: { summary: "List user-scoped notes, tags, folders, and decision logs", responses: { "200": { description: "Notes" } } }, post: { summary: "Save a bounded research note or decision log", responses: { "201": { description: "Saved note" } } } },
      "/api/research/feedback": { post: {
        summary: "Submit bounded public-beta feedback",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", additionalProperties: false, required: ["kind", "note"],
          properties: {
            runId: { type: "string", pattern: "^research_[a-zA-Z0-9_]{8,80}$", description: "Required except for installation_problem and mcp_failure." },
            kind: { enum: ["useful", "wrong", "irrelevant", "already_known", "missing_competitor", "competitor_does_not_solve_job", "opportunity_already_exists", "source_is_weak", "validation_result_success", "validation_result_failure", "installation_problem", "mcp_failure"] },
            targetId: { type: "string", maxLength: 120 }, note: { type: "string", minLength: 5, maxLength: 1000 },
          },
        } } } },
        responses: { "201": { description: "Feedback accepted" }, "400": { description: "Invalid feedback" }, "413": { description: "Request body exceeds 2048 bytes" }, "429": { description: "Feedback rate limit" } },
      } },
      "/api/research/validation": { get: { summary: "List external validation outcomes", responses: { "200": { description: "Validation outcomes" } } }, post: { summary: "Record measured validation results without bypassing the strict gate", responses: { "201": { description: "Persisted VALIDATED, INVESTIGATE, or KILLED outcome" } } } },
      "/api/mcp": { post: { summary: "MCP Streamable HTTP endpoint with 20 additive tools", description: "The recommended flow is Claude/web search → research_from_sources → get_research_requirements → add_sources_to_run. Optional hosted tools remain backward compatible and respect HOSTED_SEARCH_ENABLED.", responses: { "200": { description: "MCP response" } } } },
      "/api/mcp/health": { get: { summary: "Redacted public readiness status", responses: { "200": { description: "Readiness snapshot without secrets, event history, provider identity, or exact quotas" } } } },
    },
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

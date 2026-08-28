import { NextResponse } from "next/server";
import { RESEARCH_ENGINE_VERSION, RESEARCH_SCHEMA_VERSION } from "@/lib/research/types";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Novelty Engine Research API", version: RESEARCH_ENGINE_VERSION, description: "Evidence-driven search, elimination, falsification, survivor reporting, history, and export API. Research survival is not external validation." },
    servers: [{ url: "/", description: "Current deployment" }],
    paths: {
      "/api/research": {
        get: { summary: "Research service metadata and command routing", responses: { "200": { description: "Service metadata" } } },
        post: {
          summary: "Run bounded research", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["query"], properties: {
            query: { type: "string", minLength: 8, maxLength: 500 }, mode: { type: "string" }, depth: { enum: ["fast", "standard", "deep"] },
            bypassCache: { type: "boolean" }, userContext: { type: "object", description: "Current-run founder constraints" },
          } } } } }, responses: { "200": { description: `ResearchResult schema ${RESEARCH_SCHEMA_VERSION}` }, "400": { description: "Invalid request" }, "429": { description: "Rate/cost/concurrency budget" }, "503": { description: "Provider or durable protection not configured" } },
        },
      },
      "/api/research/history": { get: { summary: "List or search saved runs", parameters: [{ name: "query", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } }], responses: { "200": { description: "Saved run summaries" } } } },
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
      "/api/mcp": { post: { summary: "MCP Streamable HTTP endpoint", responses: { "200": { description: "MCP response" } } } },
      "/api/mcp/health": { get: { summary: "Redacted public readiness status", responses: { "200": { description: "Readiness snapshot without secrets, event history, provider identity, or exact quotas" } } } },
    },
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

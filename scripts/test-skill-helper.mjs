#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { NOVELTY_COMMAND_CATALOG, resolveClaudeCommand } from "../lib/research/intents.ts";

const execFileAsync = promisify(execFile);
let received = null;
const server = http.createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  received = JSON.parse(body);
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({
    schemaVersion: "2.1.0", mode: "research_market", id: "research_20260825120000_skilltest",
    ideationContext: { finalOutput: { researchLandscape: {}, signals: [], structuralGaps: [], candidateIdeas: [], rejectedIdeas: [], survivors: [], evidenceLineage: [], decisiveRisks: [], validationTests: [], stopDecision: { status: "insufficient_evidence" } } },
    stopDecision: { status: "insufficient_evidence" }, coverage: { coverageStatus: "insufficient" }, sources: [],
  }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Fixture server did not expose a TCP port.");
try {
  const skillRoot = process.env.NOVELTY_SKILL_ROOT
    ? path.resolve(process.env.NOVELTY_SKILL_ROOT)
    : path.join(process.cwd(), "skill", "novelty-engine");
  const helper = path.join(skillRoot, "scripts", "research.mjs");
  const query = "/research-market find a carefully bounded local service opportunity";
  const { stdout, stderr } = await execFileAsync(process.execPath, [helper, query], {
    cwd: process.cwd(), env: {
      ...process.env,
      NOVELTY_RESEARCH_API_URL: `http://127.0.0.1:${address.port}/api/research`,
      NOVELTY_RESEARCH_SOURCES_FILE: path.join(process.cwd(), "lib", "research", "fixtures", "v2-market.json"),
      NOVELTY_ALLOW_HOSTED_SEARCH: "false",
    },
  });
  assert.equal(stderr, "");
  assert.equal(received.query, query);
  assert.equal(received.retrieval_mode, "supplied_sources");
  assert.ok(Array.isArray(received.sources) && received.sources.length > 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.stopDecision.status, "insufficient_evidence");
  const skill = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.match(skill, /slash-like strings as Novelty intents/i);
  assert.match(skill, /\/source-check.*must call `Novelty:source_check`/i);
  assert.match(skill, /does not register these in Claude's native slash-command UI/i);
  assert.match(skill, /show my recent research.*list_research_runs/i);
  assert.match(skill, /find the COI research from yesterday.*search_research_runs/i);
  assert.match(skill, /compare_run_candidates.*zero provider calls/i);
  assert.match(skill, /get_research_budget_info/i);
  assert.match(skill, /substantially more retrieval/i);
  assert.match(skill, /research_from_sources/);
  assert.match(skill, /NOVELTY_RESEARCH_SOURCES_FILE/);
  const interfaces = await readFile(path.join(skillRoot, "references", "mcp-interfaces.md"), "utf8");
  assert.match(interfaces, /not vector or embedding search/i);
  assert.match(interfaces, /INVALID_COMPANY_IDENTITY/);
  for (const entry of NOVELTY_COMMAND_CATALOG) assert.match(skill, new RegExp(entry.command.replace("/", "\\/")));
  const catalog = resolveClaudeCommand("/commands");
  assert.equal(catalog.kind, "skill_help");
  assert.equal(catalog.commands.length, NOVELTY_COMMAND_CATALOG.length);
  const help = resolveClaudeCommand("/help source-check");
  assert.equal(help.kind, "skill_help");
  assert.match(help.response, /source quality/i);
  assert.match(help.response, /Example: \/source-check/i);
  assert.deepEqual(resolveClaudeCommand("/source-check", "research_20260827120000_skilltest"), {
    kind: "mcp", command: "/source-check", mcpTool: "source_check", arguments: { run_id: "research_20260827120000_skilltest" },
  });
  const unknown = resolveClaudeCommand("/sorce-check");
  assert.equal(unknown.kind, "unknown_command");
  assert.ok(unknown.suggestions.includes("/source-check"));
  console.log("Verified Claude Skill helper -> direct /api/research contract.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

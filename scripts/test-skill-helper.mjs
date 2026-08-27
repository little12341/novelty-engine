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
  const helper = path.join(process.cwd(), "skill", "novelty-engine", "scripts", "research.mjs");
  const query = "/research-market find a carefully bounded local service opportunity";
  const { stdout, stderr } = await execFileAsync(process.execPath, [helper, query], {
    cwd: process.cwd(), env: { ...process.env, NOVELTY_RESEARCH_API_URL: `http://127.0.0.1:${address.port}/api/research` },
  });
  assert.equal(stderr, "");
  assert.equal(received.query, query);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.stopDecision.status, "insufficient_evidence");
  const skill = await readFile(path.join(process.cwd(), "skill", "novelty-engine", "SKILL.md"), "utf8");
  assert.match(skill, /slash-like strings as Novelty intents/i);
  assert.match(skill, /\/source-check.*must call `Novelty:source_check`/i);
  assert.match(skill, /does not register these in Claude's native slash-command UI/i);
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

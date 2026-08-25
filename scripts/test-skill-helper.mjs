#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";

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
  console.log("Verified Claude Skill helper -> direct /api/research contract.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

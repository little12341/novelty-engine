#!/usr/bin/env node

const query = process.argv.slice(2).join(" ").trim();
if (query.length < 8) {
  console.error("Usage: node scripts/research.mjs \"<research or ideation request>\"");
  process.exit(2);
}

const base = process.env.NOVELTY_RESEARCH_API_URL || "https://www.novelty-engine.com/api/research";
let endpoint;
try {
  endpoint = new URL(base);
} catch {
  console.error("NOVELTY_RESEARCH_API_URL must be a valid HTTP(S) URL.");
  process.exit(2);
}
if (!['http:', 'https:'].includes(endpoint.protocol)) {
  console.error("NOVELTY_RESEARCH_API_URL must use HTTP or HTTPS.");
  process.exit(2);
}

try {
  const configuredDepth = process.env.NOVELTY_RESEARCH_DEPTH || "standard";
  if (!["fast", "standard", "deep"].includes(configuredDepth)) throw new Error("NOVELTY_RESEARCH_DEPTH must be fast, standard, or deep");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, depth: configuredDepth }),
    signal: AbortSignal.timeout(65_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Research backend returned HTTP ${response.status}: ${text.slice(0, 800)}`);
    process.exit(1);
  }
  const result = JSON.parse(text);
  if (!result?.ideationContext?.finalOutput || !result?.stopDecision || !result?.coverage || !Array.isArray(result?.sources)) {
    throw new Error("response did not contain the V2.1 research, coverage, stop-decision, and final-output contract");
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  console.error(`Research backend unavailable: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

#!/usr/bin/env node

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = process.argv[2] || "http://localhost:3000/api/mcp";
const query = process.argv.slice(3).join(" ").trim() || "Find 3 underserved software opportunities for small field service teams";
const url = new URL(base);
const headers = process.env.NOVELTY_MCP_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.NOVELTY_MCP_ACCESS_TOKEN}` } : undefined;
const client = new Client({ name: "novelty-engine-local-verifier", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });
const transport = new StreamableHTTPClientTransport(url, { requestInit: headers ? { headers } : undefined });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(`Connected to ${url}. Tools: ${tools.tools.map((tool) => tool.name).join(", ")}`);
  const result = await client.callTool({ name: "research_market", arguments: { query } });
  console.log(JSON.stringify(result.structuredContent ?? result.content, null, 2));
  if (result.isError) process.exitCode = 1;
} finally {
  await client.close();
}

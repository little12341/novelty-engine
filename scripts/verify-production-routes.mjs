#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appPaths = JSON.parse(await readFile(path.join(root, ".next", "server", "app-paths-manifest.json"), "utf8"));
const routes = JSON.parse(await readFile(path.join(root, ".next", "routes-manifest.json"), "utf8"));
const expectedAppPaths = ["/api/mcp/route", "/api/mcp/health/route", "/api/research/route", "/api/research/history/route", "/api/research/export/route", "/api/research/feedback/route", "/api/research/memory/route", "/api/research/watchlists/route", "/api/research/watchlists/check/route", "/robots.txt/route", "/sitemap.xml/route"];
const expectedRoutes = ["/api/mcp", "/api/mcp/health", "/api/research", "/api/research/history", "/api/research/export", "/api/research/feedback", "/api/research/memory", "/api/research/watchlists", "/api/research/watchlists/check", "/robots.txt", "/sitemap.xml"];

for (const route of expectedAppPaths) assert.ok(appPaths[route], `Production app-paths manifest is missing ${route}`);
const emitted = new Set(routes.staticRoutes.map((route) => route.page));
for (const route of expectedRoutes) assert.ok(emitted.has(route), `Production routes manifest is missing ${route}`);

console.log(`Verified production build routes: ${expectedRoutes.join(", ")}`);

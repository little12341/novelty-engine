import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const websiteSources = await Promise.all([
  readFile(path.join(root, "app", "page.tsx"), "utf8"),
  readFile(path.join(root, "app", "install-panel.tsx"), "utf8"),
  readFile(path.join(root, "app", "beta-feedback.tsx"), "utf8"),
  readFile(path.join(root, "app", "install-transition.tsx"), "utf8"),
  readFile(path.join(root, "app", "layout.tsx"), "utf8"),
  readFile(path.join(root, "app", "robots.ts"), "utf8"),
  readFile(path.join(root, "app", "sitemap.ts"), "utf8"),
  readFile(path.join(root, "lib", "site.ts"), "utf8"),
]);
const source = websiteSources.join("\n");
const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const hrefs = [...source.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

for (const href of hrefs) {
  if (href.startsWith("#") && !ids.has(href.slice(1))) throw new Error(`Missing section for ${href}`);
  if (href.startsWith("/") && !href.includes("${")) await access(path.join(root, "public", href.slice(1)));
}

for (const expected of ["#comparison", "#method", "#commands", "#install", "#feedback"]) {
  if (!hrefs.includes(expected)) throw new Error(`Required internal link missing: ${expected}`);
}
if (!source.includes('href="/novelty-engine.zip"')) throw new Error("Current installable Skill ZIP must be linked from the website");
const canonicalOrigin = "https://www.novelty-engine.com";
const siteConstants = await readFile(path.join(root, "lib", "site.ts"), "utf8");
const installPanel = await readFile(path.join(root, "app", "install-panel.tsx"), "utf8");
const layout = await readFile(path.join(root, "app", "layout.tsx"), "utf8");
const page = await readFile(path.join(root, "app", "page.tsx"), "utf8");
const publicConfiguration = [
  source,
  await readFile(path.join(root, ".env.example"), "utf8"),
  await readFile(path.join(root, "skill", "novelty-engine", "SKILL.md"), "utf8"),
  await readFile(path.join(root, "skill", "novelty-engine", "scripts", "research.mjs"), "utf8"),
].join("\n");
for (const endpoint of [canonicalOrigin, `${canonicalOrigin}/api/mcp`, `${canonicalOrigin}/api/mcp/health`, `${canonicalOrigin}/api/research`]) {
  if (!publicConfiguration.includes(endpoint)) throw new Error(`Canonical production URL missing: ${endpoint}`);
}
if (!siteConstants.includes(`productionOrigin = "${canonicalOrigin}"`)) throw new Error("Canonical production origin constant is incorrect");
if (!/copyText\("mcp", productionMcpEndpoint\)/.test(installPanel)) throw new Error("Public MCP Copy button must copy the canonical endpoint");
for (const metadataRequirement of ["metadataBase: new URL(productionOrigin)", 'canonical: "/"', 'url: "/"']) {
  if (!layout.includes(metadataRequirement)) throw new Error(`Canonical metadata configuration missing: ${metadataRequirement}`);
}
if (!page.includes('"@type": "WebSite"') || !page.includes("url: productionOrigin")) throw new Error("Canonical WebSite structured data is missing");
if (publicConfiguration.includes("novelty-engine.vercel.app")) throw new Error("Legacy Vercel hostname leaked into current public/install configuration");
if (publicConfiguration.includes("https://novelty-engine.com")) throw new Error("Redirecting apex hostname leaked into current public/install configuration");
console.log(`Verified ${hrefs.length} static internal links and downloadable assets.`);

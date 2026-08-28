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
  readFile(path.join(root, "app", "about", "page.tsx"), "utf8"),
  readFile(path.join(root, "app", "privacy", "page.tsx"), "utf8"),
  readFile(path.join(root, "app", "terms", "page.tsx"), "utf8"),
  readFile(path.join(root, "lib", "site.ts"), "utf8"),
]);
const source = websiteSources.join("\n");
const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const hrefs = [...source.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

for (const href of hrefs) {
  if (href.startsWith("#") && !ids.has(href.slice(1))) throw new Error(`Missing section for ${href}`);
  if (href.startsWith("/") && /\.[a-z0-9]+$/i.test(href) && !href.includes("${")) await access(path.join(root, "public", href.slice(1)));
}

for (const expected of ["#overview", "#how-it-works", "#example", "#commands", "#install", "#feedback"]) {
  if (!hrefs.includes(expected)) throw new Error(`Required internal link missing: ${expected}`);
}
if (!source.includes('href="/novelty-engine.zip"')) throw new Error("Current installable Skill ZIP must be linked from the website");
for (const route of ["/about", "/privacy", "/terms"]) {
  if (!source.includes(`href="${route}"`)) throw new Error(`Required public policy link missing: ${route}`);
  await access(path.join(root, "app", route.slice(1), "page.tsx"));
}
const canonicalOrigin = "https://novelty-engine.com";
const siteConstants = await readFile(path.join(root, "lib", "site.ts"), "utf8");
const installPanel = await readFile(path.join(root, "app", "install-panel.tsx"), "utf8");
const layout = await readFile(path.join(root, "app", "layout.tsx"), "utf8");
const page = await readFile(path.join(root, "app", "page.tsx"), "utf8");
const installTransition = await readFile(path.join(root, "app", "install-transition.tsx"), "utf8");
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
for (const heroCopy of [
  "Stop guessing what to build",
  "Find business opportunities backed by real evidence.",
  "Novelty Engine researches customer complaints, competitors, workarounds, and reasons an idea could fail. Then it gives you the strongest supported results, sources, and a test you can run this week.",
  "Install for Claude",
  "See an example",
  "Research can reduce uncertainty, but it cannot guarantee that a business idea will succeed.",
]) {
  if (!page.includes(heroCopy)) throw new Error(`Approved hero copy missing: ${heroCopy}`);
}
const installViewportRenders = [...installTransition.matchAll(/<InstallViewport\s*\/>/g)].length;
const installContentSources = [...installTransition.matchAll(/className="install-content-source"/g)].length;
if (installViewportRenders !== 1 || installContentSources !== 1) throw new Error("The installation viewport must have exactly one rendered content source");
for (const command of ["/research-market", "/find-gaps", "/inspect-competitors", "/customer-pain", "/falsify", "/rerun"]) {
  if (!page.includes(command)) throw new Error(`Required homepage command missing: ${command}`);
}
if (!page.includes("Fixture-backed pipeline walkthrough—not live market research")) throw new Error("The illustrative fixture must be explicitly labeled as non-live");
if (publicConfiguration.includes("novelty-engine.vercel.app")) throw new Error("Legacy Vercel hostname leaked into current public/install configuration");
if (publicConfiguration.includes("https://www.novelty-engine.com")) throw new Error("Non-canonical www hostname leaked into current public/install configuration");
console.log(`Verified ${hrefs.length} static internal links and downloadable assets.`);

import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pageRoutes = ["", "how-it-works", "example", "install", "about", "contact", "privacy", "terms"];
const websiteFiles = [
  ...pageRoutes.map((route) => path.join(root, "app", route, "page.tsx")),
  path.join(root, "app", "site-chrome.tsx"),
  path.join(root, "app", "install-panel.tsx"),
  path.join(root, "app", "beta-feedback.tsx"),
  path.join(root, "app", "install-transition.tsx"),
  path.join(root, "app", "policy-shell.tsx"),
  path.join(root, "app", "layout.tsx"),
  path.join(root, "app", "robots.ts"),
  path.join(root, "app", "sitemap.ts"),
  path.join(root, "lib", "site.ts"),
];
const websiteSources = await Promise.all(websiteFiles.map((file) => readFile(file, "utf8")));
const source = websiteSources.join("\n");
const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const hrefs = [...source.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

for (const href of hrefs) {
  if (href.startsWith("#") && !ids.has(href.slice(1))) throw new Error(`Missing section for ${href}`);
  if (href.startsWith("/") && /\.[a-z0-9]+$/i.test(href) && !href.includes("${")) await access(path.join(root, "public", href.slice(1)));
}

for (const route of ["/", "/how-it-works", "/example", "/install", "/about", "/contact", "/privacy", "/terms"]) {
  if (!source.includes(`"${route}"`)) throw new Error(`Required public route missing from navigation or metadata: ${route}`);
  if (route !== "/") await access(path.join(root, "app", route.slice(1), "page.tsx"));
}
if (!source.includes('href="/novelty-engine.zip"')) throw new Error("Current installable Skill ZIP must be linked from the website");

const canonicalOrigin = "https://novelty-engine.com";
const siteConstants = await readFile(path.join(root, "lib", "site.ts"), "utf8");
const installPanel = await readFile(path.join(root, "app", "install-panel.tsx"), "utf8");
const installPage = await readFile(path.join(root, "app", "install", "page.tsx"), "utf8");
const installTransition = await readFile(path.join(root, "app", "install-transition.tsx"), "utf8");
const examplePage = await readFile(path.join(root, "app", "example", "page.tsx"), "utf8");
const howPage = await readFile(path.join(root, "app", "how-it-works", "page.tsx"), "utf8");
const layout = await readFile(path.join(root, "app", "layout.tsx"), "utf8");
const page = await readFile(path.join(root, "app", "page.tsx"), "utf8");
const siteChrome = await readFile(path.join(root, "app", "site-chrome.tsx"), "utf8");
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
if (!/copyText\("skill", productionSkillDownloadUrl\)/.test(installPanel)) throw new Error("Public Skill Copy button must copy the canonical download URL");
for (const metadataRequirement of ["metadataBase: new URL(productionOrigin)", 'canonical: "/"', 'url: "/"']) {
  if (!layout.includes(metadataRequirement)) throw new Error(`Canonical metadata configuration missing: ${metadataRequirement}`);
}
if (!page.includes('"@type": "WebSite"') || !page.includes("url: productionOrigin")) throw new Error("Canonical WebSite structured data is missing");
for (const heroCopy of [
  "Stop guessing what to build",
  "Find business opportunities backed by real evidence.",
  ">Install</",
  ">See an Example",
  "Research can reduce uncertainty, but it cannot guarantee that a business idea will succeed.",
]) {
  if (!page.includes(heroCopy)) throw new Error(`Approved homepage copy missing: ${heroCopy}`);
}
for (const label of ["Home", "How It Works", "Example", "Install", "About", "Contact"]) {
  if (!siteChrome.includes(`["${label}",`)) throw new Error(`Desktop navigation label missing: ${label}`);
}
for (const mobileOnly of ['href="/privacy"', 'href="/terms"']) {
  if (!siteChrome.includes(mobileOnly)) throw new Error(`Mobile/footer policy link missing: ${mobileOnly}`);
}
for (const command of ["/research-market", "/find-gaps", "/inspect-competitors", "/customer-pain", "/falsify", "/rerun"]) {
  if (!installPage.includes(command)) throw new Error(`Required install-page command missing: ${command}`);
}
if (!installTransition.includes("<HeroInstallPanel />") || !installTransition.includes("<InstallPanel />")) throw new Error("The Install route must preserve all Skill and MCP Copy controls");
if (!examplePage.includes("Fixture-backed · not live research") || !examplePage.includes("Demonstration report")) throw new Error("Fixture data must be explicitly labeled as non-live demonstration data");
for (const requirement of ["Supplied-source research", "does not directly scrape, crawl, or mine Reddit", "Unsupported conclusions", "Unknowns and counterevidence"]) {
  if (!howPage.includes(requirement)) throw new Error(`How It Works requirement missing: ${requirement}`);
}
if (publicConfiguration.includes("novelty-engine.vercel.app")) throw new Error("Legacy Vercel hostname leaked into current public/install configuration");
if (publicConfiguration.includes("https://www.novelty-engine.com")) throw new Error("Non-canonical www hostname leaked into current public/install configuration");
console.log(`Verified ${pageRoutes.length} public pages, ${hrefs.length} static links, and downloadable assets.`);

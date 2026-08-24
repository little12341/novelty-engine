import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "app", "page.tsx"), "utf8");
const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const hrefs = [...source.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

for (const href of hrefs) {
  if (href.startsWith("#") && !ids.has(href.slice(1))) throw new Error(`Missing section for ${href}`);
  if (href.startsWith("/") && !href.includes("${")) await access(path.join(root, "public", href.slice(1)));
}

for (const expected of ["#comparison", "#how-it-works", "#install", "/novelty-engine.zip"]) {
  if (!hrefs.includes(expected)) throw new Error(`Required internal link missing: ${expected}`);
}
console.log(`Verified ${hrefs.length} static internal links and downloadable assets.`);

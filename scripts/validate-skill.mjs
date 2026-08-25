import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "skill", "novelty-engine");
const text = await readFile(path.join(root, "SKILL.md"), "utf8");
const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatter) throw new Error("SKILL.md needs YAML frontmatter");
if (!/^name: novelty-engine$/m.test(frontmatter[1])) throw new Error("Skill name must be novelty-engine");
if (!/^description: .{20,}$/m.test(frontmatter[1])) throw new Error("Skill needs a discriminating description");
for (const phrase of ["Research-first operating mode", "Remote MCP (preferred)", "research_market", "falsify_opportunity", "scripts/research.mjs", "NOVELTY_RESEARCH_API_URL", "graceful fallback", "non-researched, hypothesis-led ideation", "Never invent a competitor", "evidence-backed market gap", "finalOutput", "VERIFIED", "INFERRED", "UNKNOWN", "stopDecision", "insufficient_evidence", "Rejected Ideas + Why", "Decisive Risks", "24–72", "heuristic"]) {
  if (!text.includes(phrase)) throw new Error(`SKILL.md is missing required V2.1 instruction: ${phrase}`);
}
if (/TODO|PLACEHOLDER|\[Fill in/i.test(text)) throw new Error("Skill contains unfinished scaffold text");
await access(path.join(root, "scripts", "research.mjs"));
console.log("Validated novelty-engine Skill structure and V2.1 research contract.");

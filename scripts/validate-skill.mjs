import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "skill", "novelty-engine");
const text = await readFile(path.join(root, "SKILL.md"), "utf8");
const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatter) throw new Error("SKILL.md needs YAML frontmatter");
if (!/^name: novelty-engine$/m.test(frontmatter[1])) throw new Error("Skill name must be novelty-engine");
const description = frontmatter[1].match(/^description: (.+)$/m)?.[1] ?? "";
if (description.length < 20 || description.length > 200) throw new Error("Skill description must be discriminating and at most 200 characters");
for (const phrase of ["Research-first operating mode", "Remote MCP (preferred)", "research_from_sources", "get_research_requirements", "add_sources_to_run", "providerCalls: 0", "HOSTED_SEARCH_DISABLED", "SUPPLIED_SOURCES_REQUIRED", "NOVELTY_RESEARCH_SOURCES_FILE", "NOVELTY_ALLOW_HOSTED_SEARCH", "research_market", "run_research_mode", "compare_ideas", "list_research_runs", "search_research_runs", "compare_run_candidates", "get_research_budget_info", "company_name", "canonical export/report representation", "mcp-interfaces.md", "/research-company", "/compare-ideas", "slash-like strings", "/commands", "/help", "does not register these in Claude's native slash-command UI", "Unknown Novelty command", "Novelty:source_check", "fresh_expand", "untrusted data", "falsify_opportunity", "scripts/research.mjs", "NOVELTY_RESEARCH_API_URL", "graceful fallback", "non-researched, hypothesis-led ideation", "Never invent a competitor", "evidence-backed market gap", "finalOutput", "VERIFIED", "INFERRED", "UNKNOWN", "stopDecision", "insufficient_evidence", "Rejected Ideas + Why", "Decisive Risks", "24–72", "heuristic"]) {
  if (!text.includes(phrase)) throw new Error(`SKILL.md is missing required V2.2 instruction: ${phrase}`);
}
for (const command of ["/research-market", "/find-gaps", "/inspect-competitors", "/falsify", "/validate-idea", "/research-company", "/find-business", "/compare", "/market-size", "/pricing", "/customer-pain", "/trend-check", "/source-check", "/evidence", "/summarize-run", "/rerun", "/export", "/commands", "/help"]) {
  if (!text.includes(`| \`${command}\` |`)) throw new Error(`SKILL.md command catalog is missing ${command}`);
}
for (const phrase of ["Find and analyze publicly indexed customer discussions and complaints", "bounded samples rather than complete coverage", "CONTRADICTED"]) {
  if (!text.includes(phrase)) throw new Error(`SKILL.md is missing required accuracy language: ${phrase}`);
}
for (const endpoint of ["https://novelty-engine.com/api/mcp", "https://novelty-engine.com/api/mcp/health", "https://novelty-engine.com/api/research"]) {
  if (!text.includes(endpoint)) throw new Error(`SKILL.md is missing canonical production endpoint: ${endpoint}`);
}
if (text.includes("novelty-engine.vercel.app") || text.includes("https://www.novelty-engine.com")) throw new Error("SKILL.md contains a non-canonical production hostname");
if (/TODO|PLACEHOLDER|\[Fill in/i.test(text)) throw new Error("Skill contains unfinished scaffold text");
await access(path.join(root, "scripts", "research.mjs"));
await access(path.join(root, "references", "mcp-interfaces.md"));
console.log("Validated novelty-engine Skill structure and V2.2 behavior over the compatible V2.1 research schema.");

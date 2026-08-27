import type { ResearchMode } from "./types.ts";

const COMMANDS: Record<string, ResearchMode> = {
  "/find-business": "find_business",
  "/research-market": "research_market",
  "/research-company": "research_company",
  "/find-competitors": "find_competitors",
  "/find-gaps": "find_gaps",
  "/falsify": "falsify",
  "/validate-idea": "validate_idea",
  "/compare-ideas": "compare_ideas",
  "/inspect-competitors": "find_competitors",
  "/compare": "compare_ideas",
  "/market-size": "research_market",
  "/pricing": "research_market",
  "/customer-pain": "research_market",
  "/trend-check": "research_market",
  "/source-check": "research_market",
  "/evidence": "research_market",
};

export const RESEARCH_COMMANDS = Object.freeze({ ...COMMANDS });
export const CLAUDE_COMMAND_ROUTES = Object.freeze({
  "/research-market": { mcpTool: "research_market", agent: "scout" },
  "/find-gaps": { mcpTool: "run_research_mode", mode: "find_gaps", agent: "gap" },
  "/inspect-competitors": { mcpTool: "inspect_competitors", agent: "competitor" },
  "/falsify": { mcpTool: "falsify_opportunity", agent: "skeptic" },
  "/validate-idea": { mcpTool: "run_research_mode", mode: "validate_idea", agent: "final_judge" },
  "/research-company": { mcpTool: "run_research_mode", mode: "research_company", agent: "competitor" },
  "/find-business": { mcpTool: "run_research_mode", mode: "find_business", agent: "scout" },
  "/compare": { mcpTool: "compare_ideas", agent: "judge" },
  "/market-size": { mcpTool: "run_research_mode", mode: "research_market", agent: "market_sizing" },
  "/pricing": { mcpTool: "run_research_mode", mode: "research_market", agent: "pricing" },
  "/customer-pain": { mcpTool: "run_research_mode", mode: "research_market", agent: "customer_pain" },
  "/trend-check": { mcpTool: "run_research_mode", mode: "research_market", agent: "trend" },
  "/source-check": { mcpTool: "source_check", agent: "evidence" },
  "/evidence": { mcpTool: "source_check", agent: "evidence" },
  "/summarize-run": { mcpTool: "get_research_run", agent: "final_judge" },
  "/rerun": { mcpTool: "rerun_research", agent: "scout" },
  "/export": { mcpTool: "export_research_run", agent: "final_judge" },
  "/commands": { skillResponse: "command_catalog" },
  "/help": { skillResponse: "command_catalog" },
} as const);

export const NOVELTY_COMMAND_HELP = Object.freeze([
  "/research-market — run the full evidence-first market pipeline",
  "/find-gaps — run gap research or inspect stored gaps",
  "/inspect-competitors — inspect stored competitors; request a fresh expansion when asked",
  "/falsify — actively search for counterevidence for a candidate",
  "/source-check or /evidence — call Novelty:source_check for the current stored run",
  "/rerun — call Novelty:rerun_research for the current stored run",
  "/export — export the current stored run",
  "/commands or /help — show this Novelty intent catalog",
] as const);

export function resolveClaudeCommand(input: string, currentRunId?: string):
  | { kind: "mcp"; command: keyof typeof CLAUDE_COMMAND_ROUTES; mcpTool: string; arguments: Record<string, unknown> }
  | { kind: "skill_help"; commands: readonly string[] }
  | null {
  const trimmed = input.trim();
  const command = trimmed.split(/\s+/, 1)[0].toLowerCase() as keyof typeof CLAUDE_COMMAND_ROUTES;
  const route = CLAUDE_COMMAND_ROUTES[command];
  if (!route) return null;
  if ("skillResponse" in route) return { kind: "skill_help", commands: NOVELTY_COMMAND_HELP };
  const remainder = trimmed.slice(command.length).trim();
  if (command === "/inspect-competitors" && !currentRunId && remainder) {
    return { kind: "mcp", command, mcpTool: "run_research_mode", arguments: { mode: "find_competitors", query: remainder } };
  }
  if (command === "/find-gaps" && currentRunId && !remainder) {
    return { kind: "mcp", command, mcpTool: "find_market_gaps", arguments: { run_id: currentRunId } };
  }
  const storedTools = new Set(["source_check", "get_research_run", "rerun_research", "export_research_run", "inspect_competitors"]);
  if (storedTools.has(route.mcpTool) && !currentRunId) return null;
  const args: Record<string, unknown> = storedTools.has(route.mcpTool) ? { run_id: currentRunId } : {};
  if (route.mcpTool === "inspect_competitors") args.fresh_expand = /\b(?:fresh|expand|rerun)\b/i.test(remainder);
  else if (route.mcpTool === "export_research_run") args.format = remainder || "markdown";
  else if (route.mcpTool === "falsify_opportunity") { args.opportunity = remainder; if (currentRunId) args.run_id = currentRunId; }
  else if (route.mcpTool === "compare_ideas") args.ideas = remainder.split(/\s+(?:vs\.?|versus|\|)\s+/i).filter(Boolean);
  else if (route.mcpTool === "research_market") args.query = remainder;
  else if (route.mcpTool === "run_research_mode") { args.mode = route.mode; args.query = remainder; }
  return { kind: "mcp", command, mcpTool: route.mcpTool, arguments: args };
}

export function parseResearchIntent(query: string, explicitMode?: ResearchMode): { mode: ResearchMode; query: string } {
  const trimmed = query.trim();
  const command = Object.keys(COMMANDS).find((item) => trimmed.toLowerCase() === item || trimmed.toLowerCase().startsWith(`${item} `));
  const mode = explicitMode ?? (command ? COMMANDS[command] : "research_market");
  return { mode, query: command ? trimmed.slice(command.length).trim() : trimmed };
}

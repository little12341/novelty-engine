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
  "/inspect-competitors": { mcpTool: "run_research_mode", mode: "find_competitors", agent: "competitor" },
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
} as const);

export function parseResearchIntent(query: string, explicitMode?: ResearchMode): { mode: ResearchMode; query: string } {
  const trimmed = query.trim();
  const command = Object.keys(COMMANDS).find((item) => trimmed.toLowerCase() === item || trimmed.toLowerCase().startsWith(`${item} `));
  const mode = explicitMode ?? (command ? COMMANDS[command] : "research_market");
  return { mode, query: command ? trimmed.slice(command.length).trim() : trimmed };
}

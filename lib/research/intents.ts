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
};

export const RESEARCH_COMMANDS = Object.freeze({ ...COMMANDS });

export function parseResearchIntent(query: string, explicitMode?: ResearchMode): { mode: ResearchMode; query: string } {
  const trimmed = query.trim();
  const command = Object.keys(COMMANDS).find((item) => trimmed.toLowerCase() === item || trimmed.toLowerCase().startsWith(`${item} `));
  const mode = explicitMode ?? (command ? COMMANDS[command] : "research_market");
  return { mode, query: command ? trimmed.slice(command.length).trim() : trimmed };
}

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

export type NoveltyCommandCatalogEntry = {
  command: string;
  description: string;
  usage: string;
  example: string;
};

export const NOVELTY_COMMAND_CATALOG = Object.freeze([
  { command: "/research-market", description: "Start a new complete evidence-first market research and ideation run.", usage: "/research-market <market or problem>", example: "/research-market scheduling tools for independent dental labs" },
  { command: "/find-gaps", description: "Start fresh gap-focused research for a query, or only read/rank gaps when given a completed run ID.", usage: "/find-gaps <market or run ID>", example: "/find-gaps field-service invoicing for teams under five" },
  { command: "/inspect-competitors", description: "Read stored competitors for a run; a new market starts fresh intent research, and fresh expansion occurs only when explicitly requested.", usage: "/inspect-competitors [run ID or market]", example: "/inspect-competitors research_20260827120000_example" },
  { command: "/falsify", description: "Actively search for counterevidence that could kill an opportunity.", usage: "/falsify <opportunity>", example: "/falsify an AI chargeback evidence assistant" },
  { command: "/validate-idea", description: "Research and pressure-test a proposed idea without declaring it validated prematurely.", usage: "/validate-idea <idea>", example: "/validate-idea a compliance copilot for regional food distributors" },
  { command: "/research-company", description: "Start fresh company research, using name/domain/ticker/country as authoritative identifiers when supplied.", usage: "/research-company <company>", example: "/research-company ServiceTitan" },
  { command: "/find-business", description: "Find real businesses showing observable buying or workflow-pain signals.", usage: "/find-business <customer or market>", example: "/find-business dental labs hiring manual case coordinators" },
  { command: "/compare", description: "Start fresh research for two to five separate ideas under one shared budget; use compare_run_candidates for items already in one run.", usage: "/compare <idea> vs <idea> [vs ...]", example: "/compare mobile tire dispatch vs appliance repair logistics" },
  { command: "/market-size", description: "Research market-size evidence, proxies, bounds, and important unknowns.", usage: "/market-size <market>", example: "/market-size independent US dental laboratories" },
  { command: "/pricing", description: "Research public prices, spending signals, packaging gaps, and willingness-to-pay evidence.", usage: "/pricing <market or product category>", example: "/pricing scheduling software for small home-service teams" },
  { command: "/customer-pain", description: "Find and analyze publicly indexed customer discussions and complaints, including workarounds, churn reasons, and requested outcomes.", usage: "/customer-pain <customer and workflow>", example: "/customer-pain independent adjusters preparing claim evidence" },
  { command: "/trend-check", description: "Test whether a claimed market, technology, regulatory, or distribution shift is real.", usage: "/trend-check <trend or market>", example: "/trend-check digital product passports for small apparel brands" },
  { command: "/source-check", description: "Audit the current run’s citations, source quality, duplicates, contradictions, and unknowns.", usage: "/source-check [run ID]", example: "/source-check research_20260827120000_example" },
  { command: "/evidence", description: "Run the same stored-run evidence and citation audit as /source-check.", usage: "/evidence [run ID]", example: "/evidence research_20260827120000_example" },
  { command: "/summarize-run", description: "Read a concise stored-run summary; full internal JSON is distinct from the canonical export representation.", usage: "/summarize-run [run ID]", example: "/summarize-run research_20260827120000_example" },
  { command: "/rerun", description: "Rerun stored research and report material changes from the prior snapshot.", usage: "/rerun [run ID]", example: "/rerun research_20260827120000_example" },
  { command: "/export", description: "Read the canonical report/export representation of a stored run in a supported format.", usage: "/export [run ID] [json|markdown|print|csv|competitor_matrix|validation_plan|opportunity_brief|investor_memo|bibliography]", example: "/export research_20260827120000_example csv" },
  { command: "/commands", description: "Show the complete Novelty command catalog with one-line descriptions.", usage: "/commands", example: "/commands" },
  { command: "/help", description: "Show concise usage guidance or explain one command with an example.", usage: "/help [command]", example: "/help source-check" },
] satisfies readonly NoveltyCommandCatalogEntry[]);

export const NOVELTY_COMMAND_ALIASES = Object.freeze({
  "/gaps": "/find-gaps",
  "/competitors": "/inspect-competitors",
  "/compare-ideas": "/compare",
  "/find-competitors": "/inspect-competitors",
} as const);

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
  "/help": { skillResponse: "command_help" },
} as const);

type CanonicalClaudeCommand = keyof typeof CLAUDE_COMMAND_ROUTES;
type McpResolution = { kind: "mcp"; command: CanonicalClaudeCommand; mcpTool: string; arguments: Record<string, unknown> };
type SkillHelpResolution = {
  kind: "skill_help";
  command: "/commands" | "/help";
  topic: "catalog" | "overview" | "command";
  response: string;
  commands?: readonly string[];
  entry?: NoveltyCommandCatalogEntry;
};
type UnknownCommandResolution = { kind: "unknown_command"; command: string; suggestions: readonly string[]; response: string };
type MissingRunResolution = { kind: "missing_run"; command: CanonicalClaudeCommand; mcpTool: string; response: string };

export type ClaudeCommandResolution = McpResolution | SkillHelpResolution | UnknownCommandResolution | MissingRunResolution;

export const NOVELTY_COMMAND_HELP = Object.freeze(NOVELTY_COMMAND_CATALOG.map((entry) => `${entry.command} — ${entry.description}`));

const commandByName = new Map(NOVELTY_COMMAND_CATALOG.map((entry) => [entry.command, entry]));

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function normalizeCommandToken(input: string): string {
  const normalized = input.trim().toLowerCase();
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function canonicalCommand(token: string): CanonicalClaudeCommand | null {
  const normalized = normalizeCommandToken(token);
  const alias = NOVELTY_COMMAND_ALIASES[normalized as keyof typeof NOVELTY_COMMAND_ALIASES];
  const candidate = alias ?? normalized;
  return candidate in CLAUDE_COMMAND_ROUTES ? candidate as CanonicalClaudeCommand : null;
}

export function suggestNoveltyCommands(input: string, limit = 3): readonly string[] {
  const normalized = normalizeCommandToken(input);
  const query = normalized.slice(1);
  return NOVELTY_COMMAND_CATALOG
    .map((entry) => {
      const candidate = entry.command.slice(1);
      const prefixPenalty = candidate.startsWith(query) ? -3 : candidate.includes(query) ? -1 : 0;
      return { command: entry.command, score: editDistance(query, candidate) + prefixPenalty };
    })
    .sort((left, right) => left.score - right.score || left.command.localeCompare(right.command))
    .slice(0, limit)
    .map((entry) => entry.command);
}

function unknownResolution(input: string): UnknownCommandResolution {
  const suggestions = suggestNoveltyCommands(input);
  const suggestionText = suggestions.length ? ` Did you mean ${suggestions.join(", ")}?` : "";
  return {
    kind: "unknown_command",
    command: input,
    suggestions,
    response: `Unknown Novelty command \`${input}\`.${suggestionText} Use /commands to see every available intent.`,
  };
}

function extractRunId(remainder: string, currentRunId?: string): { runId?: string; remainder: string } {
  const match = remainder.match(/\bresearch_[a-z0-9_-]+\b/i);
  return {
    runId: match?.[0] ?? currentRunId,
    remainder: match ? `${remainder.slice(0, match.index)} ${remainder.slice((match.index ?? 0) + match[0].length)}`.trim() : remainder,
  };
}

function helpResolution(remainder: string): SkillHelpResolution | UnknownCommandResolution {
  if (!remainder) {
    return {
      kind: "skill_help",
      command: "/help",
      topic: "overview",
      response: "Use /commands to list Novelty prompt intents. Start a command with a market, company, or idea; stored-run commands use the most recent run unless you provide a research_… ID. Use /help <command> for one example.",
    };
  }
  const requested = remainder.split(/\s+/, 1)[0];
  const command = canonicalCommand(requested);
  const entry = command ? commandByName.get(command) : undefined;
  if (!entry) return unknownResolution(requested);
  return {
    kind: "skill_help",
    command: "/help",
    topic: "command",
    response: `${entry.command} — ${entry.description}\nUsage: ${entry.usage}\nExample: ${entry.example}`,
    entry,
  };
}

export function resolveClaudeCommand(input: string, currentRunId?: string): ClaudeCommandResolution | null {
  const trimmed = input.trim();
  const requestedCommand = trimmed.split(/\s+/, 1)[0].toLowerCase();
  if (!requestedCommand.startsWith("/")) return null;
  const command = canonicalCommand(requestedCommand);
  if (!command) return unknownResolution(requestedCommand);
  const route = CLAUDE_COMMAND_ROUTES[command];
  const rawRemainder = trimmed.slice(requestedCommand.length).trim();

  if (command === "/commands") {
    return {
      kind: "skill_help",
      command,
      topic: "catalog",
      response: `Novelty prompt intents (not native Claude slash-command registrations):\n${NOVELTY_COMMAND_HELP.join("\n")}`,
      commands: NOVELTY_COMMAND_HELP,
    };
  }
  if (command === "/help") return helpResolution(rawRemainder);
  if ("skillResponse" in route) throw new Error(`Unhandled Skill response: ${route.skillResponse}`);

  const { runId, remainder } = extractRunId(rawRemainder, currentRunId);
  if (command === "/inspect-competitors" && !runId && remainder) {
    return { kind: "mcp", command, mcpTool: "run_research_mode", arguments: { mode: "find_competitors", query: remainder } };
  }
  if (command === "/find-gaps" && runId && !remainder) {
    return { kind: "mcp", command, mcpTool: "find_market_gaps", arguments: { run_id: runId } };
  }

  const storedTools = new Set(["source_check", "get_research_run", "rerun_research", "export_research_run", "inspect_competitors"]);
  if (storedTools.has(route.mcpTool) && !runId) {
    return {
      kind: "missing_run",
      command,
      mcpTool: route.mcpTool,
      response: `${command} needs a Novelty run. Provide a research_… run ID or run /research-market first.`,
    };
  }

  const args: Record<string, unknown> = storedTools.has(route.mcpTool) ? { run_id: runId } : {};
  if (route.mcpTool === "inspect_competitors") args.fresh_expand = /\b(?:fresh|expand|rerun)\b/i.test(remainder);
  else if (route.mcpTool === "export_research_run") args.format = remainder || "markdown";
  else if (route.mcpTool === "falsify_opportunity") { args.opportunity = remainder; if (runId) args.run_id = runId; }
  else if (route.mcpTool === "compare_ideas") args.ideas = remainder.split(/\s+(?:vs\.?|versus|\|)\s+/i).filter(Boolean);
  else if (route.mcpTool === "research_market") args.query = remainder;
  else if (route.mcpTool === "run_research_mode") { args.mode = route.mode; args.query = remainder; }
  return { kind: "mcp", command, mcpTool: route.mcpTool, arguments: args };
}

export class NoveltyCommandError extends Error {
  readonly code: "UNKNOWN_COMMAND" | "SKILL_ONLY_COMMAND";
  readonly command: string;
  readonly suggestions: readonly string[];

  constructor(code: "UNKNOWN_COMMAND" | "SKILL_ONLY_COMMAND", command: string, message: string, suggestions: readonly string[] = []) {
    super(message);
    this.name = "NoveltyCommandError";
    this.code = code;
    this.command = command;
    this.suggestions = suggestions;
  }
}

export function parseResearchIntent(query: string, explicitMode?: ResearchMode): { mode: ResearchMode; query: string } {
  const trimmed = query.trim();
  const requested = trimmed.split(/\s+/, 1)[0].toLowerCase();
  const command = Object.keys(COMMANDS).find((item) => requested === item);
  if (requested === "/source-check" || requested === "/evidence") {
    throw new NoveltyCommandError("SKILL_ONLY_COMMAND", requested, `${requested} must call Novelty:source_check through the Claude Skill or MCP connector; it is not a generic market-research request.`);
  }
  if (requested.startsWith("/") && !command) {
    const known = canonicalCommand(requested);
    if (known) throw new NoveltyCommandError("SKILL_ONLY_COMMAND", requested, `${known} is handled by the Novelty Claude Skill or MCP connector, not the generic research endpoint.`);
    const suggestions = suggestNoveltyCommands(requested);
    throw new NoveltyCommandError("UNKNOWN_COMMAND", requested, `Unknown Novelty command ${requested}.`, suggestions);
  }
  const mode = explicitMode ?? (command ? COMMANDS[command] : "research_market");
  return { mode, query: command ? trimmed.slice(requested.length).trim() : trimmed };
}

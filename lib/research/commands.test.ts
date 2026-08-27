import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getNoveltyCommandMatches, moveCommandMenuIndex, selectNoveltyCommand } from "./command-menu.ts";
import { NOVELTY_COMMAND_CATALOG, NoveltyCommandError, parseResearchIntent, resolveClaudeCommand } from "./intents.ts";

const runId = "research_20260827120000_commands";

test("/commands returns the complete Novelty catalog with one-line descriptions", () => {
  const result = resolveClaudeCommand("/commands");
  assert.equal(result?.kind, "skill_help");
  if (result?.kind !== "skill_help") return;
  assert.equal(result.topic, "catalog");
  assert.deepEqual(result.commands, NOVELTY_COMMAND_CATALOG.map((entry) => `${entry.command} — ${entry.description}`));
  assert.equal(result.commands?.length, 19);
  for (const entry of NOVELTY_COMMAND_CATALOG) assert.match(result.response, new RegExp(entry.command.replace("/", "\\/")));
  assert.match(result.response, /not native Claude slash-command registrations/i);
});

test("/help source-check explains source checking and shows one example", () => {
  const result = resolveClaudeCommand("/help source-check");
  assert.equal(result?.kind, "skill_help");
  if (result?.kind !== "skill_help") return;
  assert.equal(result.topic, "command");
  assert.equal(result.entry?.command, "/source-check");
  assert.match(result.response, /citations, source quality, duplicates, contradictions, and unknowns/i);
  assert.match(result.response, /Usage: \/source-check \[run ID\]/i);
  assert.match(result.response, /Example: \/source-check research_/i);
});

test("/source-check routes only to Novelty:source_check", () => {
  assert.deepEqual(resolveClaudeCommand("/source-check", runId), {
    kind: "mcp",
    command: "/source-check",
    mcpTool: "source_check",
    arguments: { run_id: runId },
  });
  assert.deepEqual(resolveClaudeCommand(`/source-check ${runId}`), {
    kind: "mcp",
    command: "/source-check",
    mcpTool: "source_check",
    arguments: { run_id: runId },
  });
});

test("every supported slash-like intent resolves to its Skill response or intended MCP path", () => {
  const expected = new Map<string, string>([
    ["/research-market a market", "research_market"],
    ["/find-gaps a market", "run_research_mode"],
    ["/inspect-competitors a market", "run_research_mode"],
    ["/falsify an idea", "falsify_opportunity"],
    ["/validate-idea an idea", "run_research_mode"],
    ["/research-company Acme", "run_research_mode"],
    ["/find-business dental labs", "run_research_mode"],
    ["/compare one vs two", "compare_ideas"],
    ["/market-size a market", "run_research_mode"],
    ["/pricing a market", "run_research_mode"],
    ["/customer-pain a workflow", "run_research_mode"],
    ["/trend-check a trend", "run_research_mode"],
    [`/source-check ${runId}`, "source_check"],
    [`/evidence ${runId}`, "source_check"],
    [`/summarize-run ${runId}`, "get_research_run"],
    [`/rerun ${runId}`, "rerun_research"],
    [`/export ${runId}`, "export_research_run"],
  ]);
  for (const [input, tool] of expected) {
    const result = resolveClaudeCommand(input);
    assert.equal(result?.kind, "mcp", input);
    if (result?.kind === "mcp") assert.equal(result.mcpTool, tool, input);
  }
  assert.equal(resolveClaudeCommand("/commands")?.kind, "skill_help");
  assert.equal(resolveClaudeCommand("/help")?.kind, "skill_help");
  assert.equal(resolveClaudeCommand("/gaps a market")?.kind, "mcp");
  assert.equal(resolveClaudeCommand(`/competitors ${runId}`)?.kind, "mcp");
});

test("unknown slash commands return suggestions and never become generic research", () => {
  const result = resolveClaudeCommand("/sorce-check");
  assert.equal(result?.kind, "unknown_command");
  if (result?.kind === "unknown_command") {
    assert.ok(result.suggestions.includes("/source-check"));
    assert.match(result.response, /Unknown Novelty command/i);
    assert.match(result.response, /\/commands/);
  }
  assert.throws(
    () => parseResearchIntent("/sorce-check audit this"),
    (error) => error instanceof NoveltyCommandError && error.code === "UNKNOWN_COMMAND" && error.suggestions.includes("/source-check"),
  );
  assert.throws(
    () => parseResearchIntent("/source-check"),
    (error) => error instanceof NoveltyCommandError && error.code === "SKILL_ONLY_COMMAND" && /Novelty:source_check/.test(error.message),
  );
});

test("browser slash autocomplete appears, filters, navigates, and selects canonical commands", async () => {
  assert.equal(getNoveltyCommandMatches("/").length, NOVELTY_COMMAND_CATALOG.length);
  assert.deepEqual(getNoveltyCommandMatches("/sou").map((entry) => entry.command), ["/source-check"]);
  assert.ok(getNoveltyCommandMatches("/gap").some((entry) => entry.command === "/find-gaps"));
  assert.deepEqual(getNoveltyCommandMatches("/find-gaps market"), []);
  assert.equal(moveCommandMenuIndex(0, "next", 3), 1);
  assert.equal(moveCommandMenuIndex(0, "previous", 3), 2);
  assert.equal(selectNoveltyCommand("/source-check"), "/source-check ");

  const component = await readFile(path.join(process.cwd(), "app", "research-debug", "research-debugger.tsx"), "utf8");
  for (const behavior of ['role="combobox"', 'role="listbox"', 'role="option"', 'event.key === "ArrowDown"', 'event.key === "ArrowUp"', 'event.key === "Enter"', 'event.key === "Escape"', "chooseCommand(entry.command)"]) {
    assert.ok(component.includes(behavior), `Browser command menu is missing ${behavior}`);
  }
});

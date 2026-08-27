import { NOVELTY_COMMAND_ALIASES, NOVELTY_COMMAND_CATALOG, type NoveltyCommandCatalogEntry } from "./intents.ts";

export function getNoveltyCommandMatches(value: string): readonly NoveltyCommandCatalogEntry[] {
  if (!/^\/[^\s]*$/.test(value)) return [];
  const query = value.slice(1).toLowerCase();
  return NOVELTY_COMMAND_CATALOG.filter((entry) => {
    const commandText = entry.command.slice(1).toLowerCase();
    const aliases = Object.entries(NOVELTY_COMMAND_ALIASES)
      .filter(([, canonical]) => canonical === entry.command)
      .map(([alias]) => alias.slice(1));
    return !query || commandText.includes(query) || aliases.some((alias) => alias.includes(query));
  });
}

export function selectNoveltyCommand(command: string): string {
  const entry = NOVELTY_COMMAND_CATALOG.find((candidate) => candidate.command === command);
  if (!entry) throw new RangeError(`Unknown Novelty command selection: ${command}`);
  return `${entry.command} `;
}

export function moveCommandMenuIndex(current: number, direction: "next" | "previous", count: number): number {
  if (count <= 0) return -1;
  if (direction === "next") return (Math.max(current, -1) + 1) % count;
  return current <= 0 ? count - 1 : current - 1;
}

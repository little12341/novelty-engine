import { createHash } from "node:crypto";

export const clamp = (value: number, min = 0, max = 10): number => Math.min(max, Math.max(min, value));

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 10)}`;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function evidenceUnion(...groups: string[][]): string[] {
  return unique(groups.flat().filter(Boolean));
}

export function independentHostCount(evidenceIds: string[], evidence: Array<{ id: string; normalizedUrl: string }>): number {
  return new Set(evidence.filter((item) => evidenceIds.includes(item.id)).map((item) => new URL(item.normalizedUrl).hostname)).size;
}

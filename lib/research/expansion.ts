import { createHash } from "node:crypto";
import type { SearchAngle, SearchBranch } from "./types.ts";

const DIMENSIONS: Array<{ dimension: SearchBranch["dimension"]; kind: SearchAngle["kind"]; suffix: string }> = [
  { dimension: "segment", kind: "underserved_segments", suffix: "adjacent customer segment underserved edge case different buyer small operator enterprise excluded" },
  { dimension: "workflow", kind: "workflow_fragmentation", suffix: "upstream downstream workflow manual handoff spreadsheet repetitive work exception management" },
  { dimension: "vertical", kind: "adjacent_mechanisms", suffix: "same job adjacent vertical industry niche sub-niche analogous workflow" },
  { dimension: "geography", kind: "underserved_segments", suffix: "geographic regional rural local language regulation availability gap" },
  { dimension: "business_model", kind: "adjacent_categories", suffix: "service managed service outcome based usage based channel partner pooled purchasing" },
  { dimension: "upstream", kind: "manual_workarounds", suffix: "upstream data intake preparation compliance coordination manual labor" },
  { dimension: "downstream", kind: "customer_complaints", suffix: "downstream reconciliation reporting audit exception follow-up failure complaint" },
  { dimension: "sub_niche", kind: "customer_language", suffix: "specialist forum niche persona workaround would pay alternative" },
];

export function deriveExpansionBranches(query: string, killReasons: string[], limit: number): { branches: SearchBranch[]; angles: SearchAngle[] } {
  const learned = killReasons.map((item) => item.replace(/\s+/g, " ").slice(0, 180)).slice(0, 6);
  const avoid = learned.length ? ` Avoid the failed pattern: ${learned.join("; ")}` : "";
  const selected = DIMENSIONS.slice(0, Math.max(0, Math.min(limit, DIMENSIONS.length)));
  const branches = selected.map((item, index): SearchBranch => {
    const id = `branch_${createHash("sha1").update(`${query}:${item.dimension}:${avoid}`).digest("hex").slice(0, 10)}`;
    return {
      id, parentId: null, dimension: item.dimension,
      query: `${query} ${item.suffix}${avoid}`.slice(0, 1_200),
      reason: `The initial search produced no gate-clearing survivor, so the engine branched by ${item.dimension} while carrying forward exact failure reasons.`,
      learnedFromKillReasons: learned, status: "searched", searchAngleIds: [`expand_${index + 1}_${id.slice(-6)}`],
    };
  });
  const angles = branches.map((branch, index): SearchAngle => ({
    id: branch.searchAngleIds[0], kind: selected[index].kind, query: branch.query,
    purpose: `Budgeted adjacent-search expansion by ${branch.dimension}; killed patterns are negative search memory, not prompt instructions.`, targetedDomains: [],
  }));
  return { branches, angles };
}

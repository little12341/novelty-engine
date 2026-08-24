import type { Competitor, ContradictionHypothesis, ContradictionOperation, Evidence, MarketAssumption } from "./types.ts";
import { evidenceUnion, stableId } from "./utils.ts";

const RULES: Array<{ dimension: string; statement: string; pattern: RegExp; operations: Array<[ContradictionOperation, string]> }> = [
  { dimension: "ownership", statement: "The user must own or subscribe to the product.", pattern: /buy|purchase|own|subscription|per month/i, operations: [["invert", "Make access temporary, shared, or outcome-based instead of owned."], ["remove", "Remove ownership and sell the completed outcome."]] },
  { dimension: "labor", statement: "A human must perform or coordinate the workflow.", pattern: /manual|consultant|staff|worker|coordinate|re-enter/i, operations: [["automate", "Let the system complete the bounded task autonomously and request human review only for exceptions."], ["externalize", "Move the task into the environment or an integration."]] },
  { dimension: "workflow_start", statement: "The workflow must begin inside the incumbent product.", pattern: /app|platform|dashboard|log in|enter|upload/i, operations: [["invert", "Start at the real-world event or downstream system rather than inside an app."], ["remove", "Eliminate the explicit workflow start through passive capture."]] },
  { dimension: "pricing", statement: "Customers pay a recurring per-seat or monthly price.", pattern: /per (?:seat|user|month)|monthly|subscription|plans? start/i, operations: [["reverse_payer", "Charge the party who benefits from completion rather than the operator."], ["unbundle", "Price per completed job or avoided failure instead of per seat."]] },
  { dimension: "form", statement: "The solution must be software with a visual interface.", pattern: /software|app|dashboard|crm|platform/i, operations: [["invert", "Use a physical, ambient, or service mechanism rather than another screen."], ["remove", "Make the interface disappear into an existing channel."]] },
  { dimension: "architecture", statement: "Data and coordination must be centralized.", pattern: /central|cloud|platform|database|sync/i, operations: [["decentralize", "Keep data at the edge and coordinate through minimal shared proofs."], ["externalize", "Let source systems remain authoritative instead of building a new database."]] },
  { dimension: "buyer_user", statement: "The buyer and user are assumed to be the same person.", pattern: /for (?:teams|contractors|businesses|companies)|customer|user/i, operations: [["reverse_payer", "Separate the operator, beneficiary, and payer and align price with the beneficiary."], ["invert", "Distribute through the counterparty who needs the user's work completed."]] },
  { dimension: "data_input", statement: "The user must supply and maintain the data.", pattern: /upload|enter|input|spreadsheet|re-enter|reporting/i, operations: [["remove", "Derive the minimum data from existing exhaust instead of asking for entry."], ["externalize", "Read from authoritative source systems and write back only decisions."]] },
];

export function extractAssumptions(evidence: Evidence[], competitors: Competitor[]): MarketAssumption[] {
  return RULES.flatMap((rule) => {
    const matches = evidence.filter((item) => rule.pattern.test(`${item.title} ${item.summary}`));
    if (!matches.length) return [];
    return [{
      id: stableId("assumption", rule.statement), statement: rule.statement, dimension: rule.dimension,
      affectedEntityIds: competitors.filter((item) => item.evidenceIds.some((id) => matches.some((source) => source.id === id))).map((item) => item.id),
      evidenceIds: matches.slice(0, 8).map((item) => item.id), confidence: Math.min(0.9, 0.42 + matches.length * 0.09),
    }];
  });
}

export function generateContradictions(assumptions: MarketAssumption[]): ContradictionHypothesis[] {
  return assumptions.flatMap((assumption) => {
    const rule = RULES.find((item) => item.dimension === assumption.dimension);
    return (rule?.operations ?? []).map(([operation, hypothesis], index) => ({
      id: stableId("contradiction", `${assumption.id}:${operation}`), assumptionId: assumption.id, operation,
      hypothesis, rationale: `Challenge the evidenced category default: “${assumption.statement}”`,
      evidenceIds: evidenceUnion(assumption.evidenceIds), strength: Math.min(10, 5.5 + assumption.confidence * 3 - index * 0.5),
    }));
  }).sort((a, b) => b.strength - a.strength);
}

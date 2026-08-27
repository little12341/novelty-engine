import { stableId } from "./utils.ts";
import type { AgentExecutionRecord, ResearchDepth, ResearchTaskGraph, SpecialistAgent } from "./types.ts";

const AGENTS: Array<{ agent: SpecialistAgent; dependsOn: SpecialistAgent[] }> = [
  { agent: "scout", dependsOn: [] }, { agent: "evidence", dependsOn: ["scout"] },
  { agent: "competitor", dependsOn: ["evidence"] }, { agent: "customer_pain", dependsOn: ["evidence"] },
  { agent: "pricing", dependsOn: ["evidence"] }, { agent: "trend", dependsOn: ["evidence"] },
  { agent: "regulatory", dependsOn: ["evidence"] }, { agent: "market_sizing", dependsOn: ["evidence"] },
  { agent: "distribution", dependsOn: ["customer_pain", "pricing"] },
  { agent: "technical_feasibility", dependsOn: ["evidence"] }, { agent: "business_model", dependsOn: ["pricing", "distribution"] },
  { agent: "gap", dependsOn: ["competitor", "customer_pain", "pricing", "trend"] },
  { agent: "skeptic", dependsOn: ["gap", "regulatory", "technical_feasibility"] },
  { agent: "bull", dependsOn: ["gap"] }, { agent: "bear", dependsOn: ["skeptic"] },
  { agent: "judge", dependsOn: ["bull", "bear"] }, { agent: "final_judge", dependsOn: ["judge", "market_sizing", "business_model"] },
];

export function buildResearchTaskGraph(input: {
  runSeed: string; depth: ResearchDepth; at: string; evidenceIds: string[]; candidateIds: string[];
  partial: boolean; cancelled?: boolean;
}): ResearchTaskGraph {
  const enabled = input.depth === "fast" ? new Set<SpecialistAgent>(["scout", "evidence", "competitor", "customer_pain", "gap", "skeptic", "bull", "bear", "judge", "final_judge"])
    : new Set<SpecialistAgent>(AGENTS.map((item) => item.agent));
  const idFor = (agent: SpecialistAgent) => stableId("agent", `${input.runSeed}:${agent}`);
  const agents: AgentExecutionRecord[] = AGENTS.map(({ agent, dependsOn }) => ({
    id: idFor(agent), agent, dependsOn: dependsOn.filter((item) => enabled.has(item)).map(idFor),
    status: input.cancelled ? "cancelled" as const : !enabled.has(agent) ? "skipped" as const : input.partial ? "partial" as const : "complete" as const,
    attempt: 1, startedAt: input.at, completedAt: input.at,
    inputRecordIds: agent === "scout" ? [] : input.evidenceIds,
    outputRecordIds: ["gap", "skeptic", "bull", "bear", "judge", "final_judge"].includes(agent) ? input.candidateIds : input.evidenceIds,
    permissions: agent === "skeptic" || agent === "bear" ? ["read_retrieved_evidence", "derive_structured_records", "request_bounded_search"] : ["read_retrieved_evidence", "derive_structured_records"],
    notes: [agent === "bull" ? "Receives the positive evidence subset independently from Bear." : agent === "bear" ? "Receives counterevidence and kill criteria independently from Bull." : "Consumes typed record IDs from declared dependencies."],
  }));
  return {
    depth: input.depth, resumable: true, checkpointId: stableId("checkpoint", `${input.runSeed}:${input.at}`), cancelled: input.cancelled === true,
    agents,
    dependencies: agents.flatMap((agent) => agent.dependsOn.map((from) => ({ from, to: agent.id }))),
  };
}

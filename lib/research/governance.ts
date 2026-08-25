import type {
  Evidence, PipelineCheckpoint, PipelineCheckpointName, ResearchResult, ResearchRole,
  ResearchRoleOutput,
} from "./types.ts";

export const NON_OVERRIDABLE_RESEARCH_RULES = Object.freeze([
  "Never claim global novelty from a bounded search.",
  "Never invent a competitor, source, price, complaint, capability, or market fact.",
  "Never promote UNKNOWN to INFERRED or VERIFIED, or INFERRED to VERIFIED without new qualifying evidence.",
  "No competitor found is a coverage result, never evidence of demand.",
  "Competitor existence can validate a job but is not an automatic rejection.",
  "Every survivor requires evidence lineage and a completed falsification pass.",
  "Every unresolved critical unknown remains visible.",
  "Rejected candidates remain rejected unless new evidence supports one bounded mutation and another falsification pass.",
]);

const INJECTION_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  { category: "instruction_override", pattern: /\b(ignore|disregard|forget)\b.{0,80}\b(previous|prior|system|developer|instructions?|rules?)\b/gi },
  { category: "secret_exfiltration", pattern: /\b(send|reveal|print|expose|return|upload)\b.{0,80}\b(api[-_ ]?keys?|tokens?|secrets?|credentials?|system prompt)\b/gi },
  { category: "tool_instruction", pattern: /\b(call|invoke|run|execute|use)\b.{0,40}\b(tool|terminal|shell|command|mcp|function)\b/gi },
  { category: "system_directive", pattern: /(?:^|\n)\s*(system|developer|assistant)\s*:\s*/gi },
  { category: "data_mutation", pattern: /\b(delete|overwrite|modify|deploy|push)\b.{0,60}\b(repository|database|files?|user data|deployment)\b/gi },
];

export function sanitizeUntrustedResearchText(value: string): {
  text: string;
  promptInjectionDetected: boolean;
  ignoredDirectiveCategories: string[];
} {
  let text = value.replace(/\0/g, "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " [script removed] ");
  const categories: string[] = [];
  for (const item of INJECTION_PATTERNS) {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(text)) categories.push(item.category);
    item.pattern.lastIndex = 0;
    text = text.replace(item.pattern, `[ignored untrusted ${item.category} directive]`);
  }
  return {
    text: text.replace(/\s+/g, " ").trim(),
    promptInjectionDetected: categories.length > 0,
    ignoredDirectiveCategories: [...new Set(categories)],
  };
}

const ROLE_PERMISSIONS: Record<ResearchRole, ResearchRoleOutput["permissions"]> = {
  market_mapping: ["read_retrieved_evidence", "derive_structured_records"],
  competitor_analysis: ["read_retrieved_evidence", "derive_structured_records"],
  complaint_workaround_mining: ["read_retrieved_evidence", "derive_structured_records"],
  structural_gap_detection: ["read_retrieved_evidence", "derive_structured_records"],
  adversarial_falsification: ["read_retrieved_evidence", "derive_structured_records", "request_bounded_search"],
  source_verification: ["read_retrieved_evidence", "derive_structured_records"],
  company_analysis: ["read_retrieved_evidence", "derive_structured_records"],
  opportunity_synthesis: ["read_retrieved_evidence", "derive_structured_records"],
};

export function buildRoleOutputs(input: {
  evidence: Evidence[];
  competitors: Array<{ id: string }>;
  complaints: Array<{ id: string }>;
  gaps: Array<{ id: string }>;
  candidates: Array<{ id: string }>;
  falsificationResults: Array<{ candidateId: string }>;
  companyRecordIds?: string[];
  sourceFailures: number;
}): ResearchRoleOutput[] {
  const evidenceIds = input.evidence.map((item) => item.id);
  const row = (role: ResearchRole, outputRecordIds: string[], notes: string[] = []): ResearchRoleOutput => ({
    role,
    inputEvidenceIds: evidenceIds,
    outputRecordIds,
    status: input.evidence.length === 0 ? "skipped" : input.sourceFailures ? "partial" : "complete",
    permissions: ROLE_PERMISSIONS[role],
    notes,
  });
  return [
    row("source_verification", evidenceIds, ["Retrieved content was treated as untrusted data; normalization, injection screening, and claim deduplication ran once for all roles."]),
    row("market_mapping", input.competitors.map((item) => item.id)),
    row("competitor_analysis", input.competitors.map((item) => item.id)),
    row("complaint_workaround_mining", input.complaints.map((item) => item.id)),
    row("structural_gap_detection", input.gaps.map((item) => item.id)),
    row("adversarial_falsification", input.falsificationResults.map((item) => item.candidateId), ["Only this role may request bounded counterevidence searches; all roles reuse the shared evidence set."]),
    row("company_analysis", input.companyRecordIds ?? [], input.companyRecordIds?.length ? [] : ["Not requested for this mode."]),
    row("opportunity_synthesis", input.candidates.map((item) => item.id)),
  ].map((item) => item.role === "company_analysis" && !input.companyRecordIds?.length ? { ...item, status: "skipped" } : item);
}

export function checkpoint(
  name: PipelineCheckpointName,
  status: PipelineCheckpoint["status"],
  details: string,
  completedAt: string,
): PipelineCheckpoint {
  return { name, status, details, completedAt };
}

export function validateEvidenceReferences(result: Pick<ResearchResult,
  "sources" | "finalOpportunities" | "rejectedIdeas" | "gaps" | "falsificationResults"
>): string[] {
  const known = new Set(result.sources.map((item) => item.id));
  const referenced = [
    ...result.gaps.flatMap((item) => [...item.supportingEvidenceIds, ...item.counterEvidenceIds]),
    ...result.rejectedIdeas.flatMap((item) => item.evidenceIds),
    ...result.finalOpportunities.flatMap((item) => [
      ...item.candidate.evidenceIds,
      ...item.lineage.evidenceIds,
      ...item.falsification.hypotheses.flatMap((hypothesis) => [...hypothesis.supportingEvidenceIds, ...hypothesis.counterEvidenceIds]),
    ]),
    ...result.falsificationResults.flatMap((item) => [
      ...item.argumentsFor.flatMap((argument) => argument.evidenceIds),
      ...item.argumentsAgainst.flatMap((argument) => argument.evidenceIds),
    ]),
  ];
  return [...new Set(referenced.filter((id) => !known.has(id)))];
}

export function assertSurvivorGates(result: Pick<ResearchResult, "finalOpportunities" | "rejectedIdeas">): string[] {
  const rejected = new Set(result.rejectedIdeas.map((item) => item.candidateId));
  const errors: string[] = [];
  for (const survivor of result.finalOpportunities) {
    if (rejected.has(survivor.candidate.id)) errors.push(`${survivor.candidate.id} is both rejected and a survivor.`);
    if (!survivor.lineage.evidenceIds.length) errors.push(`${survivor.candidate.id} lacks evidence lineage.`);
    if (survivor.falsification.outcome !== "survived") errors.push(`${survivor.candidate.id} did not survive falsification.`);
    if (survivor.falsification.unknownCriticalCount > 0 && !survivor.falsification.hypotheses.some((item) => item.unknown)) {
      errors.push(`${survivor.candidate.id} hides critical unknowns.`);
    }
  }
  return errors;
}

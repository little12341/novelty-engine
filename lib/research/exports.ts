import type { ResearchResult } from "./types.ts";

export type PrintReadyReport = {
  title: string;
  generatedAt: string;
  sections: Array<{ heading: string; body: unknown }>;
  html: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));

export function structuredExport(result: ResearchResult) {
  return {
    schemaVersion: result.schemaVersion, runId: result.id, query: result.query, mode: result.mode, completedAt: result.completedAt,
    researchLandscape: result.output.researchLandscape, signals: result.output.signals,
    structuralGaps: result.output.structuralGaps, candidateIdeas: result.output.candidateIdeas,
    rejectedIdeas: result.output.rejectedIdeas, survivors: result.output.survivors,
    evidenceLineage: result.output.evidenceLineage, decisiveRisks: result.output.decisiveRisks,
    coverageConfidence: { coverage: result.coverage, stopDecision: result.stopDecision, warnings: result.warnings },
    validationTests: result.output.validationTests, companyProfile: result.companyProfile,
    sources: result.sources, checkpoints: result.checkpoints, budgetUsage: result.budgetUsage,
  };
}

export function markdownExport(result: ResearchResult): string {
  const sections = [
    ["Research Landscape", `Status: ${result.stopDecision.status}\n\nSources: ${result.sources.length}; independent: ${result.coverage.independentSourceCount}; provider: ${result.provider.displayName}.`],
    ["Signals", result.output.signals.map((item) => `- ${item.label} — ${item.status} [${item.evidenceIds.join(", ")}]`).join("\n") || "No supported signals."],
    ["Structural Gaps", result.output.structuralGaps.map((item) => `- ${item.problemStatement} (${item.confidenceLabel})`).join("\n") || "No gap cleared the evidence gate."],
    ["Candidate Ideas", result.output.candidateIdeas.map((item) => `- ${item.name} — ${item.status}`).join("\n") || "No candidates generated."],
    ["Rejected Ideas + Why", result.output.rejectedIdeas.map((item) => `- ${item.name}: ${item.reason}`).join("\n") || "None recorded."],
    ["Survivors", result.output.survivors.map((item) => `- ${item.candidate.name}: ${item.candidate.summary}\n  - Confidence: ${item.score.confidenceLabel}\n  - Falsification: ${item.falsification.reason}`).join("\n") || "No candidate survived."],
    ["Evidence Lineage", result.output.evidenceLineage.map((item) => `- ${item.summary} [${item.evidenceIds.join(", ")}]`).join("\n") || "No survivor lineage."],
    ["Decisive Risks", result.output.decisiveRisks.flatMap((item) => item.risks.map((risk) => `- ${item.candidateId} / ${risk.dimension}: ${risk.reason}`)).join("\n") || "No decisive risk established; see UNKNOWNs."],
    ["Coverage / Confidence", `${result.coverage.coverageStatus}. Missing source families: ${result.coverage.missingCriticalSourceFamilies.join(", ") || "none"}. Counterevidence budget exhausted: ${result.coverage.counterevidenceBudgetExhausted}.`],
    ["24–72 Hour Validation Tests", result.output.validationTests.map((item) => `- ${item.action} Success: ${item.successThreshold} Failure: ${item.failureThreshold}`).join("\n") || "No survivor validation test."],
  ];
  return `# Novelty Engine Research Report\n\n**Run:** ${result.id}  \n**Query:** ${result.query}  \n**Completed:** ${result.completedAt}\n\n${sections.map(([heading, body]) => `## ${heading}\n\n${body}`).join("\n\n")}`;
}

export function printReadyExport(result: ResearchResult): PrintReadyReport {
  const data = structuredExport(result);
  const sections = [
    { heading: "Research Landscape", body: data.researchLandscape }, { heading: "Signals", body: data.signals },
    { heading: "Structural Gaps", body: data.structuralGaps }, { heading: "Candidate Ideas", body: data.candidateIdeas },
    { heading: "Rejected Ideas + Why", body: data.rejectedIdeas }, { heading: "Survivors", body: data.survivors },
    { heading: "Evidence Lineage", body: data.evidenceLineage }, { heading: "Decisive Risks", body: data.decisiveRisks },
    { heading: "Coverage / Confidence", body: data.coverageConfidence }, { heading: "24–72 Hour Validation Tests", body: data.validationTests },
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Novelty Engine ${escapeHtml(result.id)}</title><style>@page{margin:18mm}body{font:14px/1.45 system-ui;color:#1d2430;max-width:920px;margin:auto}h1,h2{break-after:avoid}section{break-inside:avoid;margin:0 0 24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f5f7;padding:12px}</style></head><body><h1>Novelty Engine Research Report</h1><p>${escapeHtml(result.query)} · ${escapeHtml(result.completedAt)}</p>${sections.map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><pre>${escapeHtml(JSON.stringify(section.body, null, 2))}</pre></section>`).join("")}</body></html>`;
  return { title: `Novelty Engine — ${result.query}`, generatedAt: new Date().toISOString(), sections, html };
}

export function exportResearchResult(result: ResearchResult, format: "json" | "markdown" | "print") {
  return format === "json" ? structuredExport(result) : format === "markdown" ? markdownExport(result) : printReadyExport(result);
}

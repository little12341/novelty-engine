import type { ResearchResult } from "./types.ts";

export type PrintReadyReport = {
  title: string;
  generatedAt: string;
  sections: Array<{ heading: string; body: unknown }>;
  html: string;
};

export type ResearchExportFormat = "json" | "markdown" | "print" | "csv" | "competitor_matrix" | "validation_plan" | "opportunity_brief" | "investor_memo" | "bibliography";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));

export function structuredExport(result: ResearchResult) {
  const sourceById = new Map(result.sources.map((item) => [item.id, item]));
  return {
    schemaVersion: result.schemaVersion, engineVersion: result.engineVersion, depth: result.depth, runId: result.id, query: result.query, mode: result.mode, completedAt: result.completedAt,
    retrievalMode: result.retrievalMode, retrieval: result.retrieval, runLineage: result.runLineage,
    researchLandscape: result.output.researchLandscape, signals: result.output.signals,
    structuralGaps: result.output.structuralGaps, candidateIdeas: result.output.candidateIdeas,
    rejectedIdeas: result.output.rejectedIdeas, survivors: result.output.survivors,
    evidenceLineage: result.output.evidenceLineage, decisiveRisks: result.output.decisiveRisks,
    coverageConfidence: { coverage: result.coverage, stopDecision: result.stopDecision, warnings: result.warnings },
    validationTests: result.output.validationTests, companyProfile: result.companyProfile,
    sources: result.sources.map(({ supports, ...source }) => ({
      ...source, discoveryPurpose: supports,
      supportsClaims: result.claimLineage.filter((claim) => claim.supportingEvidenceIds.includes(source.id)).map((claim) => claim.id),
      rejectedForClaims: result.claimLineage.filter((claim) => claim.rejectedEvidenceIds.includes(source.id)).map((claim) => claim.id),
    })), checkpoints: result.checkpoints, budgetUsage: result.budgetUsage,
    candidateLifecycles: result.candidateLifecycles, evidenceGates: result.evidenceGates,
    assumptionLedger: result.assumptionLedger, adversarialReviews: result.adversarialReviews,
    searchBranches: result.searchBranches, taskGraph: result.taskGraph, nextBestAction: result.nextBestAction,
    claimLineage: result.claimLineage.map((claim) => ({
      ...claim,
      supportingSources: claim.supportingEvidenceIds.map((id) => sourceById.get(id)).filter(Boolean)
        .map((source) => ({ evidenceId: source!.id, title: source!.title, url: source!.sourceUrl, retrievedAt: source!.retrievedAt })),
      rejectedSources: claim.rejectedEvidenceIds.map((id) => sourceById.get(id)).filter(Boolean)
        .map((source) => ({ evidenceId: source!.id, title: source!.title, url: source!.sourceUrl })),
    })), citationCoverage: result.citationCoverage, candidateIdMapping: result.candidateIdMapping,
  };
}

export function markdownExport(result: ResearchResult): string {
  const sourceById = new Map(result.sources.map((item) => [item.id, item]));
  const citations = (ids: string[]) => ids.map((id) => sourceById.get(id)).filter(Boolean)
    .map((source) => `[${source!.title}](${source!.sourceUrl})`).join("; ") || "no qualifying source";
  const sections = [
    ["Research Landscape", `Status: ${result.stopDecision.status}\n\nSources: ${result.sources.length}; independent: ${result.coverage.independentSourceCount}; retrieval: ${result.retrievalMode}; provider: ${result.provider.displayName}; hosted provider calls: ${result.retrieval.hostedProviderCalls}.`],
    ["Signals", result.output.signals.map((item) => `- ${item.label} — ${item.status} [${item.evidenceIds.join(", ")}]`).join("\n") || "No supported signals."],
    ["Structural Gaps", result.output.structuralGaps.map((item) => `- ${item.problemStatement} (${item.confidenceLabel})`).join("\n") || "No gap cleared the evidence gate."],
    ["Candidate Ideas", result.output.candidateIdeas.map((item) => `- ${item.name} — ${item.status}`).join("\n") || "No candidates generated."],
    ["Rejected Ideas + Why", result.output.rejectedIdeas.map((item) => `- ${item.name}: ${item.reason}`).join("\n") || "None recorded."],
    ["Survivors", result.output.survivors.map((item) => `- ${item.candidate.name}: ${item.candidate.summary}\n  - Confidence: ${item.score.confidenceLabel}\n  - Falsification: ${item.falsification.reason}`).join("\n") || "No candidate survived."],
    ["Evidence Lineage", result.claimLineage.map((item) => `- **${item.status} — ${item.claimType.replaceAll("_", " ")}:** ${item.claim}\n  - Sources: ${citations(item.supportingEvidenceIds)}${item.rejectedEvidenceIds.length ? `\n  - Rejected citations: ${citations(item.rejectedEvidenceIds)}` : ""}`).join("\n") || "No claim lineage."],
    ["Decisive Risks", result.output.decisiveRisks.flatMap((item) => item.risks.map((risk) => `- ${item.candidateId} / ${risk.dimension}: ${risk.reason}`)).join("\n") || "No decisive risk established; see UNKNOWNs."],
    ["Coverage / Confidence", `${result.coverage.coverageStatus}. Major-claim citation coverage: ${result.citationCoverage.supportedMajorClaims}/${result.citationCoverage.totalMajorClaims}. Partial support: ${result.citationCoverage.partialSupportClaims}. Contradicted: ${result.citationCoverage.contradictedClaims}. Role mismatches: ${result.citationCoverage.roleMismatchedMajorClaims}. Relevance rejections: ${result.citationCoverage.relevanceRejectedMajorClaims}. Missing evidence IDs: ${result.citationCoverage.missingEvidenceIdClaims}. Missing source families: ${result.coverage.missingCriticalSourceFamilies.join(", ") || "none"}. Counterevidence budget exhausted: ${result.coverage.counterevidenceBudgetExhausted}.`],
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

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvRows = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\n");

export function csvExport(result: ResearchResult): string {
  return csvRows([
    ["candidate_id", "name", "lifecycle", "opportunity_score", "evidence_confidence", "novelty_score", "closest_competitor_similarity", "demand_authenticity", "distribution_viability", "ai_commoditization_risk", "next_action"],
    ...result.finalOpportunities.map((item) => [
      item.candidate.id, item.candidate.name, item.lifecycle?.classification ?? "survived", item.score.score,
      item.score.evidenceConfidence?.score ?? "", item.score.noveltyScore?.score ?? "", item.falsification.residualUnmetDemand.closestCompetitorSimilarity ?? "",
      item.score.intelligence?.demandAuthenticity ?? "", item.score.intelligence?.distributionViability ?? "",
      item.score.intelligence?.aiCommoditization ?? "", result.nextBestAction?.candidateId === item.candidate.id ? result.nextBestAction.action : "",
    ]),
  ]);
}

export function competitorMatrixExport(result: ResearchResult): string {
  return csvRows([
    ["competitor", "canonical_domain", "classification", "website", "target_customer", "pricing", "features", "positioning", "weaknesses", "closest_similarity", "matched_dimensions", "unmatched_dimensions", "evidence_ids"],
    ...result.competitors.map((item) => {
      const similarity = result.similarities.filter((row) => row.leftId === item.id || row.rightId === item.id).sort((a, b) => b.score - a.score)[0];
      return [item.name.value, item.canonicalDomain, item.classification, item.website, item.targetCustomer.value, item.pricing.value, item.keyFeatures.value?.join("; "), item.positioning.value, item.likelyWeaknesses.value?.join("; "), similarity?.score ?? "", similarity?.matchingDimensions.join("; ") ?? "", similarity?.nonMatchingDimensions?.join("; ") ?? "", item.evidenceIds.join("; ")];
    }),
  ]);
}

export function investorMemoExport(result: ResearchResult): string {
  const opportunities = result.finalOpportunities.map((item) => `## ${item.candidate.name}\n\n**Status:** ${item.lifecycle?.classification ?? "survived"}, not validated unless the evidence gate explicitly says so.  \n**Opportunity score:** ${item.score.score}/100 (heuristic)  \n**Evidence confidence:** ${item.score.evidenceConfidence?.score ?? "unknown"}/100  \n**Novelty score:** ${item.score.noveltyScore?.score ?? "unknown"}/100  \n\n${item.candidate.summary}\n\n**Why now / why not built:** ${item.whyNotBuilt?.verdict ?? "unknown"}. ${item.whyNotBuilt?.unresolvedQuestion ?? "Historical blocker remains unknown."}\n\n**Bear/Judge:** ${item.adversarialReview?.bear.rationale ?? item.falsification.reason} ${item.adversarialReview?.judge.rationale ?? ""}\n\n**Next validation:** ${item.validationExperiment.action}\n\n**Kill threshold:** ${item.validationExperiment.failureThreshold}`).join("\n\n");
  return `# Investor-style opportunity memo\n\nRun ${result.id}; ${result.completedAt}. This memo reports research survivors, not guaranteed businesses or investment outcomes.\n\n${opportunities || "No candidate survived. " + result.stopDecision.reasons.join(" ")}\n\n## Single next-best action\n\n${result.nextBestAction.action}\n`;
}

export function exportResearchResult(result: ResearchResult, format: ResearchExportFormat) {
  if (format === "json") return structuredExport(result);
  if (format === "markdown") return markdownExport(result);
  if (format === "print") return printReadyExport(result);
  if (format === "csv") return csvExport(result);
  if (format === "competitor_matrix") return competitorMatrixExport(result);
  if (format === "validation_plan") return { runId: result.id, nextBestAction: result.nextBestAction, plans: result.finalOpportunities.map((item) => item.validationPlan) };
  if (format === "opportunity_brief") return result.finalOpportunities.map((item) => ({ candidate: item.candidate, lifecycle: item.lifecycle, evidenceGate: item.evidenceGate, score: item.score, closestCompetitorSimilarity: item.falsification.residualUnmetDemand.closestCompetitorSimilarity, similarityDimensions: item.nearestAnalogues, whyNotBuilt: item.whyNotBuilt, decisiveRisks: item.falsification.decisiveRisks, falsificationSearchCoverage: item.falsification.searchCoverage, nextValidation: item.validationExperiment }));
  if (format === "bibliography") return result.sources.map((item) => ({
    title: item.title, url: item.sourceUrl, retrievedAt: item.retrievedAt, sourceType: item.sourceType,
    pageIdentity: item.pageIdentity, relevanceAssessment: item.relevanceAssessment, quality: item.sourceAssessment,
    supportsClaims: result.claimLineage.filter((claim) => claim.supportingEvidenceIds.includes(item.id)).map((claim) => ({ id: claim.id, claim: claim.claim, claimType: claim.claimType })),
    rejectedForClaims: result.claimLineage.filter((claim) => claim.rejectedEvidenceIds.includes(item.id)).map((claim) => ({ id: claim.id, claimType: claim.claimType })),
  }));
  return investorMemoExport(result);
}

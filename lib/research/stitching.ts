import type { ComplaintCluster, Evidence, WorkflowStitchingPattern } from "./types.ts";
import { clamp, evidenceUnion, independentHostCount, stableId, unique } from "./utils.ts";

const TOOL_PATTERNS: Array<[RegExp, string]> = [
  [/spreadsheet|excel|google sheets/i, "spreadsheet"], [/text messages?|sms/i, "messages"], [/email/i, "email"],
  [/paper/i, "paper"], [/script|github|code/i, "script"], [/consultant|contractor/i, "consultant"],
  [/crm/i, "CRM"], [/accounting/i, "accounting system"], [/scheduling app/i, "scheduling app"], [/estimating tool/i, "estimating tool"],
];

export function detectWorkflowStitching(evidence: Evidence[], complaints: ComplaintCluster[]): WorkflowStitchingPattern[] {
  const stitchingEvidence = evidence.filter((item) => /multiple tools|between (?:two|three|\d+) tools|spreadsheet.*(?:plus|and)|copy and paste|duplicate entry|re-enter|export|import|doesn.?t integrate|no api|sync fails|manual/i.test(`${item.title} ${item.summary}`));
  if (!stitchingEvidence.length) return [];
  const groups = new Map<string, Evidence[]>();
  for (const item of stitchingEvidence) {
    const key = /integrat|api|sync/i.test(item.summary) ? "bridge disconnected systems" : /spreadsheet|copy|re-enter|manual/i.test(item.summary) ? "move job data between tools" : "complete a fragmented workflow";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([job, items]) => {
    const text = items.map((item) => `${item.title} ${item.summary}`).join(" ");
    const tools = unique(TOOL_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label));
    const manualSteps = unique([/copy and paste/i.test(text) ? "copy and paste" : "", /duplicate entry|re-enter/i.test(text) ? "duplicate data entry" : "", /export|import/i.test(text) ? "export and import" : "", /manual/i.test(text) ? "manual handoff" : ""].filter(Boolean));
    const ids = items.map((item) => item.id);
    const recurrence = clamp(independentHostCount(ids, evidence) * 2.2);
    const scoreFactors = {
      toolCount: clamp(tools.length * 2), manualSteps: clamp(manualSteps.length * 2.5), recurrence,
      switchingCost: /between|switch|duplicate|re-enter/i.test(text) ? 7 : 4,
      errorRisk: /fails|error|duplicate|re-enter/i.test(text) ? 8 : 4,
      timeCost: /manual|copy|re-enter/i.test(text) ? 8 : 4,
      willingnessToPay: /price|cost|pay|expensive|consultant/i.test(text) ? 6 : 3,
    };
    const score = Math.round(Object.values(scoreFactors).reduce((sum, value) => sum + value, 0) / 7 * 10);
    const relatedComplaint = complaints.find((item) => item.representativeEvidenceIds.some((id) => ids.includes(id)));
    return {
      id: stableId("stitch", job), job, segment: relatedComplaint?.affectedSegment ?? null, tools, manualSteps,
      evidenceIds: evidenceUnion(ids), scoreFactors, score, confidence: Math.min(0.92, 0.38 + items.length * 0.1 + independentHostCount(ids, evidence) * 0.08),
    };
  }).sort((a, b) => b.score - a.score);
}

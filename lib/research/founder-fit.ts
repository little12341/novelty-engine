import type { IdeaCandidate, ResearchUserContext } from "./types.ts";

const list = (value: unknown, field: string, limit: number): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new RangeError(`${field} must be an array of strings.`);
  return value.map((item) => item.trim().slice(0, 160)).filter(Boolean).slice(0, limit);
};

export function sanitizeFounderContext(value: unknown): ResearchUserContext | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("userContext must be an object.");
  const input = value as Record<string, unknown>;
  const text = (field: string, limit = 120) => input[field] === undefined ? undefined : typeof input[field] === "string" ? (input[field] as string).trim().slice(0, limit) : (() => { throw new RangeError(`${field} must be a string.`); })();
  const integer = (field: string, max: number) => input[field] === undefined ? undefined : typeof input[field] === "number" && Number.isInteger(input[field]) && input[field] >= 1 && input[field] <= max ? input[field] as number : (() => { throw new RangeError(`${field} must be an integer between 1 and ${max}.`); })();
  if (input.riskTolerance !== undefined && !["low", "medium", "high"].includes(String(input.riskTolerance))) throw new RangeError("riskTolerance must be low, medium, or high.");
  return {
    profileId: text("profileId"), preferredIndustries: list(input.preferredIndustries, "preferredIndustries", 12), geography: text("geography"),
    budget: text("budget"), technicalSkills: list(input.technicalSkills, "technicalSkills", 20), availableCapital: text("availableCapital"),
    businessModelPreferences: list(input.businessModelPreferences, "businessModelPreferences", 12), resources: list(input.resources, "resources", 20),
    previouslyResearchedMarkets: list(input.previouslyResearchedMarkets, "previouslyResearchedMarkets", 30), previouslyRejectedMechanisms: list(input.previouslyRejectedMechanisms, "previouslyRejectedMechanisms", 50),
    teamSize: integer("teamSize", 100), timeToMvpWeeks: integer("timeToMvpWeeks", 260), technicalLimits: list(input.technicalLimits, "technicalLimits", 20),
    industryExclusions: list(input.industryExclusions, "industryExclusions", 30), geographyExclusions: list(input.geographyExclusions, "geographyExclusions", 30),
    riskTolerance: input.riskTolerance as ResearchUserContext["riskTolerance"], distributionChannels: list(input.distributionChannels, "distributionChannels", 20),
  };
}

export function assessFounderFit(candidate: IdeaCandidate, context: ResearchUserContext | undefined): { score: number; rejected: boolean; reasons: string[] } {
  if (!context) return { score: 5, rejected: false, reasons: ["No founder constraints were supplied; founder fit remains unknown."] };
  const reasons: string[] = [];
  const text = `${candidate.summary} ${candidate.technology ?? ""} ${candidate.businessModel ?? ""} ${candidate.distribution ?? ""}`.toLowerCase();
  if (context.industryExclusions?.some((item) => text.includes(item.toLowerCase()))) reasons.push("Candidate falls inside an explicitly excluded industry.");
  if (context.technicalLimits?.some((item) => text.includes(item.toLowerCase()))) reasons.push("Candidate conflicts with an explicit technical limit.");
  if (context.geographyExclusions?.some((item) => text.includes(item.toLowerCase()))) reasons.push("Candidate depends on an excluded geography.");
  if (context.timeToMvpWeeks && context.timeToMvpWeeks <= 4 && /hardware|robot|medical|regulated|marketplace/i.test(text)) reasons.push("Likely MVP time exceeds the supplied limit.");
  if (context.teamSize && context.teamSize <= 2 && /marketplace|hardware|regulated|enterprise integration/i.test(text)) reasons.push("Execution scope appears incompatible with the supplied team size.");
  if (context.riskTolerance === "low" && /regulated|medical|financial|hardware|liability|marketplace/i.test(text)) reasons.push("Risk profile exceeds the supplied low risk tolerance.");
  if (context.distributionChannels?.length && candidate.distribution && !context.distributionChannels.some((item) => candidate.distribution!.toLowerCase().includes(item.toLowerCase()))) reasons.push("Proposed distribution does not match an allowed founder channel.");
  return { score: Math.max(0, 10 - reasons.length * 3), rejected: reasons.length > 0, reasons };
}

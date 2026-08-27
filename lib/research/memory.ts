import { createHash } from "node:crypto";
import type { ResearchMemoryProfile, ResearchUserContext } from "./types.ts";
import { getPlatformRecord, privateIdentity, putPlatformRecord } from "./platform-store.ts";

const list = (values: string[] | undefined, limit: number) => values?.map((item) => item.trim().slice(0, 160)).filter(Boolean).slice(0, limit);

function safeContext(input: ResearchUserContext): ResearchUserContext {
  return {
    preferredIndustries: list(input.preferredIndustries, 12),
    geography: input.geography?.trim().slice(0, 120),
    budget: input.budget?.trim().slice(0, 120),
    technicalSkills: list(input.technicalSkills, 20),
    availableCapital: input.availableCapital?.trim().slice(0, 120),
    businessModelPreferences: list(input.businessModelPreferences, 12),
    resources: list(input.resources, 20),
    previouslyResearchedMarkets: list(input.previouslyResearchedMarkets, 30),
    previouslyRejectedMechanisms: list(input.previouslyRejectedMechanisms, 50),
    teamSize: input.teamSize === undefined ? undefined : Math.max(1, Math.min(100, Math.trunc(input.teamSize))),
    timeToMvpWeeks: input.timeToMvpWeeks === undefined ? undefined : Math.max(1, Math.min(260, Math.trunc(input.timeToMvpWeeks))),
    technicalLimits: list(input.technicalLimits, 20),
    industryExclusions: list(input.industryExclusions, 30),
    geographyExclusions: list(input.geographyExclusions, 30),
    riskTolerance: input.riskTolerance,
    distributionChannels: list(input.distributionChannels, 20),
  };
}

export async function saveResearchMemory(input: {
  userId: string;
  optedIn: boolean;
  context: ResearchUserContext;
  previousRunIds?: string[];
  now?: Date;
}): Promise<ResearchMemoryProfile> {
  if (!input.optedIn) throw new RangeError("Research memory is opt-in and requires optedIn=true.");
  if (input.userId.trim().length < 3) throw new RangeError("A stable user identifier is required for opt-in memory.");
  const userId = privateIdentity(input.userId);
  const id = `profile_${createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;
  const existing = await getPlatformRecord<ResearchMemoryProfile>("memory", id);
  const timestamp = (input.now ?? new Date()).toISOString();
  const profile: ResearchMemoryProfile = {
    id, userId, optedIn: true,
    ...safeContext(input.context),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    previousRunIds: [...new Set([...(existing?.previousRunIds ?? []), ...(input.previousRunIds ?? []).filter((runId) => /^research_[a-zA-Z0-9_]{8,80}$/.test(runId))])].slice(-100),
  };
  await putPlatformRecord("memory", id, profile, new Date(timestamp).getTime());
  return profile;
}

export async function getResearchMemory(profileId: string, userId: string): Promise<ResearchMemoryProfile | null> {
  const profile = await getPlatformRecord<ResearchMemoryProfile>("memory", profileId);
  return profile?.userId === privateIdentity(userId) && profile.optedIn ? profile : null;
}

export async function disableResearchMemory(profileId: string, userId: string, now = new Date()): Promise<boolean> {
  const profile = await getPlatformRecord<ResearchMemoryProfile>("memory", profileId);
  if (!profile || profile.userId !== privateIdentity(userId)) return false;
  const disabled: ResearchMemoryProfile = {
    id: profile.id, userId: profile.userId, optedIn: false, createdAt: profile.createdAt,
    updatedAt: now.toISOString(), previousRunIds: [],
  };
  await putPlatformRecord("memory", profileId, disabled, now.getTime());
  return true;
}

export function mergeResearchContext(memory: ResearchMemoryProfile | null, current: ResearchUserContext | undefined): ResearchUserContext | undefined {
  if (!memory && !current) return undefined;
  return { ...(memory ?? {}), ...(current ?? {}), profileId: memory?.id ?? current?.profileId };
}

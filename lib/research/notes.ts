import { randomUUID } from "node:crypto";
import { listPlatformRecords, privateIdentity, putPlatformRecord } from "./platform-store.ts";
import { getResearchResultById } from "./store.ts";
import type { ResearchNote } from "./types.ts";

export async function saveResearchNote(input: {
  runId: string; userId: string; candidateId?: string; kind?: ResearchNote["kind"];
  title: string; body: string; tags?: string[]; folder?: string; now?: Date;
}): Promise<ResearchNote> {
  const run = await getResearchResultById(input.runId);
  if (!run) throw new RangeError("Research run was not found.");
  if (input.userId.trim().length < 3) throw new RangeError("A stable user identifier is required for notes.");
  if (input.candidateId && !run.candidates.some((item) => item.id === input.candidateId)) throw new RangeError("Candidate was not found in the research run.");
  const at = (input.now ?? new Date()).toISOString();
  const note: ResearchNote = {
    id: `note_${randomUUID().replaceAll("-", "").slice(0, 16)}`, runId: run.id, userId: privateIdentity(input.userId),
    candidateId: input.candidateId?.slice(0, 120) ?? null, kind: input.kind ?? "research_note",
    title: input.title.trim().slice(0, 160), body: input.body.trim().slice(0, 5_000),
    tags: [...new Set((input.tags ?? []).map((item) => item.trim().toLowerCase().slice(0, 50)).filter(Boolean))].slice(0, 20),
    folder: input.folder?.trim().slice(0, 120) || null, createdAt: at, updatedAt: at,
  };
  if (!note.title || !note.body) throw new RangeError("Note title and body are required.");
  await putPlatformRecord("notes", note.id, note, new Date(at).getTime());
  return note;
}

export async function listResearchNotes(userId: string, options: { runId?: string; folder?: string; tag?: string; limit?: number } = {}) {
  const identity = privateIdentity(userId);
  const records = await listPlatformRecords<ResearchNote>("notes", options.limit ?? 100);
  return records.filter((item) => item.userId === identity
    && (!options.runId || item.runId === options.runId)
    && (!options.folder || item.folder === options.folder)
    && (!options.tag || item.tags.includes(options.tag.toLowerCase())));
}

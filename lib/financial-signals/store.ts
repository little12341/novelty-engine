import { getPlatformRecord, putPlatformRecord } from "../research/platform-store.ts";
import type { FinancialEvidenceSignal } from "./types.ts";

export async function persistFinancialSignal(signal: FinancialEvidenceSignal): Promise<{ signal: FinancialEvidenceSignal; durable: boolean }> {
  if (new Date(signal.persistedAt).getTime() > Date.now() + 60_000) throw new RangeError("A financial signal cannot be persisted with a future timestamp.");
  const existing = await getPlatformRecord<FinancialEvidenceSignal>("financial_signals", signal.id);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(signal)) throw new RangeError("Persisted financial signals are immutable.");
    return { signal: existing, durable: true };
  }
  const stored = await putPlatformRecord("financial_signals", signal.id, signal, new Date(signal.persistedAt).getTime());
  return { signal, durable: stored.durable };
}

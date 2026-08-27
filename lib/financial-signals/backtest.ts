import { createHash } from "node:crypto";
import type { FinancialBacktestResult, FinancialEvidenceSignal, PriceObservation, SignalOutcome } from "./types.ts";

const DAY = 86_400_000;
const average = (values: Array<number | null>) => {
  const known = values.filter((item): item is number => item !== null && Number.isFinite(item));
  return known.length ? known.reduce((sum, item) => sum + item, 0) / known.length : null;
};
const rounded = (value: number | null) => value === null ? null : Math.round(value * 100_000) / 100_000;

export function createFinancialSignal(input: Omit<FinancialEvidenceSignal, "id">): FinancialEvidenceSignal {
  const observed = new Date(input.observedAt).getTime();
  const persisted = new Date(input.persistedAt).getTime();
  const expires = new Date(input.expiresAt).getTime();
  if (![observed, persisted, expires].every(Number.isFinite)) throw new RangeError("Financial signal timestamps must be valid ISO dates.");
  if (persisted < observed) throw new RangeError("A signal cannot be persisted before it was observed.");
  if (expires <= persisted) throw new RangeError("A signal expiry must be after persistence.");
  if (!input.evidenceIds.length) throw new RangeError("A financial hypothesis requires public evidence IDs before persistence.");
  if (input.confidence < 0 || input.confidence > 1) throw new RangeError("Signal confidence must be between 0 and 1.");
  const id = `fsignal_${createHash("sha256").update(`${input.symbol}:${input.hypothesis}:${input.observedAt}:${input.persistedAt}`).digest("hex").slice(0, 18)}`;
  return { ...input, symbol: input.symbol.trim().toUpperCase().slice(0, 20), hypothesis: input.hypothesis.trim().slice(0, 1_000), id };
}

function observation(points: PriceObservation[], target: number): PriceObservation | null {
  return points.filter((item) => new Date(item.at).getTime() >= target).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())[0] ?? null;
}

function signalOutcome(signal: FinancialEvidenceSignal, prices: PriceObservation[]): SignalOutcome {
  const points = prices.filter((item) => item.symbol.toUpperCase() === signal.symbol && new Date(item.at).getTime() >= new Date(signal.persistedAt).getTime()).sort((a, b) => a.at.localeCompare(b.at));
  const base = observation(points, new Date(signal.persistedAt).getTime());
  const calculate = (days: number) => {
    if (!base) return { value: null, excess: null };
    const later = observation(points, new Date(signal.persistedAt).getTime() + days * DAY);
    if (!later || base.price <= 0 || base.benchmarkPrice <= 0) return { value: null, excess: null };
    const value = later.price / base.price - 1;
    const benchmark = later.benchmarkPrice / base.benchmarkPrice - 1;
    return { value, excess: value - benchmark };
  };
  const day1 = calculate(1); const day5 = calculate(5); const day30 = calculate(30);
  const decisive = day5.excess ?? day30.excess ?? day1.excess;
  const hit = decisive === null ? null : signal.direction === "positive" ? decisive > 0 : decisive < 0;
  return {
    signalId: signal.id,
    returns: { day1: rounded(day1.value), day5: rounded(day5.value), day30: rounded(day30.value) },
    excessReturns: { day1: rounded(day1.excess), day5: rounded(day5.excess), day30: rounded(day30.excess) }, hit,
  };
}

export function backtestFinancialSignals(signals: FinancialEvidenceSignal[], prices: PriceObservation[], options: { minimumSampleSize?: number; evaluatedAt?: Date } = {}): FinancialBacktestResult {
  const minimumSampleSize = Math.max(5, Math.min(500, Math.trunc(options.minimumSampleSize ?? 20)));
  const outcomes = signals.map((signal) => signalOutcome(signal, prices));
  const paired = outcomes.map((outcome, index) => ({ outcome, signal: signals[index] })).filter((item) => item.outcome.hit !== null);
  const hits = paired.filter((item) => item.outcome.hit).length;
  const falsePositives = paired.filter((item) => item.signal.confidence >= .6 && item.outcome.hit === false).length;
  let cumulative = 0; let peak = 0; let maxDrawdown = 0;
  for (const item of paired) {
    const value = item.outcome.excessReturns.day5 ?? item.outcome.excessReturns.day30 ?? item.outcome.excessReturns.day1 ?? 0;
    const signed = item.signal.direction === "positive" ? value : -value;
    cumulative += signed; peak = Math.max(peak, cumulative); maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }
  const calibrationError = average(paired.map((item) => Math.abs(item.signal.confidence - (item.outcome.hit ? 1 : 0))));
  const metrics = {
    meanReturn1Day: rounded(average(outcomes.map((item) => item.returns.day1))),
    meanReturn5Day: rounded(average(outcomes.map((item) => item.returns.day5))),
    meanReturn30Day: rounded(average(outcomes.map((item) => item.returns.day30))),
    meanExcessReturn1Day: rounded(average(outcomes.map((item) => item.excessReturns.day1))),
    meanExcessReturn5Day: rounded(average(outcomes.map((item) => item.excessReturns.day5))),
    meanExcessReturn30Day: rounded(average(outcomes.map((item) => item.excessReturns.day30))),
    hitRate: paired.length ? rounded(hits / paired.length) : null,
    falsePositiveRate: paired.length ? rounded(falsePositives / paired.length) : null,
    maxDrawdown: paired.length ? rounded(maxDrawdown) : null,
    calibrationError: rounded(calibrationError), sampleSize: paired.length,
  };
  const averageExcess = metrics.meanExcessReturn5Day ?? metrics.meanExcessReturn30Day ?? metrics.meanExcessReturn1Day;
  const verdict: FinancialBacktestResult["verdict"] = paired.length < minimumSampleSize ? "INSUFFICIENT_SAMPLE"
    : (metrics.hitRate ?? 0) < .52 || (averageExcess ?? 0) <= 0 ? "KILLED" : "SURVIVES";
  return {
    evaluatedAt: (options.evaluatedAt ?? new Date()).toISOString(), outcomes, metrics, verdict,
    reason: verdict === "INSUFFICIENT_SAMPLE" ? `Only ${paired.length} evaluable signals exist; at least ${minimumSampleSize} are required before judging repeatability.`
      : verdict === "KILLED" ? "The strategy failed its predeclared repeatability gate on hit rate or excess return."
        : "The historical sample cleared the minimum hit-rate and excess-return gates; prospective performance remains unproven.",
    disclaimer: "Historical evidence testing is not guaranteed stock prediction or investment advice.",
  };
}

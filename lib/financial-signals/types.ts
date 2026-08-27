export interface FinancialEvidenceSignal {
  id: string;
  symbol: string;
  hypothesis: string;
  direction: "positive" | "negative";
  observedAt: string;
  persistedAt: string;
  expiresAt: string;
  evidenceIds: string[];
  confidence: number;
  falsifiers: string[];
}

export interface PriceObservation {
  symbol: string;
  at: string;
  price: number;
  benchmarkPrice: number;
}

export interface SignalOutcome {
  signalId: string;
  returns: { day1: number | null; day5: number | null; day30: number | null };
  excessReturns: { day1: number | null; day5: number | null; day30: number | null };
  hit: boolean | null;
}

export interface FinancialBacktestResult {
  evaluatedAt: string;
  outcomes: SignalOutcome[];
  metrics: {
    meanReturn1Day: number | null;
    meanReturn5Day: number | null;
    meanReturn30Day: number | null;
    meanExcessReturn1Day: number | null;
    meanExcessReturn5Day: number | null;
    meanExcessReturn30Day: number | null;
    hitRate: number | null;
    falsePositiveRate: number | null;
    maxDrawdown: number | null;
    calibrationError: number | null;
    sampleSize: number;
  };
  verdict: "INSUFFICIENT_SAMPLE" | "SURVIVES" | "KILLED";
  reason: string;
  disclaimer: "Historical evidence testing is not guaranteed stock prediction or investment advice.";
}

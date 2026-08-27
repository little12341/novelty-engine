export class BoundedJsonError extends Error {
  readonly status: 400 | 413;
  readonly code: "INVALID_JSON" | "REQUEST_TOO_LARGE";

  constructor(status: 400 | 413, code: "INVALID_JSON" | "REQUEST_TOO_LARGE", message: string) {
    super(message);
    this.name = "BoundedJsonError";
    this.status = status;
    this.code = code;
  }
}

export async function readBoundedJson<T>(request: Request, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BoundedJsonError(413, "REQUEST_TOO_LARGE", "Request body is too large.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new BoundedJsonError(413, "REQUEST_TOO_LARGE", "Request body is too large.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BoundedJsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

/**
 * Vercel replaces x-forwarded-for at its edge. The optional Novelty client header
 * and URL/query values are deliberately excluded so rotating either cannot reset
 * a public rate-limit identity.
 */
export function clientNetworkIdentity(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "unknown-ip").slice(0, 128);
}

type OperationalValue = string | number | boolean | null;

export function operationalLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, OperationalValue> = {},
): void {
  const safeFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key.slice(0, 80),
    typeof value === "string" ? value.slice(0, 200) : value,
  ]));
  console[level]("novelty_operation", JSON.stringify({ at: new Date().toISOString(), event, ...safeFields }));
}

export function safeErrorCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof DOMException && error.name === "TimeoutError" || /timeout|timed\s*out|time budget/i.test(message)) return "TIMEOUT";
  if (error instanceof DOMException && error.name === "AbortError" || /cancel|aborted/i.test(message)) return "CANCELLED";
  if (/429|rate.?limit|quota/i.test(message)) return "RATE_LIMIT";
  if (/401|403|unauthor|forbidden/i.test(message)) return "PROVIDER_AUTH";
  if (/json|malformed|schema|array/i.test(message)) return "MALFORMED_RESPONSE";
  if (/HTTP 5\d\d/i.test(message)) return "UPSTREAM_5XX";
  if (error instanceof RangeError || error instanceof SyntaxError) return "INVALID_INPUT";
  return "INTERNAL_ERROR";
}

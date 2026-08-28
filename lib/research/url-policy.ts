export interface UrlPolicyDecision {
  allowed: boolean;
  normalizedUrl: string | null;
  reason: string | null;
}

const LOCAL_HOSTS = new Set(["localhost", "localhost.localdomain", "0.0.0.0", "127.0.0.1", "::1", "[::1]"]);
const CREDENTIAL_QUERY_KEYS = /^(?:access[_-]?token|api[_-]?key|auth|authorization|client[_-]?secret|credential|key|password|secret|signature|sig|token)$/i;

function privateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
    || parts[0] === 169 && parts[1] === 254
    || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
    || parts[0] === 192 && parts[1] === 168
    || parts[0] >= 224;
}

function privateIpv6(host: string): boolean {
  const value = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!value.includes(":")) return false;
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd")
    || /^fe[89ab]/.test(value) || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.")
    || value.startsWith("::ffff:192.168.");
}

export function validateExternalResearchUrl(raw: string): UrlPolicyDecision {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return { allowed: false, normalizedUrl: null, reason: "protocol_not_allowed" };
    if (url.username || url.password) return { allowed: false, normalizedUrl: null, reason: "url_credentials_not_allowed" };
    if ([...url.searchParams.keys()].some((key) => CREDENTIAL_QUERY_KEYS.test(key))) return { allowed: false, normalizedUrl: null, reason: "url_credentials_not_allowed" };
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || LOCAL_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || privateIpv4(host) || privateIpv6(host)) {
      return { allowed: false, normalizedUrl: null, reason: "private_or_local_destination" };
    }
    if (url.port && !["80", "443"].includes(url.port)) return { allowed: false, normalizedUrl: null, reason: "non_standard_port" };
    url.protocol = "https:";
    url.port = "";
    return { allowed: true, normalizedUrl: url.toString(), reason: null };
  } catch {
    return { allowed: false, normalizedUrl: null, reason: "malformed_url" };
  }
}

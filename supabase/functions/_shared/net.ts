type UrlValidationOptions = {
  allowHttp?: boolean;
  allowedPorts?: number[];
};

type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

type FetchLimits = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
} & UrlValidationOptions;

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_ALLOWED_PORTS = [443];

function normalizeOptions(opts: UrlValidationOptions): Required<UrlValidationOptions> {
  return {
    allowHttp: Boolean(opts.allowHttp),
    allowedPorts: opts.allowedPorts?.length ? opts.allowedPorts : DEFAULT_ALLOWED_PORTS,
  };
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;
  if (host.endsWith(".lan")) return true;
  return false;
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = parseIpv4(hostname);
  if (!parts) return false;

  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isIpv6(hostname: string): boolean {
  return hostname.includes(":");
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  if (host.startsWith("fe80")) return true;
  if (host.startsWith("2001:db8")) return true;
  return false;
}

function isNumericHostname(hostname: string): boolean {
  return /^[0-9]+$/.test(hostname);
}

export function validateOutboundUrl(input: string, opts: UrlValidationOptions = {}): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  const { allowHttp, allowedPorts } = normalizeOptions(opts);

  if (url.username || url.password) {
    return { ok: false, reason: "Userinfo not allowed in URL" };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && !(allowHttp && protocol === "http:")) {
    return { ok: false, reason: "Only https URLs are allowed" };
  }

  if (!url.hostname) {
    return { ok: false, reason: "Hostname required" };
  }

  if (isNumericHostname(url.hostname)) {
    return { ok: false, reason: "Numeric hostnames are not allowed" };
  }

  if (isLocalHostname(url.hostname)) {
    return { ok: false, reason: "Localhost URLs are not allowed" };
  }

  if (isPrivateIpv4(url.hostname)) {
    return { ok: false, reason: "Private IPv4 addresses are not allowed" };
  }

  if (isIpv6(url.hostname) && isPrivateIpv6(url.hostname)) {
    return { ok: false, reason: "Private IPv6 addresses are not allowed" };
  }

  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port <= 0) {
      return { ok: false, reason: "Invalid port" };
    }
    if (!allowedPorts.includes(port)) {
      return { ok: false, reason: "Port not allowed" };
    }
  }

  return { ok: true, url };
}

async function readBodyWithLimit(resp: Response, maxBytes: number): Promise<{ text: string; bytes: number }> {
  const contentLength = resp.headers.get("content-length");
  if (contentLength) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > maxBytes) {
      throw new Error("Response too large");
    }
  }

  if (!resp.body) return { text: "", bytes: 0 };

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.length;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(combined);
  return { text, bytes: received };
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function fetchTextWithLimits(
  input: string,
  opts: FetchLimits = {},
): Promise<{ status: number; text: string; bytes: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  const validated = validateOutboundUrl(input, opts);
  if (!validated.ok) throw new Error(validated.reason);

  let currentUrl = validated.url;
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(currentUrl.toString(), {
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (isRedirect(resp.status)) {
      const location = resp.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      if (redirects >= maxRedirects) throw new Error("Too many redirects");
      const nextUrl = new URL(location, currentUrl);
      const checked = validateOutboundUrl(nextUrl.toString(), opts);
      if (!checked.ok) throw new Error(checked.reason);
      currentUrl = checked.url;
      redirects += 1;
      continue;
    }

    const { text, bytes } = await readBodyWithLimit(resp, maxBytes);
    return { status: resp.status, text, bytes };
  }
}

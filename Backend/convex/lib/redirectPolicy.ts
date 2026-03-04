const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export interface RedirectValidationOptions {
  siteUrl: string;
  allowedOriginsCsv?: string;
  nodeEnv?: string;
}

export function resolveRedirect(redirectTo: string, siteUrl: string): URL {
  let baseUrl: URL;
  try {
    baseUrl = new URL(siteUrl);
  } catch {
    throw new Error("SITE_URL is not a valid URL");
  }

  try {
    return new URL(redirectTo, baseUrl);
  } catch {
    throw new Error(`Invalid redirect target: ${redirectTo}`);
  }
}

function parseAllowedOrigins(siteUrl: string, allowedOriginsCsv?: string): Set<string> {
  const allowed = new Set<string>();
  allowed.add(new URL(siteUrl).origin);

  if (!allowedOriginsCsv) {
    return allowed;
  }

  for (const rawOrigin of allowedOriginsCsv.split(",")) {
    const trimmed = rawOrigin.trim();
    if (!trimmed) continue;
    try {
      allowed.add(new URL(trimmed).origin);
    } catch {
      throw new Error(`Invalid redirect allowlist origin: ${trimmed}`);
    }
  }

  return allowed;
}

export function isAllowedRedirect(
  url: URL,
  options: RedirectValidationOptions,
): boolean {
  const allowedOrigins = parseAllowedOrigins(
    options.siteUrl,
    options.allowedOriginsCsv,
  );
  if (allowedOrigins.has(url.origin)) {
    return true;
  }

  const isLocalDev = options.nodeEnv !== "production";
  return (
    isLocalDev &&
    url.protocol === "http:" &&
    LOCALHOST_HOSTNAMES.has(url.hostname)
  );
}

export function validateRedirectOrThrow(
  url: URL,
  options: RedirectValidationOptions,
): void {
  if (!isAllowedRedirect(url, options)) {
    const allowedOrigins = Array.from(
      parseAllowedOrigins(options.siteUrl, options.allowedOriginsCsv),
    ).join(", ");
    const localhostClause =
      options.nodeEnv !== "production"
        ? ", http://localhost, http://127.0.0.1 (dev only)"
        : "";

    throw new Error(
      `Redirect origin is not allowed: ${url.origin}. Allowed origins: ${allowedOrigins}${localhostClause}`,
    );
  }
}

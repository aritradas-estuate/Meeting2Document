const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

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

export function isAllowedRedirect(url: URL): boolean {
  if (url.protocol === "https:") {
    return true;
  }

  return url.protocol === "http:" && LOCALHOST_HOSTNAMES.has(url.hostname);
}

export function validateRedirectOrThrow(url: URL): void {
  if (!isAllowedRedirect(url)) {
    throw new Error(
      `Redirect origin is not allowed: ${url.origin}. Allowed: any https origin, localhost, 127.0.0.1`,
    );
  }
}

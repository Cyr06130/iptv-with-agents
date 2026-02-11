const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validate that a URL string uses an allowed protocol (http/https only).
 * Returns the original string if valid, or null if invalid/malicious.
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate a stream URL. Same as sanitizeUrl but also rejects non-URL strings.
 */
export function sanitizeStreamUrl(url: string): string | null {
  return sanitizeUrl(url);
}

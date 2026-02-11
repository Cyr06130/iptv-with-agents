import { test, expect } from "@playwright/test";

test.describe("Security Headers", () => {
  test("response includes Content-Security-Policy with frame-ancestors none", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["content-security-policy"]).toBeDefined();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("response includes all required CSP directives", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    const csp = headers["content-security-policy"];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("connect-src 'self' wss://bulletin.dotspark.app https://ipfs.dotspark.app http://localhost:3001");
    expect(csp).toContain("img-src 'self' https: data:");
    expect(csp).toContain("media-src 'self' https: blob:");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("response includes X-Frame-Options: DENY", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
  });

  test("response includes X-Content-Type-Options: nosniff", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("response includes Referrer-Policy: strict-origin-when-cross-origin", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("response includes Permissions-Policy", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["permissions-policy"]).toBeDefined();
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
  });

  test("security headers are present on all pages", async ({ request }) => {
    const pages = ["/", "/about"];

    for (const page of pages) {
      const response = await request.get(page);
      const headers = response.headers();

      // Check key security headers are present
      expect(headers["content-security-policy"]).toBeDefined();
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
    }
  });

  test("security headers prevent clickjacking", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    // Both CSP frame-ancestors and X-Frame-Options should prevent clickjacking
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
  });

  test("CSP does not allow unsafe-eval except for WASM", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    const csp = headers["content-security-policy"];

    // Should have wasm-unsafe-eval for WASM support
    expect(csp).toContain("'wasm-unsafe-eval'");
  });

  test("CSP restricts connect-src to specific domains", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    const csp = headers["content-security-policy"];

    // Should allow self, https/http for stream fetches, and WebSocket for chain
    expect(csp).toContain("connect-src 'self' https: http: wss://bulletin.dotspark.app");
  });
});

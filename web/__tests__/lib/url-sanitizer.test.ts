import { describe, it, expect } from "vitest";
import { sanitizeUrl, sanitizeStreamUrl } from "@/lib/url-sanitizer";

describe("sanitizeUrl", () => {
  it("returns valid http://example.com URLs unchanged", () => {
    const url = "http://example.com";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("returns valid https://example.com/path URLs unchanged", () => {
    const url = "https://example.com/path";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("returns null for javascript:alert(1)", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for data:text/html,<h1>hi</h1>", () => {
    expect(sanitizeUrl("data:text/html,<h1>hi</h1>")).toBeNull();
  });

  it("returns null for blob:http://example.com/uuid", () => {
    expect(sanitizeUrl("blob:http://example.com/uuid")).toBeNull();
  });

  it("returns null for ftp://example.com", () => {
    expect(sanitizeUrl("ftp://example.com")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(sanitizeUrl("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(sanitizeUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(sanitizeUrl(undefined)).toBeNull();
  });

  it("returns null for malformed URLs (e.g., not-a-url)", () => {
    expect(sanitizeUrl("not-a-url")).toBeNull();
  });

  it("returns null for JavaScript: (case variations)", () => {
    expect(sanitizeUrl("JavaScript:alert(1)")).toBeNull();
    expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBeNull();
    expect(sanitizeUrl("JaVaScRiPt:alert(1)")).toBeNull();
  });

  it("returns valid URLs with ports (http://localhost:3000/path)", () => {
    const url = "http://localhost:3000/path";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("returns valid URLs with query strings and fragments", () => {
    const url = "https://example.com/path?query=1#fragment";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("returns null for file:// protocol", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:msgbox()")).toBeNull();
  });

  it("handles URLs with authentication", () => {
    const url = "https://user:pass@example.com/path";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("handles internationalized domain names", () => {
    const url = "https://münchen.de/path";
    expect(sanitizeUrl(url)).toBe(url);
  });
});

describe("sanitizeStreamUrl", () => {
  it("returns valid HLS URLs unchanged (https://example.com/stream.m3u8)", () => {
    const url = "https://example.com/stream.m3u8";
    expect(sanitizeStreamUrl(url)).toBe(url);
  });

  it("returns valid HTTP HLS URLs unchanged", () => {
    const url = "http://example.com/stream.m3u8";
    expect(sanitizeStreamUrl(url)).toBe(url);
  });

  it("returns null for non-http protocols", () => {
    expect(sanitizeStreamUrl("ftp://example.com/stream.m3u8")).toBeNull();
    expect(sanitizeStreamUrl("rtmp://example.com/stream")).toBeNull();
    expect(sanitizeStreamUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(sanitizeStreamUrl("")).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(sanitizeStreamUrl("not-a-url")).toBeNull();
  });

  it("handles URLs with query parameters", () => {
    const url = "https://example.com/stream.m3u8?token=abc123";
    expect(sanitizeStreamUrl(url)).toBe(url);
  });

  it("handles localhost streaming URLs", () => {
    const url = "http://localhost:8080/live/stream.m3u8";
    expect(sanitizeStreamUrl(url)).toBe(url);
  });
});

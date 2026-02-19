import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetNonProductAccounts = vi.fn();
const mockGetNonProductAccountSigner = vi.fn();

vi.mock("@novasamatech/product-sdk", () => ({
  createAccountsProvider: () => ({
    getNonProductAccounts: mockGetNonProductAccounts,
    getNonProductAccountSigner: mockGetNonProductAccountSigner,
  }),
}));

vi.mock("@polkadot-api/substrate-bindings", () => ({
  AccountId: () => ({
    dec: (bytes: Uint8Array) =>
      `5${Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 46)}`,
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  isHostedEnvironment,
  useHostAccounts,
  getHostSigner,
} from "@/hooks/useHostAccount";

// ── Helpers ──────────────────────────────────────────────────────────

const originalTop = Object.getOwnPropertyDescriptor(window, "top");

function setWebviewMark(value: boolean | undefined): void {
  if (value === undefined) {
    delete (window as Record<string, unknown>)["__HOST_WEBVIEW_MARK__"];
  } else {
    (window as Record<string, unknown>)["__HOST_WEBVIEW_MARK__"] = value;
  }
}

function mockIframe(): void {
  Object.defineProperty(window, "top", {
    value: { notSameAsWindow: true },
    writable: true,
    configurable: true,
  });
}

function restoreTop(): void {
  if (originalTop) {
    Object.defineProperty(window, "top", originalTop);
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe("isHostedEnvironment", () => {
  afterEach(() => {
    setWebviewMark(undefined);
    restoreTop();
  });

  it("returns false when no markers are present", () => {
    expect(isHostedEnvironment()).toBe(false);
  });

  it("returns true when __HOST_WEBVIEW_MARK__ is true", () => {
    setWebviewMark(true);
    expect(isHostedEnvironment()).toBe(true);
  });

  it("returns false when __HOST_WEBVIEW_MARK__ is not true", () => {
    setWebviewMark(false);
    expect(isHostedEnvironment()).toBe(false);
  });

  it("returns true when window !== window.top (iframe)", () => {
    mockIframe();
    expect(isHostedEnvironment()).toBe(true);
  });
});

describe("useHostAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWebviewMark(undefined);
    restoreTop();
  });

  afterEach(() => {
    setWebviewMark(undefined);
    restoreTop();
  });

  it("returns empty accounts and isHosted=false in non-hosted env", () => {
    const { result } = renderHook(() => useHostAccounts());
    expect(result.current.accounts).toHaveLength(0);
    expect(result.current.isHosted).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("fetches accounts from host when hosted", async () => {
    setWebviewMark(true);

    const mockPublicKey = new Uint8Array(32).fill(42);
    mockGetNonProductAccounts.mockReturnValue(
      Promise.resolve({
        isOk: () => true,
        value: [{ publicKey: mockPublicKey, name: "Desktop User" }],
      }),
    );

    const { result } = renderHook(() => useHostAccounts());
    expect(result.current.isHosted).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0].name).toBe("Desktop User");
    expect(result.current.accounts[0].publicKey).toBe(mockPublicKey);
    expect(result.current.accounts[0].address).toMatch(/^5/);
  });

  it("handles SDK errors gracefully", async () => {
    setWebviewMark(true);

    mockGetNonProductAccounts.mockReturnValue(
      Promise.reject(new Error("Transport not available")),
    );

    const { result } = renderHook(() => useHostAccounts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toHaveLength(0);
  });

  it("handles SDK returning error result", async () => {
    setWebviewMark(true);

    mockGetNonProductAccounts.mockReturnValue(
      Promise.resolve({
        isOk: () => false,
        error: { tag: "RequestCredentialsErr::NotConnected" },
      }),
    );

    const { result } = renderHook(() => useHostAccounts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toHaveLength(0);
  });
});

describe("getHostSigner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a signer via product-sdk", () => {
    const mockSigner = { publicKey: new Uint8Array(32), sign: vi.fn() };
    mockGetNonProductAccountSigner.mockReturnValue(mockSigner);

    const publicKey = new Uint8Array(32).fill(1);
    const signer = getHostSigner(publicKey);

    expect(mockGetNonProductAccountSigner).toHaveBeenCalledWith({
      dotNsIdentifier: "",
      derivationIndex: 0,
      publicKey,
    });
    expect(signer).toBe(mockSigner);
  });
});

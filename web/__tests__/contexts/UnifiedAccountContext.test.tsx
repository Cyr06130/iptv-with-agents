import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

// ── Mock localStorage ───────────────────────────────────────────────

const localStorageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageMap.get(key) ?? null),
  setItem: vi.fn((key: string, val: string) => localStorageMap.set(key, val)),
  removeItem: vi.fn((key: string) => localStorageMap.delete(key)),
  clear: vi.fn(() => localStorageMap.clear()),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// ── Mocks ────────────────────────────────────────────────────────────

const mockPappSession = {
  remoteAccount: {
    accountId: new Uint8Array(32).fill(1),
  },
};

const mockDisconnect = vi.fn();
const mockDisconnectWallet = vi.fn();

let sessionValue: { session: unknown } = { session: null };
let authValue = { pending: false, disconnect: mockDisconnect, authenticate: vi.fn() };
let extensionAccounts: Array<{ address: string; name?: string; wallet: { name: string } }> = [];
let connectedWallets: unknown[] = [];

vi.mock("@novasamatech/host-papp-react-ui", () => ({
  useSession: () => sessionValue,
  useAuthentication: () => authValue,
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

vi.mock("@reactive-dot/react", () => ({
  useAccounts: () => extensionAccounts,
  useConnectedWallets: () => connectedWallets,
  useWalletDisconnector: () => [undefined, mockDisconnectWallet],
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  UnifiedAccountProvider,
  useUnifiedAccount,
} from "@/contexts/UnifiedAccountContext";

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <UnifiedAccountProvider>{children}</UnifiedAccountProvider>;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("UnifiedAccountContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMap.clear();
    sessionValue = { session: null };
    authValue = { pending: false, disconnect: mockDisconnect, authenticate: vi.fn() };
    extensionAccounts = [];
    connectedWallets = [];
  });

  it("returns empty accounts when nothing is connected", () => {
    const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
    expect(result.current.accounts).toHaveLength(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.selectedAccount).toBeNull();
    expect(result.current.authSource).toBeNull();
  });

  it("provides accounts from extension source", () => {
    extensionAccounts = [
      { address: "5Extension1", name: "My Account", wallet: { name: "Talisman" } },
      { address: "5Extension2", name: "Second", wallet: { name: "SubWallet" } },
    ];

    const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
    expect(result.current.accounts).toHaveLength(2);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.authSource).toBe("extension");
    expect(result.current.accounts[0].source).toBe("extension");
    expect(result.current.accounts[0].wallet?.name).toBe("Talisman");
  });

  it("provides accounts from PApp source", () => {
    sessionValue = { session: mockPappSession };

    const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.authSource).toBe("papp");
    expect(result.current.accounts[0].source).toBe("papp");
  });

  it("deduplicates accounts by address with PApp priority", () => {
    sessionValue = { session: mockPappSession };

    const { result: pappOnlyResult } = renderHook(() => useUnifiedAccount(), { wrapper });
    const pappAddress = pappOnlyResult.current.accounts[0]?.address;

    extensionAccounts = [
      { address: pappAddress ?? "duplicate", name: "Duplicate", wallet: { name: "Talisman" } },
      { address: "5Unique", name: "Unique", wallet: { name: "Talisman" } },
    ];

    const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
    const addresses = result.current.accounts.map((a) => a.address);
    const uniqueAddresses = new Set(addresses);
    expect(uniqueAddresses.size).toBe(addresses.length);
    expect(result.current.accounts[0].source).toBe("papp");
  });

  it("persists selected account to localStorage", () => {
    extensionAccounts = [
      { address: "5Test1", name: "Account 1", wallet: { name: "Talisman" } },
      { address: "5Test2", name: "Account 2", wallet: { name: "Talisman" } },
    ];

    const { result } = renderHook(() => useUnifiedAccount(), { wrapper });

    act(() => {
      result.current.setSelectedAccount(result.current.accounts[1]);
    });

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      "polkadot:selected-account",
      "5Test2",
    );
  });

  it("clears localStorage on disconnect", async () => {
    extensionAccounts = [
      { address: "5Test1", name: "Account 1", wallet: { name: "Talisman" } },
    ];

    const { result } = renderHook(() => useUnifiedAccount(), { wrapper });

    act(() => {
      result.current.setSelectedAccount(result.current.accounts[0]);
    });
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      "polkadot:selected-account",
      "5Test1",
    );

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("polkadot:selected-account");
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useUnifiedAccount());
    }).toThrow("useUnifiedAccount must be used within a UnifiedAccountProvider");
  });
});

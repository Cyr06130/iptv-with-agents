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

let hostAccountsValue: {
  accounts: Array<{ address: string; name?: string; publicKey: Uint8Array }>;
  loading: boolean;
  isHosted: boolean;
} = { accounts: [], loading: false, isHosted: false };

vi.mock("@/hooks/useHostAccount", () => ({
  useHostAccounts: () => hostAccountsValue,
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
    hostAccountsValue = { accounts: [], loading: false, isHosted: false };
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

  // ── Host account tests ──────────────────────────────────────────────

  describe("host accounts", () => {
    it("provides accounts from host source", () => {
      hostAccountsValue = {
        accounts: [
          { address: "5HostAddr1", name: "Desktop User", publicKey: new Uint8Array(32).fill(42) },
        ],
        loading: false,
        isHosted: true,
      };

      const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.authSource).toBe("host");
      expect(result.current.accounts[0].source).toBe("host");
      expect(result.current.accounts[0].publicKey).toBeDefined();
    });

    it("gives host accounts highest priority over papp and extension", () => {
      hostAccountsValue = {
        accounts: [
          { address: "5HostAddr1", name: "Host Account", publicKey: new Uint8Array(32).fill(1) },
        ],
        loading: false,
        isHosted: true,
      };
      sessionValue = { session: mockPappSession };
      extensionAccounts = [
        { address: "5Extension1", name: "Extension Account", wallet: { name: "Talisman" } },
      ];

      const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
      expect(result.current.accounts[0].source).toBe("host");
      expect(result.current.authSource).toBe("host");
    });

    it("auto-selects host account when hosted", () => {
      hostAccountsValue = {
        accounts: [
          { address: "5HostAddr1", name: "Auto-Selected", publicKey: new Uint8Array(32).fill(5) },
        ],
        loading: false,
        isHosted: true,
      };

      const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
      expect(result.current.selectedAccount?.address).toBe("5HostAddr1");
      expect(result.current.selectedAccount?.source).toBe("host");
    });

    it("disconnect is no-op for host accounts", async () => {
      hostAccountsValue = {
        accounts: [
          { address: "5HostAddr1", name: "Host", publicKey: new Uint8Array(32).fill(1) },
        ],
        loading: false,
        isHosted: true,
      };

      const { result } = renderHook(() => useUnifiedAccount(), { wrapper });

      // Ensure host account is selected
      expect(result.current.selectedAccount?.source).toBe("host");

      await act(async () => {
        await result.current.disconnect();
      });

      // Should NOT have called papp disconnect or wallet disconnector
      expect(mockDisconnect).not.toHaveBeenCalled();
      expect(mockDisconnectWallet).not.toHaveBeenCalled();
      // Account should still be selected
      expect(result.current.selectedAccount).not.toBeNull();
    });

    it("deduplicates host account with same address in extension", () => {
      hostAccountsValue = {
        accounts: [
          { address: "5SharedAddr", name: "Host Version", publicKey: new Uint8Array(32).fill(1) },
        ],
        loading: false,
        isHosted: true,
      };
      extensionAccounts = [
        { address: "5SharedAddr", name: "Extension Version", wallet: { name: "Talisman" } },
      ];

      const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
      const addresses = result.current.accounts.map((a) => a.address);
      expect(new Set(addresses).size).toBe(addresses.length);
      // Host version should win
      expect(result.current.accounts.find((a) => a.address === "5SharedAddr")?.source).toBe("host");
    });

    it("includes hostLoading in isConnecting", () => {
      hostAccountsValue = {
        accounts: [],
        loading: true,
        isHosted: true,
      };

      const { result } = renderHook(() => useUnifiedAccount(), { wrapper });
      expect(result.current.isConnecting).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────

const mockAuthenticate = vi.fn();
const mockSetSelectedAccount = vi.fn();
const mockDisconnect = vi.fn();

let unifiedAccountValue = {
  accounts: [] as Array<{
    address: string;
    name?: string;
    source: "papp" | "extension";
    wallet?: { name: string };
  }>,
  selectedAccount: null as {
    address: string;
    name?: string;
    source: "papp" | "extension";
    wallet?: { name: string };
  } | null,
  setSelectedAccount: mockSetSelectedAccount,
  authSource: null as "papp" | "extension" | null,
  pappSession: null as unknown,
  disconnect: mockDisconnect,
  isConnected: false,
  isConnecting: false,
};

vi.mock("@/contexts/UnifiedAccountContext", () => ({
  useUnifiedAccount: () => unifiedAccountValue,
}));

vi.mock("@novasamatech/host-papp-react-ui", () => ({
  useAuthentication: () => ({
    authenticate: mockAuthenticate,
    pending: false,
    pairingStatus: { step: "idle" },
    attestationStatus: { step: "idle" },
    abortAuthentication: vi.fn(),
  }),
}));

vi.mock("@reactive-dot/react", () => ({
  useWallets: () => [],
  useWalletConnector: () => [undefined, vi.fn()],
}));

vi.mock("@/components/polkadot-ui/custom-pairing-modal", () => ({
  CustomPairingModal: () => null,
}));

// ── Import after mocks ──────────────────────────────────────────────

import { ConnectWallet } from "@/components/ConnectWallet";

// ── Tests ────────────────────────────────────────────────────────────

describe("ConnectWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unifiedAccountValue = {
      accounts: [],
      selectedAccount: null,
      setSelectedAccount: mockSetSelectedAccount,
      authSource: null,
      pappSession: null,
      disconnect: mockDisconnect,
      isConnected: false,
      isConnecting: false,
    };
  });

  it("renders sign-in button when disconnected", () => {
    render(<ConnectWallet />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("renders wallet extension button when disconnected", () => {
    render(<ConnectWallet />);
    expect(screen.getByTitle("Connect with wallet extension")).toBeInTheDocument();
  });

  it("calls authenticate on sign-in click", () => {
    render(<ConnectWallet />);
    fireEvent.click(screen.getByText("Sign in"));
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it("shows account info when connected", () => {
    unifiedAccountValue = {
      ...unifiedAccountValue,
      accounts: [
        { address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", name: "Alice", source: "extension", wallet: { name: "Talisman" } },
      ],
      selectedAccount: {
        address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        name: "Alice",
        source: "extension",
        wallet: { name: "Talisman" },
      },
      isConnected: true,
      authSource: "extension",
    };

    render(<ConnectWallet />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("opens account menu on connected button click", () => {
    unifiedAccountValue = {
      ...unifiedAccountValue,
      accounts: [
        { address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", name: "Alice", source: "extension", wallet: { name: "Talisman" } },
      ],
      selectedAccount: {
        address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        name: "Alice",
        source: "extension",
        wallet: { name: "Talisman" },
      },
      isConnected: true,
      authSource: "extension",
    };

    render(<ConnectWallet />);
    fireEvent.click(screen.getByText("Alice"));
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Disconnect All")).toBeInTheDocument();
  });

  it("shows source badge for PApp account in menu", () => {
    unifiedAccountValue = {
      ...unifiedAccountValue,
      accounts: [
        { address: "5PappAccount123456789012345678901234567890", source: "papp" },
      ],
      selectedAccount: { address: "5PappAccount123456789012345678901234567890", source: "papp" },
      isConnected: true,
      authSource: "papp",
      pappSession: {},
    };

    render(<ConnectWallet />);
    // The connected button shows truncated address
    const truncatedAddr = screen.getByText("5PappA...7890");
    fireEvent.click(truncatedAddr);
    // Account menu should show "Polkadot App" source label (split with middot + address)
    expect(screen.getByText(/Polkadot App/)).toBeInTheDocument();
  });

  it("calls disconnect on Disconnect All click", async () => {
    unifiedAccountValue = {
      ...unifiedAccountValue,
      accounts: [
        { address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", name: "Alice", source: "extension", wallet: { name: "Talisman" } },
      ],
      selectedAccount: {
        address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        name: "Alice",
        source: "extension",
        wallet: { name: "Talisman" },
      },
      isConnected: true,
      authSource: "extension",
    };

    render(<ConnectWallet />);
    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByText("Disconnect All"));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────

const mockAuthenticate = vi.fn();
const mockAbort = vi.fn();

let pairingStatus = { step: "idle" } as
  | { step: "idle" }
  | { step: "pairing"; payload: string }
  | { step: "pairingError"; message: string };

let attestationStatus = { step: "idle" } as
  | { step: "idle" }
  | { step: "attestation" }
  | { step: "attestationError"; message: string };

vi.mock("@novasamatech/host-papp-react-ui", () => ({
  useAuthentication: () => ({
    pairingStatus,
    attestationStatus,
    abortAuthentication: mockAbort,
    authenticate: mockAuthenticate,
  }),
}));

// Mock QRCodeStyling to avoid canvas dependency in jsdom
vi.mock("qr-code-styling", () => {
  return {
    default: class MockQRCodeStyling {
      append() {}
      update() {}
    },
  };
});

// ── Import after mocks ──────────────────────────────────────────────

import { CustomPairingModal } from "@/components/polkadot-ui/custom-pairing-modal";

// ── Tests ────────────────────────────────────────────────────────────

describe("CustomPairingModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pairingStatus = { step: "idle" };
    attestationStatus = { step: "idle" };
  });

  it("does not render when idle", () => {
    const { container } = render(<CustomPairingModal />);
    // Modal should not be visible (no sign-in heading)
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("renders QR code area in pairing state", () => {
    pairingStatus = { step: "pairing", payload: "test-pairing-payload" };

    render(<CustomPairingModal />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(
      screen.getByText("Scan with your phone's camera to connect"),
    ).toBeInTheDocument();
  });

  it("shows loading spinner in attestation state", () => {
    attestationStatus = { step: "attestation" };

    render(<CustomPairingModal />);
    expect(screen.getByText("Setting things up")).toBeInTheDocument();
    expect(
      screen.getByText("This will only take a moment..."),
    ).toBeInTheDocument();
  });

  it("shows error with retry in pairingError state", () => {
    pairingStatus = { step: "pairingError", message: "Connection timed out" };

    render(<CustomPairingModal />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Connection timed out")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("shows error with retry in attestationError state", () => {
    attestationStatus = {
      step: "attestationError",
      message: "Attestation failed",
    };

    render(<CustomPairingModal />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Attestation failed")).toBeInTheDocument();
  });

  it("calls authenticate on retry button click", () => {
    pairingStatus = { step: "pairingError", message: "Connection timed out" };

    render(<CustomPairingModal />);
    fireEvent.click(screen.getByText("Try again"));
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it("disables close button during attestation", () => {
    attestationStatus = { step: "attestation" };

    render(<CustomPairingModal />);
    // The close button should be disabled
    const closeButtons = document.querySelectorAll("button[disabled]");
    expect(closeButtons.length).toBeGreaterThan(0);
  });
});

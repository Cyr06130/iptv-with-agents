"use client";

import { useAuthentication } from "@novasamatech/host-papp-react-ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCodeStyling from "qr-code-styling";

export function CustomPairingModal(): JSX.Element | null {
  const { pairingStatus, attestationStatus, abortAuthentication, authenticate } =
    useAuthentication();

  const isOpen =
    pairingStatus.step === "pairing" ||
    pairingStatus.step === "pairingError" ||
    attestationStatus.step === "attestation" ||
    attestationStatus.step === "attestationError";

  const handleClose = (): void => {
    if (attestationStatus.step !== "attestation") {
      abortAuthentication();
    }
  };

  if (typeof window === "undefined") return null;

  return createPortal(
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden my-auto">
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              disabled={attestationStatus.step === "attestation"}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors duration-200 z-20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloseIcon />
            </button>

            {/* Content based on state */}
            {pairingStatus.step === "pairing" && (
              <PairingStep payload={pairingStatus.payload} />
            )}
            {pairingStatus.step === "pairingError" && (
              <ErrorStep message={pairingStatus.message} onRetry={authenticate} />
            )}
            {attestationStatus.step === "attestation" && <LoadingStep />}
            {attestationStatus.step === "attestationError" && (
              <ErrorStep message={attestationStatus.message} onRetry={authenticate} />
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

function PairingStep({ payload }: { payload: string }): JSX.Element {
  return (
    <div className="p-6 flex flex-col items-center">
      <div className="text-center mb-4">
        <h2 className="font-serif text-2xl text-[var(--color-text-primary)] mb-1">
          Sign in
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Scan with your phone&apos;s camera to connect
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm mb-6">
        <QrCode value={payload} size={260} />
      </div>

      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-[var(--color-text-tertiary)]">
          <SmartphoneIcon />
          <span className="text-sm">This will open the Polkadot app</span>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] opacity-70 max-w-xs">
          Don&apos;t have the app yet? Download it from the App Store or Google Play.
        </p>
      </div>
    </div>
  );
}

function LoadingStep(): JSX.Element {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
      <div
        className="w-16 h-16 rounded-full border-4 border-[var(--color-border)] mb-6 animate-spin"
        style={{ borderTopColor: "var(--color-accent)" }}
      />
      <h2 className="font-serif text-2xl text-[var(--color-text-primary)] mb-2">
        Setting things up
      </h2>
      <p className="text-sm text-[var(--color-text-tertiary)] text-center">
        This will only take a moment...
      </p>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <AlertIcon />
      </div>

      <h2 className="font-serif text-2xl text-[var(--color-text-primary)] mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--color-text-tertiary)] text-center mb-2">
        {message}
      </p>
      <p className="text-xs text-[var(--color-text-tertiary)] opacity-70 text-center mb-8">
        Please try again. If the problem persists, make sure your Polkadot app is up to
        date.
      </p>

      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium transition-colors duration-200"
      >
        <RefreshIcon />
        Try again
      </button>
    </div>
  );
}

function QrCode({ value, size }: { value: string; size: number }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<QRCodeStyling | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !ref.current) return;

    if (!qrCodeRef.current) {
      qrCodeRef.current = new QRCodeStyling({
        width: size,
        height: size,
        data: value,
        dotsOptions: {
          color: "#1a1a1a",
          type: "rounded",
        },
        cornersSquareOptions: {
          color: "#1a1a1a",
          type: "extra-rounded",
        },
        cornersDotOptions: {
          color: "#1a1a1a",
          type: "dot",
        },
        backgroundOptions: {
          color: "#ffffff",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 0,
        },
      });
      qrCodeRef.current.append(ref.current);
    } else {
      qrCodeRef.current.update({ data: value });
    }
  }, [value, size, mounted]);

  if (!mounted) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-[var(--color-surface-secondary)] rounded-lg animate-pulse"
      />
    );
  }

  return <div ref={ref} />;
}

// Inline SVG icons to avoid adding lucide-react dependency

function CloseIcon(): JSX.Element {
  return (
    <svg
      className="w-5 h-5 text-[var(--color-text-tertiary)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SmartphoneIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function AlertIcon(): JSX.Element {
  return (
    <svg
      className="w-8 h-8 text-red-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function RefreshIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}

"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useAuthentication, useSessionIdentity } from "@novasamatech/host-papp-react-ui";
import { useWalletConnector, useWallets } from "@reactive-dot/react";
import { useUnifiedAccount, type UnifiedAccount } from "@/contexts/UnifiedAccountContext";
import { CustomPairingModal } from "@/components/polkadot-ui/custom-pairing-modal";

// ── Helpers ──────────────────────────────────────────────────────────

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ── Main component ───────────────────────────────────────────────────

export function ConnectWallet(): JSX.Element {
  return (
    <Suspense fallback={<ConnectWalletSkeleton />}>
      <ConnectWalletInner />
    </Suspense>
  );
}

function ConnectWalletSkeleton(): JSX.Element {
  return <div className="h-9 w-28 bg-[var(--color-surface-secondary)] rounded-lg animate-pulse" />;
}

function ConnectWalletInner(): JSX.Element {
  const wallets = useWallets();
  const [, connectWallet] = useWalletConnector();
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Unified account context
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    authSource,
    disconnect,
    isConnected,
    pappSession,
  } = useUnifiedAccount();

  // PApp authentication
  const { authenticate, pending: pappPending } = useAuthentication();
  const [pappIdentity] = useSessionIdentity(pappSession);

  // Close account menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    function handleClick(e: MouseEvent): void {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAccountMenu]);

  const isHosted = authSource === "host";

  const displayName =
    (selectedAccount?.source === "papp"
      ? pappIdentity?.fullUsername || pappIdentity?.liteUsername
      : null) ||
    selectedAccount?.name ||
    truncateAddress(selectedAccount?.address ?? "");

  // ── Host: account is already available, show it with no auth actions ──

  if (isHosted && isConnected) {
    return (
      <div className="flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <span className="w-7 h-7 rounded-lg bg-grey-900 dark:bg-grey-100 flex items-center justify-center shrink-0">
          <UserIcon />
        </span>
        <span className="text-sm font-medium text-[var(--color-text-primary)] max-w-[140px] truncate hidden sm:inline">
          {displayName}
        </span>
      </div>
    );
  }

  // ── Disconnected state ─────────────────────────────────────────────

  if (!isConnected) {
    return (
      <>
        <div className="flex items-center gap-2">
          {/* PRIMARY: Polkadot App sign-in */}
          <button
            onClick={() => authenticate()}
            disabled={pappPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pappPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <SmartphoneIcon />
            )}
            <span className="hidden sm:inline">Sign in</span>
          </button>

          {/* SECONDARY: Browser extension fallback */}
          <button
            onClick={() => setShowExtensionModal(true)}
            className="w-9 h-9 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)] rounded-lg transition-colors duration-200 flex items-center justify-center"
            title="Connect with wallet extension"
          >
            <WalletIcon />
          </button>
        </div>

        {/* PApp Pairing Modal */}
        <CustomPairingModal />

        {/* Extension Wallet Modal */}
        {showExtensionModal && (
          <WalletModal
            wallets={wallets.map((w) => ({
              id: w.id,
              name: w.name,
              installed: true,
            }))}
            onConnect={async (walletId: string) => {
              const wallet = wallets.find((w) => w.id === walletId);
              if (wallet) {
                await connectWallet(wallet);
                setShowExtensionModal(false);
              }
            }}
            onClose={() => setShowExtensionModal(false)}
          />
        )}
      </>
    );
  }

  // ── Connected state (papp / extension) ─────────────────────────────

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setShowAccountMenu((prev) => !prev)}
        className="flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-all duration-200"
      >
        <span className="w-7 h-7 rounded-lg bg-grey-900 dark:bg-grey-100 flex items-center justify-center shrink-0">
          {selectedAccount?.source === "papp" ? (
            <SmartphoneIconSmall />
          ) : (
            <UserIcon />
          )}
        </span>
        <span className="text-sm font-medium text-[var(--color-text-primary)] max-w-[140px] truncate hidden sm:inline">
          {displayName}
        </span>
        <ChevronIcon open={showAccountMenu} />
      </button>

      {showAccountMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Accounts
            </span>
          </div>

          {/* Account list */}
          <div className="p-3 max-h-72 overflow-y-auto">
            {accounts.map((account) => (
              <AccountItem
                key={account.address}
                account={account}
                isSelected={selectedAccount?.address === account.address}
                onSelect={() => {
                  setSelectedAccount(account);
                  setShowAccountMenu(false);
                }}
              />
            ))}
          </div>

          {/* Footer — hidden for host accounts (disconnect is managed by the host) */}
          {authSource !== "host" && (
            <div className="px-3 py-3 border-t border-[var(--color-border)]">
              <button
                onClick={async () => {
                  await disconnect();
                  setShowAccountMenu(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors duration-200"
              >
                <LogoutIcon />
                Disconnect All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Account item ─────────────────────────────────────────────────────

function AccountItem({
  account,
  isSelected,
  onSelect,
}: {
  account: UnifiedAccount;
  isSelected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const displayName = account.name ?? "Account";

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
        isSelected
          ? "bg-grey-900 dark:bg-grey-100 text-white dark:text-grey-900"
          : "hover:bg-[var(--color-surface-secondary)]"
      }`}
    >
      <span
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isSelected ? "bg-white dark:bg-grey-900" : "bg-grey-900 dark:bg-grey-100"
        }`}
      >
        {account.source === "papp" ? (
          <SmartphoneIconInverted inverted={isSelected} />
        ) : (
          <UserIcon inverted={isSelected} />
        )}
      </span>
      <span className="flex-1 text-left min-w-0">
        <span
          className={`block font-medium text-sm ${isSelected ? "" : "text-[var(--color-text-primary)]"}`}
        >
          {displayName}
        </span>
        <span className="block text-xs opacity-60 mt-0.5">
          {account.source === "host"
            ? "Polkadot Desktop"
            : account.source === "papp"
              ? "Polkadot App"
              : account.wallet?.name ?? "Extension"}
          {" \u00B7 "}
          {truncateAddress(account.address)}
        </span>
      </span>
      {isSelected && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
    </button>
  );
}

// ── Wallet modal ─────────────────────────────────────────────────────

function WalletModal({
  wallets,
  onConnect,
  onClose,
}: {
  wallets: { id: string; name: string; installed: boolean }[];
  onConnect: (walletId: string) => Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(
    async (walletId: string) => {
      setConnecting(true);
      setError(null);
      try {
        await onConnect(walletId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect");
      } finally {
        setConnecting(false);
      }
    },
    [onConnect],
  );

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect Wallet"
        className="relative w-full max-w-md bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-2xl text-[var(--color-text-primary)] mb-1">
                Connect Wallet
              </h2>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Choose your Polkadot wallet extension
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Wallet list */}
        <div className="p-5">
          {wallets.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-medium text-[var(--color-text-primary)] mb-2">
                No wallets detected
              </p>
              <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
                Install a Polkadot wallet extension
              </p>
              <div className="space-y-2">
                <a
                  href="https://talisman.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-5 py-3 bg-[var(--color-surface-secondary)] rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
                >
                  Get Talisman
                </a>
                <a
                  href="https://subwallet.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-5 py-3 bg-[var(--color-surface-secondary)] rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
                >
                  Get SubWallet
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet.id)}
                  disabled={connecting}
                  className="w-full flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-xl hover:border-accent hover:shadow-sm transition-all duration-200 disabled:opacity-50"
                >
                  <span className="w-11 h-11 rounded-lg bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-primary)] text-lg font-bold shrink-0">
                    {wallet.name[0]}
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block font-semibold text-[var(--color-text-primary)]">
                      {wallet.name}
                    </span>
                    <span className="block text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {wallet.installed ? "Detected" : "Not installed"}
                    </span>
                  </span>
                  <svg
                    className="w-5 h-5 text-[var(--color-text-tertiary)] -rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-sm font-medium text-error">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Your keys never leave your wallet</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline SVG icons ─────────────────────────────────────────────────

function SmartphoneIcon(): JSX.Element {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function SmartphoneIconSmall(): JSX.Element {
  return (
    <svg className="w-4 h-4 text-white dark:text-grey-900" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function SmartphoneIconInverted({ inverted = false }: { inverted?: boolean }): JSX.Element {
  return (
    <svg
      className={`w-4 h-4 ${inverted ? "text-grey-900 dark:text-white" : "text-white dark:text-grey-900"}`}
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

function WalletIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-[var(--color-text-secondary)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14a2 2 0 002 2h16v-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
  );
}

function UserIcon({ inverted = false }: { inverted?: boolean }): JSX.Element {
  return (
    <svg
      className={`w-4 h-4 ${inverted ? "text-grey-900 dark:text-white" : "text-white dark:text-grey-900"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function LogoutIcon(): JSX.Element {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline strokeLinecap="round" strokeLinejoin="round" points="16 17 21 12 16 7" />
      <line strokeLinecap="round" strokeLinejoin="round" x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

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

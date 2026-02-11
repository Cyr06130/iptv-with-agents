"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet as connectWalletService,
  waitForWallets,
  type DetectedWallet,
  type WalletAccount,
} from "@/lib/wallet-service";

export type { WalletAccount } from "@/lib/wallet-service";

const SELECTED_ACCOUNT_KEY = "polkadot:selected-account";

type WalletContextValue = {
  /** All available wallet extensions detected in the browser. */
  wallets: DetectedWallet[];
  /** All accounts from connected extensions. */
  accounts: WalletAccount[];
  /** Currently selected account. */
  selectedAccount: WalletAccount | null;
  /** Pick a different account. */
  setSelectedAccount: (account: WalletAccount | null) => void;
  /** True while the connect flow is in progress. */
  isConnecting: boolean;
  /** True when at least one account is available. */
  isConnected: boolean;
  /** Trigger wallet discovery and enable extensions. */
  connect: () => Promise<void>;
  /** Clear local state (does not revoke extension access). */
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }): JSX.Element {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [selectedAccount, setSelectedAccountState] = useState<WalletAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Detect available wallets on mount.
  useEffect(() => {
    waitForWallets(1500).then(setWallets);
  }, []);

  // Restore selected account from localStorage when accounts change.
  useEffect(() => {
    if (accounts.length === 0) return;

    const stored = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    if (stored) {
      const found = accounts.find((a) => a.address === stored);
      if (found) {
        setSelectedAccountState(found);
        return;
      }
    }
    // Auto-select first account.
    if (!selectedAccount) {
      setSelectedAccountState(accounts[0]);
    }
  }, [accounts, selectedAccount]);

  const setSelectedAccount = useCallback((account: WalletAccount | null) => {
    setSelectedAccountState(account);
    if (account) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, account.address);
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const accts = await connectWalletService();
      setAccounts(accts);
      // Refresh detected wallets after enabling.
      const { getAvailableWallets } = await import("@/lib/wallet-service");
      setWallets(getAvailableWallets());
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccounts([]);
    setSelectedAccount(null);
  }, [setSelectedAccount]);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallets,
      accounts,
      selectedAccount,
      setSelectedAccount,
      isConnecting,
      isConnected: accounts.length > 0,
      connect,
      disconnect,
    }),
    [wallets, accounts, selectedAccount, setSelectedAccount, isConnecting, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext);
  if (context === null) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}

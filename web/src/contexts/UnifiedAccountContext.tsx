"use client";

import type { UserSession } from "@novasamatech/host-papp";
import { useAuthentication, useSession } from "@novasamatech/host-papp-react-ui";
import { AccountId } from "@polkadot-api/substrate-bindings";
import { useAccounts, useConnectedWallets, useWalletDisconnector } from "@reactive-dot/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useHostAccounts } from "@/hooks/useHostAccount";

export type UnifiedAccount = {
  address: string;
  name?: string;
  type?: string;
  genesisHash?: string;
  source: "host" | "papp" | "extension";
  wallet?: { name: string };
  publicKey?: Uint8Array;
};

type UnifiedAccountContextValue = {
  accounts: UnifiedAccount[];
  selectedAccount: UnifiedAccount | null;
  setSelectedAccount: (account: UnifiedAccount | null) => void;
  authSource: "host" | "papp" | "extension" | null;
  pappSession: UserSession | null;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
};

const UnifiedAccountContext = createContext<UnifiedAccountContextValue | null>(null);

const SELECTED_ACCOUNT_KEY = "polkadot:selected-account";

export function UnifiedAccountProvider({ children }: { children: ReactNode }): JSX.Element {
  const [selectedAccount, setSelectedAccountState] = useState<UnifiedAccount | null>(null);

  // Host accounts (Polkadot Desktop / iframe) — highest priority
  const { accounts: rawHostAccounts, loading: hostLoading, isHosted } = useHostAccounts();

  // PApp session
  const { session: pappSession } = useSession();
  const pappAuth = useAuthentication();

  // Extension wallets
  const extensionAccounts = useAccounts({ defer: true });
  const connectedWallets = useConnectedWallets();
  const [, disconnectWallet] = useWalletDisconnector();

  // Convert host accounts to unified format
  const hostUnifiedAccounts = useMemo<UnifiedAccount[]>(() => {
    return rawHostAccounts.map((account) => ({
      address: account.address,
      name: account.name,
      type: "sr25519",
      source: "host" as const,
      publicKey: account.publicKey,
    }));
  }, [rawHostAccounts]);

  // Convert PApp session to unified account
  const pappAccount = useMemo<UnifiedAccount | null>(() => {
    if (!pappSession) return null;
    try {
      const address = AccountId().dec(pappSession.remoteAccount.accountId);
      return {
        address,
        type: "sr25519",
        source: "papp",
      };
    } catch {
      return null;
    }
  }, [pappSession]);

  // Convert extension accounts to unified format
  const extensionUnifiedAccounts = useMemo<UnifiedAccount[]>(() => {
    if (!extensionAccounts || extensionAccounts.length === 0) return [];
    return extensionAccounts.map((account) => ({
      address: account.address,
      name: account.name,
      type: "sr25519",
      source: "extension" as const,
      wallet: { name: account.wallet.name },
    }));
  }, [extensionAccounts]);

  // Merge accounts (host first, then papp, then extensions, dedupe by address)
  const accounts = useMemo<UnifiedAccount[]>(() => {
    const allAccounts: UnifiedAccount[] = [];
    const seenAddresses = new Set<string>();

    for (const account of hostUnifiedAccounts) {
      if (!seenAddresses.has(account.address)) {
        allAccounts.push(account);
        seenAddresses.add(account.address);
      }
    }

    if (pappAccount && !seenAddresses.has(pappAccount.address)) {
      allAccounts.push(pappAccount);
      seenAddresses.add(pappAccount.address);
    }

    for (const account of extensionUnifiedAccounts) {
      if (!seenAddresses.has(account.address)) {
        allAccounts.push(account);
        seenAddresses.add(account.address);
      }
    }

    return allAccounts;
  }, [hostUnifiedAccounts, pappAccount, extensionUnifiedAccounts]);

  // Determine auth source — host beats papp beats extension
  const authSource = useMemo<"host" | "papp" | "extension" | null>(() => {
    if (isHosted && hostUnifiedAccounts.length > 0) return "host";
    if (pappSession) return "papp";
    if (extensionAccounts && extensionAccounts.length > 0) return "extension";
    return null;
  }, [isHosted, hostUnifiedAccounts, pappSession, extensionAccounts]);

  // Load selected account from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    if (stored && accounts.length > 0) {
      const found = accounts.find((a) => a.address === stored);
      if (found) {
        setSelectedAccountState(found);
        return;
      }
    }
    // Auto-select first account if none selected
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccountState(accounts[0]);
    }
  }, [accounts, selectedAccount]);

  // Auto-select first host account when hosted (highest priority)
  useEffect(() => {
    if (hostUnifiedAccounts.length > 0 && (!selectedAccount || selectedAccount.source !== "host")) {
      setSelectedAccountState(hostUnifiedAccounts[0]);
      localStorage.setItem(SELECTED_ACCOUNT_KEY, hostUnifiedAccounts[0].address);
    }
  }, [hostUnifiedAccounts, selectedAccount]);

  // Update selected account when PApp connects (prioritize over extension, but not over host)
  useEffect(() => {
    if (
      pappAccount &&
      (!selectedAccount ||
        (selectedAccount.source !== "papp" && selectedAccount.source !== "host"))
    ) {
      setSelectedAccountState(pappAccount);
      localStorage.setItem(SELECTED_ACCOUNT_KEY, pappAccount.address);
    }
  }, [pappAccount, selectedAccount]);

  const setSelectedAccount = useCallback((account: UnifiedAccount | null) => {
    setSelectedAccountState(account);
    if (account) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, account.address);
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  }, []);

  const disconnect = useCallback(async () => {
    // Host accounts are managed by the host — disconnect is a no-op for them
    if (selectedAccount?.source === "host") return;

    if (pappSession) {
      pappAuth.disconnect(pappSession);
    }
    for (const wallet of connectedWallets) {
      await disconnectWallet(wallet);
    }
    setSelectedAccount(null);
  }, [selectedAccount, pappSession, pappAuth, connectedWallets, disconnectWallet, setSelectedAccount]);

  const value = useMemo<UnifiedAccountContextValue>(
    () => ({
      accounts,
      selectedAccount,
      setSelectedAccount,
      authSource,
      pappSession,
      disconnect,
      isConnected: accounts.length > 0,
      isConnecting: hostLoading || pappAuth.pending,
    }),
    [accounts, selectedAccount, setSelectedAccount, authSource, pappSession, disconnect, hostLoading, pappAuth.pending],
  );

  return <UnifiedAccountContext.Provider value={value}>{children}</UnifiedAccountContext.Provider>;
}

export function useUnifiedAccount(): UnifiedAccountContextValue {
  const context = useContext(UnifiedAccountContext);
  if (!context) {
    throw new Error("useUnifiedAccount must be used within a UnifiedAccountProvider");
  }
  return context;
}
